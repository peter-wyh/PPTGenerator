// render.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Handlebars from 'handlebars';
import { mapCampaign } from './mapper';
import { fillActionable } from './narrative';
import { pickVoiceForCampaign } from '../../../guides/guide.service';
import { applyManifest } from './manifest';
import { mergeTokens } from '../overrides';
import type { RenderInput } from '../types';
import { ApiError } from '../../../../utils/ApiError';
import { config } from '../../../../config';

// 注册 helpers
Handlebars.registerHelper('json', (v) => new Handlebars.SafeString(JSON.stringify(v)));
Handlebars.registerHelper('map', (arr: any[], key: string) => (arr ?? []).map((x) => x[key]));
Handlebars.registerHelper('minus', (a: number, b: number) => a - b);
// ★ 宁缺勿假:空态指标占位文案识别(KPI 卡降级样式)
Handlebars.registerHelper('isUnavailable', (v: unknown) => v === 'Metric unavailable' || v === '—');
Handlebars.registerHelper('initials', (full: string) =>
  (full ?? '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
);

// manifest.ts 在 import 时注册 6 个 partial;必须在 compile 前完成。
// (`import './manifest'` 已在顶部,ESM 静态 import 保证先执行。)

const here = dirname(fileURLToPath(import.meta.url));
const templateSrc = readFileSync(join(here, 'template.hbs'), 'utf8');
const compiled = Handlebars.compile(templateSrc, { noEscape: false });

// recipe 报告自托管资源基础 URL(与 ai-generate.service.ts 的 SELF_HOST_BASE 同源);
// 模板里 {{vendorBase}}/vendor/... 引用。空则回退相对路径(srcdoc 同源可用,export 断)。
const vendorBase = (process.env.PUBLIC_BASE_URL || config.webUrl || '').replace(/\/+$/, '');

export async function render(input: RenderInput): Promise<string> {
  if (!input.campaignId && !input.reportContent) {
    throw ApiError.badRequest('recipe 需要 campaignId 或 reportContent');
  }
  // reportContent 优先:编辑器重渲染已编辑数据时跳过 DB。
  const content = input.reportContent ?? await mapCampaign(input.campaignId!, input.reportPeriod);
  // 业务线指南「语调与术语」节注入洞察文案(recipe 视觉/章节不动,仅对齐语调;查询失败降级空串)
  const voice = input.campaignId ? await pickVoiceForCampaign(input.campaignId) : '';
  content.actionable = await fillActionable(content, voice);
  // tokens 合并默认 + 用户覆盖;无覆盖时与原 dgTokens 等价(快照不变)。
  const tokens = mergeTokens(input.tokenOverrides);
  // 模板根字段(header/kpis/trend/publishers/insights/actionable)与 tokens.* 并列,故展开 content。
  // components 由 manifest 决定顺序/可见性;每个 element 携带 partial 名 + 全量数据。
  const components = applyManifest(input.manifestOverrides).map((c) => ({ ...c, ...content, tokens }));
  return compiled({ ...content, tokens, components, vendorBase });
}
