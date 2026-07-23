/** 数据管理导入工具:字段定义、预览构造、模板下载。
 *
 * 支持的导入类型:
 * - campaign:       Campaign 基础数据
 * - creator:        达人基础数据（含联系方式 + 报价）
 * - creatorAudience: 达人受众画像
 * - creatorWorks:   达人频道历史作品
 * - collaboration:  合作汇总（一个作品一行，含 CPS 汇总 + 执行价格）
 * - collaborationDaily: 合作每日明细
 */

// ─── Campaign ──────────────────────────────────────────────────────────────

export const CAMPAIGN_FIELDS = ['id', 'name', 'advertiser', 'businessLine', 'platform', 'startDate', 'endDate', 'budget', 'status', 'owner', 'creatorIds', 'metrics', 'platforms'] as const;
export const CAMPAIGN_REQUIRED = ['id', 'name', 'advertiser', 'businessLine', 'platform', 'startDate', 'endDate', 'budget'];

// ─── Creator 基础 ──────────────────────────────────────────────────────────

export const CREATOR_FIELDS = [
  'id', 'name', 'handle', 'platform', 'tier', 'followers', 'engagement', 'category', 'region',
  'avatar', 'profileUrl', 'bio', 'tags',
  // 联系方式
  'mcn', 'agency', 'email', 'phone', 'contactPerson',
  // 报价
  'currency', 'ratePost', 'rateVideo', 'rateLive', 'rateNote',
] as const;
export const CREATOR_REQUIRED = ['id', 'name', 'handle', 'platform', 'tier', 'followers', 'engagement', 'category', 'region'];

// ─── Creator 受众画像 ───────────────────────────────────────────────────────

export const CREATOR_AUDIENCE_FIELDS = [
  'creatorId', 'genderMale', 'genderFemale',
  'age13_17', 'age18_24', 'age25_34', 'age35_44', 'age45_64',
  'topCity1', 'topCity1Pct', 'topCity2', 'topCity2Pct', 'topCity3', 'topCity3Pct',
] as const;
export const CREATOR_AUDIENCE_REQUIRED = ['creatorId'];

// ─── Creator 作品 ──────────────────────────────────────────────────────────

export const CREATOR_WORKS_FIELDS = [
  'creatorId', 'workId', 'title', 'cover', 'url', 'platform',
  'publishedAt', 'impressions', 'likes', 'comments', 'shares', 'saves',
  'engagementRate', 'contentType', 'hashtags', 'productLink',
  'duration', 'featured',
] as const;
export const CREATOR_WORKS_REQUIRED = ['creatorId', 'workId', 'title'];

// ─── Collaboration 汇总 ─────────────────────────────────────────────────────

export const COLLAB_DELIVERABLE_FIELDS = [
  'campaignId', 'creatorId', 'collabId',
  'contentType', 'contentFormat', 'publishedAt', 'platform', 'postUrl',
  'metrics', 'execPrice', 'currency', 'screenshots',
  // 达人基础信息（导入时自动 upsert 到 Creator 表）
  'creatorName', 'creatorAvatar', 'creatorHandle', 'creatorProfileUrl',
  // CPS 汇总
  'cpsLinkUrl', 'cpsClicks', 'cpsOrders', 'cpsGmv', 'cpsCommission',
] as const;
export const COLLAB_REQUIRED = ['campaignId', 'creatorId', 'contentType'];

// ─── Collaboration 每日明细 ─────────────────────────────────────────────────

export const COLLAB_DAILY_FIELDS = [
  'campaignId', 'creatorId', 'collabId', 'contentType', 'publishedAt',
  'dailyDate', 'dailyImpressions', 'dailyLikes', 'dailyComments',
  'dailyShares', 'dailySaves',
  'dailyCpsClicks', 'dailyCpsOrders', 'dailyCpsGmv', 'dailyCpsCommission',
] as const;
export const COLLAB_DAILY_REQUIRED = ['campaignId', 'creatorId', 'contentType', 'dailyDate'];

// ─── 类型定义 ──────────────────────────────────────────────────────────────

export type DataKind = 'campaign' | 'creator' | 'collaboration';
export type ImportKind = DataKind | 'creatorAudience' | 'creatorWorks' | 'collaborationDaily';

export interface PreviewItem {
  data: Record<string, unknown>;
  valid: boolean;
  error?: string;
}

