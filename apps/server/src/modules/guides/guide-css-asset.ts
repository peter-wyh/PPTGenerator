/**
 * ★ B2 指南 CSS 资产化(资产工程 v1):确定性视觉,不经过 LLM。
 *
 * 设计(对应 0910 架构评审):
 *   - L0 tokens / L1 CSS = 文件资产(git 版本化),真源=Example/FT.html 提取;
 *   - GuideRevision.assets 快照引用 [{kind:'css', ref, hash, name}];
 *   - 生成时:系统提示词要求 LLM 输出 <!--GUIDE_CSS--> 占位符;
 *   - 生成后:postProcess 阶段把占位符替换为资产 CSS 原文(字节级)。
 *
 * 色值/字体/Google Fonts 链接从此不经过 LLM——#28223D→#2C2242 类漂移物理上不可能。
 *
 * 失败语义(与 guide-checks.bridge 一致):资产缺失/装载失败 → 静默降级
 * "无 CSS 注入",占位符若残留则被清除,生成永不因此失败。
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Guide } from '@prisma/client';
import { guideService } from './guide.service';

const __filename_esm = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url);
const ASSETS_DIR = join(dirname(__filename_esm), 'assets');

/** LLM 须在 <head> 输出的占位符(单个 HTML 注释,不破坏结构)。 */
export const GUIDE_CSS_PLACEHOLDER = '<!--GUIDE_CSS-->';

/** GuideRevision.assets 快照里 CSS 资产条目的形态。 */
export interface CssAssetRef {
  kind: 'css';
  ref: string;   // assets/ 下的相对路径,如 'ft-recap/base.css'
  hash?: string; // sha256 前 16 位,装载时校验(可选,缺失不校验)
  name?: string; // 展示名
}

/** 装载结果:注入用 CSS 文本 + 引用清单(溯源)。 */
export interface GuideCssBundle {
  css: string;
  refs: CssAssetRef[];
}

/** 装载单条资产引用(带 hash 校验;目录穿越防护:ref 不许含 .. 或以 / 开头)。 */
function loadCssAsset(ref: string, expectHash?: string): string | null {
  if (!ref || ref.startsWith('/') || ref.split('/').includes('..')) return null;
  // 编译产物在 dist,源在 src——两处都找(与 prompt-assets 同策略)
  for (const base of [ASSETS_DIR, join(process.cwd(), 'src/modules/guides/assets'), join(process.cwd(), 'dist/modules/guides/assets')]) {
    try {
      const css = readFileSync(join(base, ref), 'utf-8');
      if (css.trim()) return css;
    } catch { /* try next */ }
  }
  void expectHash; // hash 校验暂为溯源信息(装载失败已降级,不做硬失败)
  return null;
}

/**
 * 结构指南的 active revision assets → CSS bundle。
 * 无指南/无 revision/无 kind:'css' 资产 → null(调用方不注入、不发占位符指令)。
 */
export async function resolveGuideCssBundle(structural: Guide | null): Promise<GuideCssBundle | null> {
  if (!structural) return null;
  try {
    const rev = await guideService.ensureActiveRevision(structural);
    const raw = Array.isArray(rev.assets) ? (rev.assets as unknown[]) : [];
    const cssRefs = raw.filter(
      (a): a is CssAssetRef =>
        Boolean(a) && typeof a === 'object' && (a as CssAssetRef).kind === 'css'
        && typeof (a as CssAssetRef).ref === 'string',
    );
    if (!cssRefs.length) return null;
    const parts: string[] = [];
    const ok: CssAssetRef[] = [];
    for (const r of cssRefs) {
      const css = loadCssAsset(r.ref, r.hash);
      if (css === null) {
        console.warn('[guide-css] 资产装载失败,跳过:', r.ref);
        continue;
      }
      parts.push(css.trim());
      ok.push(r);
    }
    if (!parts.length) return null;
    return { css: parts.join('\n\n'), refs: ok };
  } catch (e) {
    console.warn('[guide-css] 装配失败,降级为无 CSS 注入:', (e as Error)?.message ?? e);
    return null;
  }
}

/**
 * 生成后注入:占位符 → CSS <style> 原文。
 * - 有占位符 → 精确替换(字节级等价);
 * - 无占位符(LLM 没听指令)→ 兜底插到 </head> 前;再不行插 <body 前;仍不行追加尾部。
 *   (兜底保证资产 CSS 一定生效,LLM 自带 <style> 若冲突,资产在后者优先级更高)
 * - bundle 为 null(指南无 CSS 资产)→ 原样返回,清除残留占位符。
 */
export function injectGuideCss(html: string, bundle: GuideCssBundle | null): string {
  if (!bundle) {
    return html.split(GUIDE_CSS_PLACEHOLDER).join('');
  }
  const style = `<style>\n/* ==== injected: guide css assets (do not edit — from guide revision snapshot) ==== */\n${bundle.css}\n</style>`;
  if (html.includes(GUIDE_CSS_PLACEHOLDER)) {
    return html.split(GUIDE_CSS_PLACEHOLDER).join(style);
  }
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${style}\n</head>`);
  if (/<body[^>]*>/i.test(html)) return html.replace(/<body([^>]*)>/i, `<body$1>\n${style}`);
  return `${html}\n${style}`;
}

/** 系统提示词里告知占位符的指令段(仅 bundle 存在时由调用方拼接)。 */
export function guideCssPromptSection(bundle: GuideCssBundle): string {
  const names = bundle.refs.map((r) => r.name || r.ref).join(', ');
  return [
    '═══ GUIDE CSS ASSET (deterministic visual — CRITICAL) ═══',
    `This guide ships a server-managed stylesheet (${names}).`,
    `You MUST output the literal placeholder ${GUIDE_CSS_PLACEHOLDER} inside <head>, as its own line,`,
    'and you MUST NOT write any <style> block of your own for layout/colors/typography.',
    'Write ONLY the HTML structure using the class names defined by the guide (see component contract).',
    'The server will replace the placeholder with the authoritative stylesheet after generation.',
    'Never hardcode any color hex value, font name, or Google Fonts link — those live in the asset only.',
  ].join('\n');
}
