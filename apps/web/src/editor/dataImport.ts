/** 数据管理导入工具:字段定义、预览构造、模板下载。
 *
 * 支持的导入类型:
 * - campaign:            Campaign 基础数据
 * - creator:             达人基础数据（含联系方式 + 报价 + 近90天数据）
 * - creatorAudience:     达人受众画像
 * - creatorWorks:        达人频道历史作品（含带货归因）
 * - collaboration:       合作汇总（一个作品一行，含 CPS 汇总 + 执行价格）
 * - collaborationDaily:  合作每日明细（互动数据）
 * - cps:                 CPS 链接效果汇总（一条 CPS 链接一行）
 * - cpsDaily:            CPS 链接每日明细
 */

// ─── Campaign ──────────────────────────────────────────────────────────────

export const CAMPAIGN_FIELDS = ['id', 'name', 'advertiser', 'businessLine', 'platform', 'startDate', 'endDate', 'budget', 'status', 'owner', 'creatorIds', 'metrics', 'platforms'] as const;
export const CAMPAIGN_REQUIRED = ['id', 'name', 'advertiser', 'businessLine', 'platform', 'startDate', 'endDate', 'budget'];

// ─── Creator 基础 ──────────────────────────────────────────────────────────

export const CREATOR_FIELDS = [
  'id', 'name', 'handle', 'platform', 'tier', 'followers', 'engagement', 'category', 'region',
  'avatar', 'profileUrl', 'bio', 'tags',
  // 近 90 天数据
  'recentPostsCount', 'engagementMedian',
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
  // 带货归因
  'attrClicks', 'attrOrders', 'attrGmv', 'attrCtr', 'attrCvr',
] as const;
export const CREATOR_WORKS_REQUIRED = ['creatorId', 'workId', 'title'];

// ─── Collaboration 汇总 ─────────────────────────────────────────────────────

export const COLLAB_DELIVERABLE_FIELDS = [
  'campaignId', 'creatorId', 'collabId',
  'contentType', 'contentFormat', 'publishedAt', 'platform', 'postUrl',
  'metrics', 'execPrice', 'currency', 'screenshots',
  // 达人基础信息（导入时自动 upsert 到 Creator 表）
  'creatorName', 'creatorAvatar', 'creatorHandle', 'creatorProfileUrl',
] as const;
export const COLLAB_REQUIRED = ['campaignId', 'creatorId', 'contentType'];

// ─── Collaboration 每日明细 ─────────────────────────────────────────────────

export const COLLAB_DAILY_FIELDS = [
  'campaignId', 'creatorId', 'collabId', 'contentType', 'publishedAt',
  'dailyDate', 'dailyImpressions', 'dailyLikes', 'dailyComments',
  'dailyShares', 'dailySaves',
] as const;
export const COLLAB_DAILY_REQUIRED = ['campaignId', 'creatorId', 'contentType', 'dailyDate'];

// ─── CPS 链接效果汇总（独立表，一条链接一行）──────────────────────────────

export const CPS_FIELDS = [
  'campaignId', 'creatorId', 'collabId', 'contentType',
  'linkUrl', 'clicks', 'impressions', 'orders',
  'gmv', 'commission', 'spend',
  'productName', 'category', 'market', 'promoName', 'promoType',
] as const;
export const CPS_REQUIRED = ['campaignId', 'creatorId', 'contentType'];

// ─── CPS 每日明细 ───────────────────────────────────────────────────────────

export const CPS_DAILY_FIELDS = [
  'campaignId', 'creatorId', 'collabId', 'contentType', 'date',
  'dailyClicks', 'dailyImpressions', 'dailyOrders',
  'dailyGmv', 'dailyCommission',
  'dailySpend', 'dailyNewCustomers',
] as const;
export const CPS_DAILY_REQUIRED = ['campaignId', 'creatorId', 'contentType', 'date'];

// ─── 类型定义 ──────────────────────────────────────────────────────────────

export type DataKind = 'campaign' | 'creator' | 'collaboration';
export type ImportKind = DataKind | 'creatorAudience' | 'creatorWorks' | 'collaborationDaily' | 'cps' | 'cpsDaily';

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
  cps: CPS_FIELDS,
  cpsDaily: CPS_DAILY_FIELDS,
};
const REQUIRED: Record<ImportKind, string[]> = {
  campaign: [...CAMPAIGN_REQUIRED],
  creator: [...CREATOR_REQUIRED],
  collaboration: [...COLLAB_REQUIRED],
  creatorAudience: [...CREATOR_AUDIENCE_REQUIRED],
  creatorWorks: [...CREATOR_WORKS_REQUIRED],
  collaborationDaily: [...COLLAB_DAILY_REQUIRED],
  cps: [...CPS_REQUIRED],
  cpsDaily: [...CPS_DAILY_REQUIRED],
};

