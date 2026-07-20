/** 数据管理导入工具:字段定义、预览构造、模板下载。 */

export const CAMPAIGN_FIELDS = ['id', 'name', 'advertiser', 'businessLine', 'platform', 'startDate', 'endDate', 'budget', 'status', 'owner', 'creatorIds', 'metrics', 'platforms'] as const;
export const CAMPAIGN_REQUIRED = ['id', 'name', 'advertiser', 'businessLine', 'platform', 'startDate', 'endDate', 'budget'];
export const CREATOR_FIELDS = ['id', 'name', 'handle', 'platform', 'tier', 'followers', 'engagement', 'category', 'region', 'avatar', 'bio', 'tags'] as const;
export const CREATOR_REQUIRED = ['id', 'name', 'handle', 'platform', 'tier', 'followers', 'engagement', 'category', 'region'];

export type DataKind = 'campaign' | 'creator' | 'collaboration';

/** 合作导入：CSV 每行=一个 deliverable 或一条每日明细行。
 * 每日明细行: campaignId+creatorId+publishedAt 相同时，dailyDate 非空的行为该 deliverable 的 daily 明细。
 * 同一对 campaignId+creatorId 可有多条 deliverable（用 contentType + publishedAt 区分），
 * 每条 deliverable 又可有多行每日明细（dailyDate 不同）。 */
export const COLLAB_DELIVERABLE_FIELDS = [
  'campaignId', 'creatorId', 'contentType', 'publishedAt', 'platform',
  'metrics', 'execPrice', 'screenshots',
  'cpsLinkUrl', 'cpsClicks', 'cpsOrders', 'cpsGmv', 'cpsCommission',
  // ─── 每日明细行字段（dailyDate 非空时本行为明细行，上面的汇总字段被忽略）───
  'dailyDate', 'dailyImpressions', 'dailyLikes', 'dailyComments', 'dailyShares', 'dailySaves',
  'dailyCpsClicks', 'dailyCpsOrders', 'dailyCpsGmv', 'dailyCpsCommission',
] as const;
export const COLLAB_REQUIRED = ['campaignId', 'creatorId', 'contentType'];

const FIELDS: Record<DataKind, readonly string[]> = {
  campaign: CAMPAIGN_FIELDS,
  creator: CREATOR_FIELDS,
  collaboration: COLLAB_DELIVERABLE_FIELDS,
};
const REQUIRED: Record<DataKind, string[]> = {
  campaign: CAMPAIGN_REQUIRED,
  creator: CREATOR_REQUIRED,
  collaboration: COLLAB_REQUIRED,
};

export interface PreviewItem {
  data: Record<string, unknown>;
  valid: boolean;
  error?: string;
}

