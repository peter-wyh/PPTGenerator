/** 数据管理导入工具:字段定义、预览构造、模板下载。 */

export const CAMPAIGN_FIELDS = ['id', 'name', 'advertiser', 'businessLine', 'platform', 'startDate', 'endDate', 'budget', 'status', 'owner', 'creatorIds', 'metrics', 'platforms'] as const;
export const CAMPAIGN_REQUIRED = ['id', 'name', 'advertiser', 'businessLine', 'platform', 'startDate', 'endDate', 'budget'];
export const CREATOR_FIELDS = ['id', 'name', 'handle', 'platform', 'tier', 'followers', 'engagement', 'category', 'region', 'avatar', 'bio', 'tags'] as const;
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
      } else if (f === 'tags') {
        const tags = String(v).split(';').map((s) => s.trim()).filter(Boolean);
        if (tags.length) data.tags = tags;
      } else if (f === 'metrics') {
        // metrics 格式: GMV:120000|ROAS:3.5|Spend:35000
        try {
          const metrics = String(v).split('|').map((pair) => {
            const [label, value] = pair.split(':').map((s) => s.trim());
            return label ? { label, value: value ?? '' } : null;
          }).filter(Boolean);
          if (metrics.length) (data as Record<string, unknown>).metrics = metrics;
        } catch { /* ignore parse error */ }
      } else if (f === 'platforms') {
        // platforms 格式: JSON 数组字符串，或 platform:form;platform:form
        try {
          const json = JSON.parse(v);
          if (Array.isArray(json)) data.platforms = json;
        } catch {
          const platforms = String(v).split(';').map((pair) => {
            const [platform, form] = pair.split(':').map((s) => s.trim());
            return platform ? { platform, form: form ?? '' } : null;
          }).filter(Boolean);
          if (platforms.length) data.platforms = platforms;
        }
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

/** 下载 CSV 模板(表头对齐字段 + 两行示例：基础行 + 完整行)。 */
export function downloadTemplate(kind: DataKind): void {
  const fields = FIELDS[kind];
  const header = fields.join(',');
  const example =
    kind === 'campaign'
      ? 'camp-001,春季新品推广,示例品牌,FT,TikTok,2026-03-01,2026-03-31,$100K,Active,alex,cre-mia;cre-sofia,GMV:120000|ROAS:3.5|Spend:35000|Impressions:15M,TikTok:短视频;TikTok:直播'
      : 'cre-example,示例达人,@example,TikTok,mega,1.28M,8.7%,示例品类,US,,示例简介,示例标签1;示例标签2';
  const note =
    kind === 'campaign'
      ? '\n# metrics 格式: label:value|label:value (|分隔多个)\n# platforms 格式: platform:form;platform:form (;分隔多个)\n# creatorIds 格式: id1;id2;id3 (;分隔)\n# 必填字段: id,name,advertiser,businessLine,platform,startDate,endDate,budget'
      : '\n# tags 格式: tag1;tag2;tag3 (;分隔)\n# 必填字段: id,name,handle,platform,tier,followers,engagement,category,region';
  const csv = `${header}\n${example}\n${note}\n`;
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${kind}-template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