/** 预览表格展示的列。 */
export const PREVIEW_COLUMNS: Record<ImportKind, string[]> = {
  campaign: ['id', 'name', 'advertiser', 'businessLine', 'platform', 'startDate', 'endDate', 'budget', 'status'],
  creator: ['id', 'name', 'handle', 'platform', 'tier', 'followers', 'engagement', 'category', 'region', 'profileUrl'],
  collaboration: ['campaignId', 'creatorId', 'collabId', 'contentType', 'contentFormat', 'publishedAt', 'metrics', 'execPrice', 'currency'],
  creatorAudience: ['creatorId', 'genderMale', 'genderFemale', 'age18_24', 'age25_34', 'topCity1'],
  creatorWorks: ['creatorId', 'workId', 'title', 'platform', 'publishedAt', 'impressions', 'likes', 'engagementRate'],
  collaborationDaily: ['campaignId', 'creatorId', 'collabId', 'contentType', 'dailyDate', 'dailyImpressions'],
  cps: ['campaignId', 'creatorId', 'collabId', 'contentType', 'linkUrl', 'clicks', 'orders', 'gmv', 'commission', 'productName', 'category', 'market', 'promoName', 'promoType'],
  cpsDaily: ['campaignId', 'creatorId', 'collabId', 'contentType', 'date', 'dailyClicks', 'dailyOrders', 'dailyGmv', 'dailySpend', 'dailyNewCustomers'],
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

/** P1-12: 逐字段中文批注（含义 + 格式要求），让下载模板更易懂。 */
function getFieldComments(kind: ImportKind): Record<string, string> {
  const base: Record<string, string> = {
    id: '唯一ID（字母+数字，如 camp-001）',
    name: '名称',
    advertiser: '广告主名称',
    businessLine: '业务线编码（FT/SM/CX/DG/KN/DM）',
    platform: '主要平台（TikTok/Instagram/YouTube/小红书等）',
    platforms: '投放平台:内容形式;平台:形式（;分隔多个，如 TikTok:短视频;YouTube:直播）',
    startDate: '开始日期 YYYY-MM-DD',
    endDate: '结束日期 YYYY-MM-DD',
    budget: '预算（含币种符号，如 $300K 或 ¥500000）',
    status: '状态（not_started/in_progress/completed/paused/cancelled）',
    owner: '归属者（团队成员ID）',
    creatorIds: '关联达人ID列表（;分隔，如 cre-mia;cre-sofia）',
    metrics: '指标数据 label:value|label:value（|分隔，如 GMV:120000|ROAS:3.5）',
    handle: '社交媒体 Handle（如 @example）',
    tier: '层级（S/A/B/C/D）',
    followers: '粉丝数（如 1.28M 或 1280000）',
    engagement: '互动率（百分比，如 8.7%）',
    category: '品类（美妆/服饰/3C/食品等）',
    region: '地区/国家代码（US/CN/JP等）',
    avatar: '头像图片URL',
    profileUrl: '主页链接',
    bio: '个人简介',
    tags: '标签（;分隔）',
    recentPostsCount: '近90天发帖数',
    engagementMedian: '近90天互动中位数',
    mcn: 'MCN机构',
    agency: '经纪公司',
    email: '邮箱',
    phone: '电话',
    contactPerson: '联系人',
    currency: '报价币种（USD/CNY/EUR/JPY）',
    ratePost: '图文报价',
    rateVideo: '视频报价',
    rateLive: '直播报价',
    rateNote: '报价备注',
  };
  if (kind === 'creatorAudience' || kind === 'creatorWorks') {
    return {
      ...base,
      creatorId: '关联的达人ID',
      genderMale: '男性受众占比（0-100）',
      genderFemale: '女性受众占比（0-100）',
      workId: '作品唯一ID',
      title: '作品标题',
      cover: '作品封面URL',
      url: '作品链接',
      publishedAt: '发布日期 YYYY-MM-DD',
      impressions: '曝光/播放量',
      likes: '点赞数',
      comments: '评论数',
      shares: '转发/分享数',
      saves: '收藏数',
      engagementRate: '互动率%',
      contentType: '内容类型（post/video/reels/live等）',
      hashtags: '话题标签（;分隔）',
      productLink: '商品链接（带货内容）',
      duration: '时长（MM:SS）',
      featured: '是否精选（yes/no）',
    };
  }
  if (kind === 'collaboration' || kind === 'collaborationDaily' || kind === 'cps' || kind === 'cpsDaily') {
    return {
      ...base,
      campaignId: '关联Campaign的ID',
      creatorId: '关联达人ID',
      collabId: '合作分组ID（同次合作多内容共享）',
      contentType: '内容类型（post/reels/video/image/live/story）',
      contentFormat: '内容形式（短视频/图文/直播切片等）',
      postUrl: '作品链接',
      screenshots: '作品截图URL（;分隔）',
      execPrice: '执行价格',
      clicks: '点击数',
      impressions: '曝光数',
      orders: '订单数',
      gmv: 'GMV成交额',
      commission: '佣金收入',
      spend: '品牌侧花费',
      roas: 'ROAS（GMV÷花费）',
      ctr: '点击率%',
      cvr: '转化率%',
      epc: 'EPC单次点击产出',
      date: '日期 YYYY-MM-DD',
      dailyDate: '日期 YYYY-MM-DD',
    };
  }
  return base;
}

/** 下载 CSV 模板(表头含必填/选填标注 + 示例行 + 逐字段批注说明)。 */
export function downloadTemplate(kind: ImportKind): void {
  const fields = FIELDS[kind] as readonly string[];
  const requiredList = REQUIRED[kind] as readonly string[];
  const requiredSet = new Set(requiredList);

  // P1-12: 表头标注必填(* ) / 选填
  const headerLabels = fields.map((f) => (requiredSet.has(f) ? `${f}*` : f));
  const header = headerLabels.join(',');

  // P1-12: 字段批注（含义 + 格式要求），按 kind 差异化
  const fieldComments: Record<string, string> = getFieldComments(kind);
  let example = '';
  let note = '';

  if (kind === 'campaign') {
    example = 'camp-001,春季新品推广,示例品牌,FT,TikTok,2026-03-01,2026-03-31,$100K,Active,alex,cre-mia;cre-sofia,GMV:120000|ROAS:3.5|Spend:35000|Impressions:15M,TikTok:短视频;TikTok:直播';
    note = '\n# metrics 格式: label:value|label:value (|分隔多个)\n# platforms 格式: platform:form;platform:form (;分隔多个)\n# creatorIds 格式: id1;id2;id3 (;分隔)\n# 必填字段: id,name,advertiser,businessLine,platform,startDate,endDate,budget';
  } else if (kind === 'creator') {
    example = 'cre-example,示例达人,@example,TikTok,mega,1.28M,8.7%,示例品类,US,https://cdn.example.com/avatar.jpg,https://tiktok.com/@example,示例简介,标签1;标签2,52,6.8%,示例MCN,示例Agency,contact@example.com,+1-555-0100,联系人小王,USD,5000,8000,15000,报价备注';
    note = '\n# tags 格式: tag1;tag2;tag3 (;分隔)\n# recentPostsCount: 近90天新发作品数\n# engagementMedian: 近90天互动中位数\n# 报价: currency=币种, ratePost=图文报价, rateVideo=视频报价, rateLive=直播报价, rateNote=备注\n# 必填字段: id,name,handle,platform,tier,followers,engagement,category,region';
  } else if (kind === 'creatorAudience') {
    example = [
      'cre-example,45,55,5,38,42,12,3,New York,15,Los Angeles,8,Chicago,4',
    ].join('\n');
    note = '\n# 性别: genderMale+genderFemale=100\n# 年龄: age13_17+age18_24+age25_34+age35_44+age45_64=100\n# 城市: topCity1+Pct, topCity2+Pct, topCity3+Pct\n# 数值均为百分比(0-100)\n# 必填字段: creatorId';
  } else if (kind === 'creatorWorks') {
    example = [
      'cre-example,work-001,品牌合作短视频,https://cdn.example.com/cover1.jpg,https://tiktok.com/@example/video/123,TikTok,2026-03-15,850000,51000,3200,2800,1500,6.5%,video,品牌词1;品牌词2,https://shop.example.com/product,00:45,yes,3200,156,28000,4.2%,4.9%',
      'cre-example,work-002,日常分享,https://cdn.example.com/cover2.jpg,https://tiktok.com/@example/video/456,TikTok,2026-02-20,420000,28000,1500,800,600,7.2%,post,,,00:00,no,,,,,',
    ].join('\n');
    note = '\n# hashtags 格式: tag1;tag2;tag3 (;分隔)\n# featured: true/false (或 yes/no, 1/0)\n# 带货归因(可选): attrClicks=点击, attrOrders=订单, attrGmv=GMV, attrCtr=CTR%, attrCvr=CVR%\n# 必填字段: creatorId,workId,title';
  } else if (kind === 'collaboration') {
    example = [
      'camp-001,cre-mia,collab-001,video,短视频,2026-03-15,TikTok,https://tiktok.com/@mia/video/100,曝光:850000|点赞:51000|评论:3200|转发:2800,67500,USD,https://cdn.example.com/s1.jpg;https://cdn.example.com/s2.jpg,米娅,https://cdn.example.com/mia.jpg,@mia,https://tiktok.com/@mia',
      'camp-001,cre-sofia,collab-002,post,图文,2026-03-18,Instagram,https://instagram.com/p/xyz,曝光:1200000|点赞:95000|评论:4100|收藏:12000,80000,USD,https://cdn.example.com/ig.jpg,索菲亚,https://cdn.example.com/sofia.jpg,@sofia,https://instagram.com/sofia',
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
      '# CPS 链接效果请用独立 CPS 导入(非本表)',
      '# 必填字段: campaignId,creatorId,contentType',
    ].join('\n');
  } else if (kind === 'collaborationDaily') {
    example = [
      'camp-001,cre-mia,collab-001,video,2026-03-15,2026-03-15,120000,8000,500,300,200',
      'camp-001,cre-mia,collab-001,video,2026-03-15,2026-03-16,85000,5200,320,200,150',
      'camp-001,cre-mia,collab-001,video,2026-03-15,2026-03-17,60000,3800,250,150,100',
    ].join('\n');
    note = [
      '# 每行=一条每日明细数据',
      '# 关联键: campaignId+creatorId+collabId+contentType+publishedAt → 对应合作汇总中的作品',
      '# 必填字段: campaignId,creatorId,contentType,dailyDate',
    ].join('\n');
  } else if (kind === 'cps') {
    example = [
      'camp-001,cre-mia,collab-001,video,https://shop.example.com/cps/abc,12500,375000,380,45000,4500,4860',
      'camp-001,cre-sofia,collab-002,post,https://shop.example.com/cps/def,8900,267000,215,28000,2800,3024',
    ].join('\n');
    note = [
      '# 每行=一条 CPS 跟踪链接的汇总数据',
      '# 关联键: campaignId+creatorId+contentType → 自动 upsert 到 CpsPerformance 表',
      '# collabId: 关联的合作分组ID（可选）',
      '# linkUrl: CPS 跟踪链接 URL',
      '# clicks/impressions/orders: 点击/曝光/订单',
      '# gmv/commission/spend: GMV/佣金/花费(品牌侧成本)',
      '# 必填字段: campaignId,creatorId,contentType',
    ].join('\n');
  } else { // cpsDaily
    example = [
      'camp-001,cre-mia,collab-001,video,2026-03-15,1800,54000,55,6500,650,180,12',
      'camp-001,cre-mia,collab-001,video,2026-03-16,1600,48000,48,5800,580,150,10',
      'camp-001,cre-mia,collab-001,video,2026-03-17,1400,42000,42,5200,520,130,8',
    ].join('\n');
    note = [
      '# 每行=一条 CPS 链接在某天的归因数据',
      '# 关联键: campaignId+creatorId+contentType+date → 合并到 CpsPerformance.daily JSON',
      '# 必填字段: campaignId,creatorId,contentType,date',
    ].join('\n');
  }

  // P1-12: 在 note 后追加逐字段批注
  const commentsBlock = fields
    .map((f) => {
      const reqTag = requiredSet.has(f) ? '[必填]' : '[选填]';
      const comment = fieldComments[f] ?? '';
      return `# ${f} ${reqTag}: ${comment}`;
    })
    .join('\n');

  const csv = `${header}\n${example}\n${note}\n${commentsBlock}\n`;
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${kind}-template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
