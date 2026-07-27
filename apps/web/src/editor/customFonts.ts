/**
 * 自定义字体运行时注册表（前端）。
 *
 * 职责：
 * ① 持有当前会话内已加载的自定义字体列表（CustomFontMeta[]），订阅式更新。
 * ② 为每个自定义字体动态注入 <style id="custom-font-<id>">@font-face{...}</style> 到 <head>。
 * ③ 提供给 FontSelect 的 FontOption 视图：把 CustomFontMeta 适配成 FontOption 形状。
 * ④ 删除时移除对应 <style> 并从列表移除。
 *
 * 与 theme.tsx 的 injectFontLinks 配合：后者负责 Google Fonts <link>，
 * 本模块负责本地字体的 @font-face。getFontStack 在 utils.ts 中只查 FONT_OPTIONS，
 * 故自定义字体的 stack 必须在 FontOption 视图里显式提供（见 toFontOption），
 * 且 theme.tsx 的 injectFontLinks 会在查不到 FONT_OPTIONS 时把 key 标记已处理、
 * 不再注入 Google link —— 此时浏览器实际用本模块注入的 @font-face 渲染。
 */
import type { CustomFontMeta, FontOption } from '@mediakit/shared';
import { setCustomFontResolver } from '@mediakit/shared';
import { listFonts } from '@/api/fonts';

/* ------------------------------------------------------------------ */
/* 模块级状态 + 订阅                                                    */
/* ------------------------------------------------------------------ */

/** 当前已注册的自定义字体（按上传顺序）。 */
let customFonts: CustomFontMeta[] = [];

/** 订阅回调集合（组件挂载时注册，用于触发 React 重渲染）。 */
const listeners = new Set<(fonts: CustomFontMeta[]) => void>();

/** 通知所有订阅者。 */
function notify(): void {
  const snapshot = [...customFonts];
  listeners.forEach((fn) => fn(snapshot));
}

/**
 * 注册到 shared 包的字体解析器：当 ProjectTheme.font.text 等指向自定义字体 key 时，
 * getFontStack 能查到对应的 CSS font-family stack。
 * 模块加载时注册一次（副作用），shared 侧通过回调反向查询。
 */
setCustomFontResolver((key: string): string | undefined => {
  const meta = customFonts.find((f) => f.key === key);
  if (!meta) return undefined;
  const family = meta.name.replace(/'/g, '');
  return `'${family}', sans-serif`;
});

/** 订阅自定义字体列表变化，返回取消订阅函数。组件用 useSyncExternalStore 更佳。 */
export function subscribeCustomFonts(fn: (fonts: CustomFontMeta[]) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 取当前快照（供 useSyncExternalStore getSnapshot）。 */
export function getCustomFontsSnapshot(): CustomFontMeta[] {
  return customFonts;
}

/* ------------------------------------------------------------------ */
/* @font-face 注入                                                      */
/* ------------------------------------------------------------------ */

/** style 标签 id 前缀。 */
const STYLE_ID_PREFIX = 'custom-font-';

/** 为一个自定义字体注入 @font-face <style>。已存在则跳过。 */
function injectFontFace(meta: CustomFontMeta): void {
  if (typeof document === 'undefined') return;
  const id = `${STYLE_ID_PREFIX}${meta.id}`;
  if (document.getElementById(id)) return;
  const family = escapeFontFamilyName(meta.name);
  const css = [
    `@font-face {`,
    `  font-family: '${family}';`,
    `  src: url('${meta.url}') format('${meta.format}');`,
    `  font-display: swap;`,
    `}`,
  ].join('\n');
  const style = document.createElement('style');
  style.id = id;
  style.dataset.customFont = meta.key;
  style.textContent = css;
  document.head.appendChild(style);
}

/** 移除一个自定义字体的 @font-face <style>。 */
function removeFontFace(id: string): void {
  if (typeof document === 'undefined') return;
  document.getElementById(`${STYLE_ID_PREFIX}${id}`)?.remove();
}

/** 转义单引号，避免注入。字体名理论上不含 '，但防御。 */
function escapeFontFamilyName(name: string): string {
  return name.replace(/'/g, '');
}

/* ------------------------------------------------------------------ */
/* 公开 API                                                             */
/* ------------------------------------------------------------------ */

/** 注册一批自定义字体（来自服务端列表 / 上传返回），自动注入 @font-face。去重。 */
export function registerCustomFonts(metas: CustomFontMeta[]): void {
  const existing = new Set(customFonts.map((f) => f.id));
  const fresh = metas.filter((m) => !existing.has(m.id));
  if (fresh.length === 0) return;
  for (const m of fresh) injectFontFace(m);
  customFonts = [...customFonts, ...fresh];
  notify();
}

/**
 * 全量替换自定义字体列表（来自 GET /fonts 的初始加载）。
 * 会移除已不在列表中的字体的 @font-face。
 */
export function setCustomFonts(metas: CustomFontMeta[]): void {
  const next = new Map(metas.map((m) => [m.id, m]));
  // 移除被删的
  for (const old of customFonts) {
    if (!next.has(old.id)) removeFontFace(old.id);
  }
  // 注入新加入的
  for (const m of metas) {
    if (!customFonts.some((o) => o.id === m.id)) injectFontFace(m);
  }
  customFonts = [...metas];
  notify();
}

/** 移除一个自定义字体（删除后端成功后调用）。 */
export function unregisterCustomFont(id: string): void {
  if (!customFonts.some((f) => f.id === id)) return;
  removeFontFace(id);
  customFonts = customFonts.filter((f) => f.id !== id);
  notify();
}

/* ------------------------------------------------------------------ */
/* 视图层适配                                                           */
/* ------------------------------------------------------------------ */

/**
 * 把 CustomFontMeta 转成 FontOption（追加到 FONT_OPTIONS 之后）。
 * 自定义字体的 stack 用家族名（@font-face 已定义该 family），
 * category 设为 'text'（同时也会出现在标题下拉，因为 headingFonts = all）。
 */
export function customFontToOption(meta: CustomFontMeta): FontOption {
  const family = meta.name.replace(/'/g, '');
  return {
    key: meta.key,
    label: `${meta.name}（自定义）`,
    category: 'text', // 自定义字体同时进入 text/number/heading 三个下拉
    stack: `'${family}', sans-serif`,
    // 无 loadUrl：本地字体不走 Google Fonts <link>，而走 @font-face（本模块注入）。
  };
}

/** 取当前自定义字体的 FontOption 视图（按注册顺序）。 */
export function getCustomFontOptions(): FontOption[] {
  return customFonts.map(customFontToOption);
}

/* ------------------------------------------------------------------ */
/* React hook：启动时从服务端加载                                       */
/* ------------------------------------------------------------------ */

/** 已初始化标志（避免每次 Editor 挂载都重打 GET /fonts；HMR 友好）。 */
let bootstrapped = false;

/**
 * 启动时从服务端拉取已上传字体并注册（注入 @font-face + 注册 resolver）。
 * 幂等：已初始化则跳过。失败静默（服务端不可用时不阻塞编辑器）。
 */
export async function bootstrapCustomFonts(): Promise<void> {
  if (bootstrapped || typeof document === 'undefined') return;
  bootstrapped = true;
  try {
    const fonts = await listFonts();
    setCustomFonts(fonts);
  } catch {
    bootstrapped = false; // 允许下次重试
  }
}
