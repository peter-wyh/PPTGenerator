/** 数据管理导入工具:字段定义、预览构造、模板下载。 */

export const CAMPAIGN_FIELDS = ['id', 'name', 'advertiser', 'businessLine', 'platform', 'startDate', 'endDate', 'budget', 'status', 'owner', 'creatorIds'] as const;
export const CAMPAIGN_REQUIRED = ['id', 'name', 'advertiser', 'businessLine', 'platform', 'startDate', 'endDate', 'budget'];
export const CREATOR_FIELDS = ['id', 'name', 'handle', 'platform', 'tier', 'followers', 'engagement', 'category', 'region', 'avatar'] as const;
export const CREATOR_REQUIRED = ['id', 'name', 'handle', 'platform', 'tier', 'followers', 'engagement', 'category', 'region'];

export type DataKind = 'campaign' | 'creator';

const FIELDS: Record<DataKind, readonly string[]> = { campaign: CAMPAIGN_FIELDS, creator: CREATOR_FIELDS };
const REQUIRED: Record<DataKind, string[]> = { campaign: CAMPAIGN_REQUIRED, creator: CREATOR_REQUIRED };

export interface PreviewItem {
  data: Record<string, unknown>;
  valid: boolean;
  error?: string;
}

/** 预览表格展示的列(不含 owner/avatar 等次要字段)。 */
export const PREVIEW_COLUMNS: Record<DataKind, string[]> = {
  campaign: ['id', 'name', 'advertiser', 'businessLine', 'platform', 'startDate', 'endDate', 'budget', 'status'],
  creator: ['id', 'name', 'handle', 'platform', 'tier', 'followers', 'engagement', 'category', 'region'],
};

function checkRequired(kind: DataKind, data: Record<string, unknown>): string[] {
  return REQUIRED[kind].filter((f) => data[f] === undefined || data[f] === '');
}

/** CSV/XLSX 行(Record<string,string>)→ 按表头取核心字段,校验必填。 */
export function buildPreviewFromRows(kind: DataKind, rows: Record<string, string>[]): PreviewItem[] {
  const fields = FIELDS[kind];
  return rows.map((row) => {
    const data: Record<string, unknown> = {};
    for (const f of fields) {
      const v = row[f];
      if (v === undefined || v === '') continue;
      if (f === 'creatorIds') {
        const ids = String(v).split(';').map((s) => s.trim()).filter(Boolean);
        if (ids.length) data.creatorIds = ids;
      } else {
        data[f] = v;
      }
    }
    const missing = checkRequired(kind, data);
    return missing.length ? { data, valid: false, error: `缺字段: ${missing.join(', ')}` } : { data, valid: true };
  });
}

/** JSON 项(已是完整对象,可能含 metrics/platforms)→ 只校验必填,保留完整对象。 */
export function buildPreviewFromObjects(kind: DataKind, items: unknown[]): PreviewItem[] {
  return items.map((item) => {
    const data = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const missing = checkRequired(kind, data);
    return missing.length ? { data, valid: false, error: `缺字段: ${missing.join(', ')}` } : { data, valid: true };
  });
}

/** 下载 CSV 模板(表头对齐字段 + 一行示例)。 */
export function downloadTemplate(kind: DataKind): void {
  const fields = FIELDS[kind];
  const header = fields.join(',');
  const example =
    kind === 'campaign'
      ? 'camp-example,示例 Campaign,GlowLab,FT,TikTok,2026-01-01,2026-01-31,$100K,Active,alex,cre-mia;cre-sofia'
      : 'cre-example,Mia Chen,@mia,TikTok,mega,1.28M,8.7%,Beauty,US,';
  const csv = `${header}\n${example}\n`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${kind}-template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