/** 预览表格展示的列(不含 owner/avatar 等次要字段)。 */
export const PREVIEW_COLUMNS: Record<DataKind, string[]> = {
  campaign: ['id', 'name', 'advertiser', 'businessLine', 'platform', 'startDate', 'endDate', 'budget', 'status'],
  creator: ['id', 'name', 'handle', 'platform', 'tier', 'followers', 'engagement', 'category', 'region'],
  collaboration: ['campaignId', 'creatorId', 'contentType', 'publishedAt', 'metrics', 'execPrice', 'dailyDate'],
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
        // metrics 格式: GMV:120000|ROAS:3.5|Spend:35000（campaign）
        // 或 曝光:850000|点赞:51000（collaboration deliverable）
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
      } else if (f === 'screenshots') {
        // screenshots 格式: url1;url2;url3（;分隔）
        const shots = String(v).split(';').map((s) => s.trim()).filter(Boolean);
        if (shots.length) data.screenshots = shots.map((src) => ({ src }));
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

/** 下载 CSV 模板(表头对齐字段 + 示例行 + 格式说明)。 */
export function downloadTemplate(kind: DataKind): void {
  const fields = FIELDS[kind];
  const header = fields.join(',');
  let example = '';
  let note = '';
  if (kind === 'campaign') {
    example = 'camp-001,春季新品推广,示例品牌,FT,TikTok,2026-03-01,2026-03-31,$100K,Active,alex,cre-mia;cre-sofia,GMV:120000|ROAS:3.5|Spend:35000|Impressions:15M,TikTok:短视频;TikTok:直播';
    note = '\n# metrics 格式: label:value|label:value (|分隔多个)\n# platforms 格式: platform:form;platform:form (;分隔多个)\n# creatorIds 格式: id1;id2;id3 (;分隔)\n# 必填字段: id,name,advertiser,businessLine,platform,startDate,endDate,budget';
  } else if (kind === 'creator') {
    example = 'cre-example,示例达人,@example,TikTok,mega,1.28M,8.7%,示例品类,US,,示例简介,示例标签1;示例标签2';
    note = '\n# tags 格式: tag1;tag2;tag3 (;分隔)\n# 必填字段: id,name,handle,platform,tier,followers,engagement,category,region';
  } else {
    // collaboration: 汇总行 + 每日明细行
    example = [
      // ── 汇总行（主行：含 metrics + execPrice + CPS 汇总）──
      'camp-001,cre-mia,video,2026-03-15,TikTok,曝光:850000|点赞:51000|评论:3200|转发:2800,67500,https://cdn.example.com/s1.jpg;https://cdn.example.com/s2.jpg,https://shop.example.com/cps/abc,12500,380,45000,4500,,,,,,,',
      // ── 每日明细行（dailyDate 非空→归入上面这个 deliverable 的 daily 数组）──
      'camp-001,cre-mia,video,2026-03-15,TikTok,,,,,,,,2026-03-15,120000,8000,500,300,200,1800,55,6500,650',
      'camp-001,cre-mia,video,2026-03-15,TikTok,,,,,,,,2026-03-16,85000,5200,320,200,150,1600,48,5800,580',
      'camp-001,cre-mia,video,2026-03-15,TikTok,,,,,,,,2026-03-17,60000,3800,250,150,100,1400,42,5200,520',
      // ── 第二个 deliverable（不同 contentType + publishedAt，无明细）──
      'camp-001,cre-mia,reels,2026-03-16,TikTok,曝光:420000|点赞:28000|评论:1500,32500,,,,,,,,,,,,,',
      // ── 另一个 creator 的 deliverable + CPS 汇总 ──
      'camp-001,cre-sofia,post,2026-03-18,Instagram,曝光:1200000|点赞:95000|评论:4100|收藏:12000,80000,https://cdn.example.com/ig.jpg,https://shop.example.com/cps/def,8900,215,28000,2800,,,,,,,',
    ].join('\n');
    note = [
      '# 每行=一个作品(deliverable)或一条每日明细行',
      '# 汇总行: campaignId+creatorId+contentType+publishedAt 相同的行自动归组为一条 deliverable',
      '# 每日明细行: dailyDate 非空时, 本行作为该 deliverable 的 daily 数组的一条明细',
      '#   明细行需填 campaignId+creatorId+contentType+publishedAt (与汇总行一致) + dailyDate + 各指标',
      '# metrics 格式: 指标名:数值|指标名:数值 (|分隔多个，如 曝光:850000|点赞:51000)',
      '# screenshots 格式: url1;url2;url3 (;分隔多个URL)',
      '# execPrice: 该作品的执行价(数字，单位元)',
      '# CPS 汇总(可选, 填了cpsClicks即启用): cpsLinkUrl链接 | cpsClicks点击 | cpsOrders订单 | cpsGmv成交额 | cpsCommission佣金',
      '#   CPS 仅填汇总量即可, 每日明细可填 dailyCps* 字段或留空(系统自动按 S 曲线拆分)',
      '# 必填字段: campaignId,creatorId,contentType',
    ].join('\n');
  }
  const csv = `${header}\n${example}\n${note}\n`;
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${kind}-template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