const FIELDS: Record<ImportKind, readonly string[]> = {
  campaign: CAMPAIGN_FIELDS,
  creator: CREATOR_FIELDS,
  collaboration: COLLAB_DELIVERABLE_FIELDS,
  creatorAudience: CREATOR_AUDIENCE_FIELDS,
  creatorWorks: CREATOR_WORKS_FIELDS,
  collaborationDaily: COLLAB_DAILY_FIELDS,
};
const REQUIRED: Record<ImportKind, string[]> = {
  campaign: [...CAMPAIGN_REQUIRED],
  creator: [...CREATOR_REQUIRED],
  collaboration: [...COLLAB_REQUIRED],
  creatorAudience: [...CREATOR_AUDIENCE_REQUIRED],
  creatorWorks: [...CREATOR_WORKS_REQUIRED],
  collaborationDaily: [...COLLAB_DAILY_REQUIRED],
};

/** 预览表格展示的列。 */
export const PREVIEW_COLUMNS: Record<ImportKind, string[]> = {
  campaign: ['id', 'name', 'advertiser', 'businessLine', 'platform', 'startDate', 'endDate', 'budget', 'status'],
  creator: ['id', 'name', 'handle', 'platform', 'tier', 'followers', 'engagement', 'category', 'region', 'profileUrl'],
  collaboration: ['campaignId', 'creatorId', 'collabId', 'contentType', 'contentFormat', 'publishedAt', 'metrics', 'execPrice', 'currency'],
  creatorAudience: ['creatorId', 'genderMale', 'genderFemale', 'age18_24', 'age25_34', 'topCity1'],
  creatorWorks: ['creatorId', 'workId', 'title', 'platform', 'publishedAt', 'impressions', 'likes', 'engagementRate'],
  collaborationDaily: ['campaignId', 'creatorId', 'collabId', 'contentType', 'dailyDate', 'dailyImpressions', 'dailyCpsGmv'],
};

function checkRequired(kind: ImportKind, data: Record<string, unknown>): string[] {
  return REQUIRED[kind].filter((f) => data[f] === undefined || data[f] === '');
}

/** CSV/XLSX 行(Record<string,string>)→ 按表头取核心字段,校验必填。 */
export function buildPreviewFromRows(kind: ImportKind, rows: Record<string, string>[]): PreviewItem[] {
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
      } else if (f === 'hashtags') {
        const tags = String(v).split(';').map((s) => s.trim()).filter(Boolean);
        if (tags.length) data.hashtags = tags;
      } else if (f === 'metrics') {
        try {
          const metrics = String(v).split('|').map((pair) => {
            const [label, value] = pair.split(':').map((s) => s.trim());
            return label ? { label, value: value ?? '' } : null;
          }).filter(Boolean);
          if (metrics.length) (data as Record<string, unknown>).metrics = metrics;
        } catch { /* ignore parse error */ }
      } else if (f === 'platforms') {
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
        const shots = String(v).split(';').map((s) => s.trim()).filter(Boolean);
        if (shots.length) data.screenshots = shots.map((src) => ({ src }));
      } else if (f === 'featured') {
        data.featured = v === 'true' || v === '1' || v === 'yes';
      } else {
        data[f] = v;
      }
    }
    const missing = checkRequired(kind, data);
    return missing.length ? { data, valid: false, error: `缺字段: ${missing.join(', ')}` } : { data, valid: true };
  });
}

/** JSON 项(已是完整对象)→ 只校验必填,保留完整对象。 */
export function buildPreviewFromObjects(kind: ImportKind, items: unknown[]): PreviewItem[] {
  return items.map((item) => {
    const data = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const missing = checkRequired(kind, data);
    return missing.length ? { data, valid: false, error: `缺字段: ${missing.join(', ')}` } : { data, valid: true };
  });
}

