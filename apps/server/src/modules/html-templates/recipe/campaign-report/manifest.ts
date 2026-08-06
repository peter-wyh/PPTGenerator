// manifest.ts — 注册 6 个组件 partial + 默认 manifest + applyManifest
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Handlebars from 'handlebars';

const here = dirname(fileURLToPath(import.meta.url));

/** 6 个组件 partial 名(模块加载时一次性注册) */
const COMPONENT_IDS = ['header', 'kpi', 'trend', 'publishers', 'insights', 'actionable'] as const;

for (const name of COMPONENT_IDS) {
  const src = readFileSync(join(here, 'partials', `_${name}.hbs`), 'utf8');
  Handlebars.registerPartial(name, src);
}

export type ComponentId = (typeof COMPONENT_IDS)[number];

export const DEFAULT_MANIFEST: { order: ComponentId[]; hidden: ComponentId[] } = {
  order: ['header', 'kpi', 'trend', 'publishers', 'insights', 'actionable'],
  hidden: [],
};

export interface ManifestOverrides {
  order?: string[];
  hidden?: string[];
}

/**
 * 合并默认 manifest + 覆盖,返回按顺序排列、过滤 hidden 的组件数组。
 * 每个 element 形如 { partial: 'header', ...content, tokens }(由 render 展开注入数据)。
 */
export function applyManifest(overrides?: ManifestOverrides): { partial: string }[] {
  const order = overrides?.order ?? DEFAULT_MANIFEST.order;
  const hidden = new Set(overrides?.hidden ?? []);
  return order.filter((id) => !hidden.has(id)).map((id) => ({ partial: id }));
}
