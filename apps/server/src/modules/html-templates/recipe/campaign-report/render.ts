// render.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Handlebars from 'handlebars';
import { mapCampaign } from './mapper';
import { fillActionable } from './narrative';
import { dgTokens } from './tokens';
import { applyManifest } from './manifest';
import type { RenderInput } from '../types';
import { ApiError } from '../../../../utils/ApiError';

// 注册 helpers
Handlebars.registerHelper('json', (v) => new Handlebars.SafeString(JSON.stringify(v)));
Handlebars.registerHelper('map', (arr: any[], key: string) => (arr ?? []).map((x) => x[key]));
Handlebars.registerHelper('minus', (a: number, b: number) => a - b);
Handlebars.registerHelper('initials', (full: string) =>
  (full ?? '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
);

// manifest.ts 在 import 时注册 6 个 partial;必须在 compile 前完成。
// (`import './manifest'` 已在顶部,ESM 静态 import 保证先执行。)

const here = dirname(fileURLToPath(import.meta.url));
const templateSrc = readFileSync(join(here, 'template.hbs'), 'utf8');
const compiled = Handlebars.compile(templateSrc, { noEscape: false });

export async function render(input: RenderInput): Promise<string> {
  if (!input.campaignId) throw ApiError.badRequest('recipe 模式需要 campaignId');
  const content = await mapCampaign(input.campaignId);
  content.actionable = await fillActionable(content);
  // 模板根字段(header/kpis/trend/publishers/insights/actionable)与 tokens.* 并列,故展开 content。
  // components 由 manifest 决定顺序/可见性;每个 element 携带 partial 名 + 全量数据。
  const components = applyManifest(input.manifestOverrides).map((c) => ({ ...c, ...content, tokens: dgTokens }));
  return compiled({ ...content, tokens: dgTokens, components });
}