/** 下载 CSV 模板(表头对齐字段 + 示例行 + 格式说明)。 */
export function downloadTemplate(kind: ImportKind): void {
  const fields = FIELDS[kind];
  const header = fields.join(',');
  let example = '';
  let note = '';

  if (kind === 'campaign') {
    example = 'camp-001,春季新品推广,示例品牌,FT,TikTok,2026-03-01,2026-03-31,$100K,Active,alex,cre-mia;cre-sofia,GMV:120000|ROAS:3.5|Spend:35000|Impressions:15M,TikTok:短视频;TikTok:直播';
    note = '\n# metrics 格式: label:value|label:value (|分隔多个)\n# platforms 格式: platform:form;platform:form (;分隔多个)\n# creatorIds 格式: id1;id2;id3 (;分隔)\n# 必填字段: id,name,advertiser,businessLine,platform,startDate,endDate,budget';
  } else if (kind === 'creator') {
    example = 'cre-example,示例达人,@example,TikTok,mega,1.28M,8.7%,示例品类,US,https://cdn.example.com/avatar.jpg,https://tiktok.com/@example,示例简介,标签1;标签2,示例MCN,示例Agency,contact@example.com,+1-555-0100,联系人小王,USD,5000,8000,15000,报价备注';
    note = '\n# tags 格式: tag1;tag2;tag3 (;分隔)\n# 报价: currency=币种, ratePost=图文报价, rateVideo=视频报价, rateLive=直播报价, rateNote=备注\n# 必填字段: id,name,handle,platform,tier,followers,engagement,category,region';
  } else if (kind === 'creatorAudience') {
    example = [
      'cre-example,45,55,5,38,42,12,3,New York,15,Los Angeles,8,Chicago,4',
    ].join('\n');
    note = '\n# 性别: genderMale+genderFemale=100\n# 年龄: age13_17+age18_24+age25_34+age35_44+age45_64=100\n# 城市: topCity1+Pct, topCity2+Pct, topCity3+Pct\n# 数值均为百分比(0-100)\n# 必填字段: creatorId';
  } else if (kind === 'creatorWorks') {
    example = [
      'cre-example,work-001,品牌合作短视频,https://cdn.example.com/cover1.jpg,https://tiktok.com/@example/video/123,TikTok,2026-03-15,850000,51000,3200,2800,1500,6.5%,video,品牌词1;品牌词2,https://shop.example.com/product,00:45,yes',
      'cre-example,work-002,日常分享,https://cdn.example.com/cover2.jpg,https://tiktok.com/@example/video/456,TikTok,2026-02-20,420000,28000,1500,800,600,7.2%,post,,,00:00,no',
    ].join('\n');
    note = '\n# hashtags 格式: tag1;tag2;tag3 (;分隔)\n# featured: true/false (或 yes/no, 1/0)\n# 必填字段: creatorId,workId,title';
  } else if (kind === 'collaboration') {
    // 合作汇总：一个作品一行
    example = [
      'camp-001,cre-mia,collab-001,video,短视频,2026-03-15,TikTok,https://tiktok.com/@mia/video/100,曝光:850000|点赞:51000|评论:3200|转发:2800,67500,USD,https://cdn.example.com/s1.jpg;https://cdn.example.com/s2.jpg,米娅,https://cdn.example.com/mia.jpg,@mia,https://tiktok.com/@mia,https://shop.example.com/cps/abc,12500,380,45000,4500',
      'camp-001,cre-mia,collab-001,reels,图文,2026-03-16,TikTok,https://tiktok.com/@mia/reels/200,曝光:420000|点赞:28000|评论:1500,32500,USD,,,,米娅,,,,,,',
      'camp-001,cre-sofia,collab-002,post,图文,2026-03-18,Instagram,https://instagram.com/p/xyz,曝光:1200000|点赞:95000|评论:4100|收藏:12000,80000,USD,https://cdn.example.com/ig.jpg,索菲亚,https://cdn.example.com/sofia.jpg,@sofia,https://instagram.com/sofia,https://shop.example.com/cps/def,8900,215,28000,2800',
    ].join('\n');
    note = [
      '# 每行=一个作品(deliverable)',
      '# collabId: 合作分组ID — 同一次合作含多个 contentType 的行共享同一个 collabId',
      '# contentType: post/reels/video/image/live/story',
      '# contentFormat: 短视频/图文/直播切片/合集/UGC (描述具体形式)',
      '# currency: 合作价格币种 (USD/CNY/EUR...), 默认 USD',
      '# creatorName/Avatar/Handle/ProfileUrl: 导入时自动 upsert 到达人库',
      '# metrics 格式: 指标名:数值|指标名:数值 (|分隔)',
      '# screenshots 格式: url1;url2;url3 (;分隔)',
      '# CPS 汇总(可选): cpsLinkUrl|cpsClicks|cpsOrders|cpsGmv|cpsCommission',
      '# 必填字段: campaignId,creatorId,contentType',
    ].join('\n');
  } else { // collaborationDaily
    example = [
      'camp-001,cre-mia,collab-001,video,2026-03-15,2026-03-15,120000,8000,500,300,200,1800,55,6500,650',
      'camp-001,cre-mia,collab-001,video,2026-03-15,2026-03-16,85000,5200,320,200,150,1600,48,5800,580',
      'camp-001,cre-mia,collab-001,video,2026-03-15,2026-03-17,60000,3800,250,150,100,1400,42,5200,520',
    ].join('\n');
    note = [
      '# 每行=一条每日明细数据',
      '# 关联键: campaignId+creatorId+collabId+contentType+publishedAt → 对应合作汇总中的作品',
      '# 必填字段: campaignId,creatorId,contentType,dailyDate',
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
