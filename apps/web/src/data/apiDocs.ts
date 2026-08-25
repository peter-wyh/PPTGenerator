/**
 * 上游数据接口文档 —— 单一事实源（Single Source of Truth）。
 *
 * 维护约定：
 * 1. 本文件如实描述 /api/v1/campaigns 下导入接口与数据管理接口的当前契约，
 *    内容以 apps/server/src/modules/campaigns/ 下的 service / controller / routes 实现为准。
 * 2. 每次接口变更（加字段/改语义/新接口），同步修改本文件对应区块，
 *    并在 API_DOC_CHANGELOG 顶部追加一条变更记录（升 API_DOC_VERSION）。
 * 3. 页面 /data/api-docs 直接渲染本文件，无需其他操作。
 */

export interface DocField {
  name: string;
  type: string;
  required: boolean;
  desc: string;
}

export interface DocEndpoint {
  id: string;
  method: 'POST' | 'GET';
  path: string;
  title: string;
  purpose: string;
  source: string;
  prerequisites: string[];
  /** 前置依赖短文案（总览表用；null=无前置） */
  prerequisiteSummary: string | null;
  semantics: string[];
  fields: DocField[];
  requestExample: string;
  response: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: { kind: '新增' | '变更' | '修复' | '下线'; text: string }[];
}

export const API_DOC_VERSION = '1.2.0';
export const API_DOC_UPDATED = '2026-08-25';

export const API_DOC_CONVENTIONS = [
  'Base URL：http://<server>:4000/api/v1（生产环境以部署域名为准）。',
  '鉴权：所有接口需登录态。调用 POST /auth/login（账号+密码）取得 accessToken 后，以请求头 Authorization 携带 Bearer 凭据访问。',
  '请求体：统一 { "items": [ { … }, { … } ] } 批量包裹，单次建议 ≤ 500 行，超出分批提交。',
  '日期字段：YYYY-MM-DD（date-only）；金额字段：纯数字或带 $ / 千分位的字符串均可（服务端自动清洗）。',
  '响应统一形状：{ created?, updated, skipped }——skipped 为被跳过的行数（必填缺失 / 前置数据不存在 / 行级异常，不影响其他行）。',
  '所有接口幂等可重放：重复提交同一批数据不会产生重复记录（各接口合并键见下文语义说明）。',
];

export const API_DOC_ENDPOINTS: DocEndpoint[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'creators',
    method: 'POST',
    path: '/campaigns/import/creators',
    title: '达人基础数据',
    purpose: '建立/更新达人主档：身份、平台、粉丝量级、报价、联系方式。是其他达人数据（画像/作品）的前置。',
    source: '达人商务台账 / MCN 名单 / 各平台达人主页后台导出。',
    prerequisites: ['无前置——可直接导入，作为整条数据链路的起点。'],
    prerequisiteSummary: null,
    semantics: [
      '合并键：id（达人唯一稳定主键，须与后续所有接口的 creatorId 一致）。',
      '语义：upsert——id 已存在则全量更新该达人档案，不存在则创建。',
      'id 或 name 缺失的行直接 skipped。',
    ],
    fields: [
      { name: 'id', type: 'string', required: true, desc: '达人唯一 ID（上游系统的稳定主键）' },
      { name: 'name', type: 'string', required: true, desc: '达人名称/昵称' },
      { name: 'handle', type: 'string', required: false, desc: '平台账号 handle（如 @leo.sato）' },
      { name: 'platform', type: 'string', required: false, desc: '主平台（TikTok / Instagram / YouTube…）' },
      { name: 'tier', type: 'string', required: false, desc: '达人层级（如 Nano / Micro / Macro）' },
      { name: 'followers', type: 'string', required: false, desc: '粉丝数（数字字符串，如 "128000"）' },
      { name: 'engagement', type: 'string', required: false, desc: '互动率（如 "5.2%"）' },
      { name: 'category', type: 'string', required: false, desc: '内容垂类（美妆/健身/家居…）' },
      { name: 'region', type: 'string', required: false, desc: '主要市场/地区（如 US / JP）' },
      { name: 'avatar', type: 'string', required: false, desc: '头像 URL' },
      { name: 'profileUrl', type: 'string', required: false, desc: '主页链接' },
      { name: 'bio', type: 'string', required: false, desc: '简介' },
      { name: 'mcn', type: 'string', required: false, desc: '所属 MCN' },
      { name: 'agency', type: 'string', required: false, desc: '经纪公司' },
      { name: 'email', type: 'string', required: false, desc: '联系邮箱' },
      { name: 'phone', type: 'string', required: false, desc: '联系电话' },
      { name: 'contactPerson', type: 'string', required: false, desc: '对接人' },
      { name: 'currency', type: 'string', required: false, desc: '报价币种（USD / CNY…）' },
      { name: 'ratePost', type: 'string', required: false, desc: '图文报价' },
      { name: 'rateVideo', type: 'string', required: false, desc: '视频报价' },
      { name: 'rateLive', type: 'string', required: false, desc: '直播报价' },
      { name: 'rateNote', type: 'string', required: false, desc: '笔记报价' },
      { name: 'recentPostsCount', type: 'number', required: false, desc: '近 90 天发帖数' },
      { name: 'engagementMedian', type: 'string', required: false, desc: '近 90 天互动中位数' },
    ],
    requestExample: `{
  "items": [
    {
      "id": "creator-leo-sato",
      "name": "Leo Sato",
      "handle": "@leo.sato",
      "platform": "TikTok",
      "tier": "Micro",
      "followers": "128000",
      "engagement": "5.2%",
      "category": "Beauty",
      "region": "JP",
      "mcn": "Sakura Media",
      "currency": "USD",
      "rateVideo": "1200",
      "recentPostsCount": 24,
      "engagementMedian": "6100"
    }
  ]
}`,
    response: '{ "created": 1, "updated": 0, "skipped": 0 }',
  },
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'creator-audience',
    method: 'POST',
    path: '/campaigns/import/creator-audience',
    title: '达人受众画像',
    purpose: '补充达人的受众结构：性别分布 / 年龄段分布 / Top 城市——用于报告中的达人匹配度分析。',
    source: '平台达人后台（TikTok Creator Marketplace / Instagram Insights）受众数据导出。',
    prerequisites: ['达人主档已导入（creators 接口，同一 creatorId）。'],
    prerequisiteSummary: '达人主档',
    semantics: [
      '按 creatorId 定位达人；不存在（或不属于当前账号）则 skipped。',
      'merge 语义：genderSplit / ageRange / topCities 三段整体覆盖，其余画像字段保留。',
      '百分比为数值（0-100），非小数。',
    ],
    fields: [
      { name: 'creatorId', type: 'string', required: true, desc: '达人 ID（与 creators.id 一致）' },
      { name: 'genderMale', type: 'number', required: false, desc: '男性占比 %（如 22）' },
      { name: 'genderFemale', type: 'number', required: false, desc: '女性占比 %（如 78）' },
      { name: 'age13_17', type: 'number', required: false, desc: '13-17 岁占比 %' },
      { name: 'age18_24', type: 'number', required: false, desc: '18-24 岁占比 %' },
      { name: 'age25_34', type: 'number', required: false, desc: '25-34 岁占比 %' },
      { name: 'age35_44', type: 'number', required: false, desc: '35-44 岁占比 %' },
      { name: 'age45_64', type: 'number', required: false, desc: '45-64 岁占比 %' },
      { name: 'topCity1', type: 'string', required: false, desc: 'Top1 城市名（如 Tokyo）' },
      { name: 'topCity1Pct', type: 'number', required: false, desc: 'Top1 城市占比 %' },
      { name: 'topCity2', type: 'string', required: false, desc: 'Top2 城市名' },
      { name: 'topCity2Pct', type: 'number', required: false, desc: 'Top2 城市占比 %' },
      { name: 'topCity3', type: 'string', required: false, desc: 'Top3 城市名' },
      { name: 'topCity3Pct', type: 'number', required: false, desc: 'Top3 城市占比 %' },
    ],
    requestExample: `{
  "items": [
    {
      "creatorId": "creator-leo-sato",
      "genderMale": 22,
      "genderFemale": 78,
      "age18_24": 35,
      "age25_34": 42,
      "age35_44": 15,
      "topCity1": "Tokyo",
      "topCity1Pct": 28,
      "topCity2": "Osaka",
      "topCity2Pct": 12,
      "topCity3": "Nagoya",
      "topCity3Pct": 6
    }
  ]
}`,
    response: '{ "updated": 1, "skipped": 0 }',
  },
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'creator-works',
    method: 'POST',
    path: '/campaigns/import/creator-works',
    title: '达人作品',
    purpose: '导入达人合作发布的作品（视频/图文）及其内容表现与带货归因——用于报告的作品案例区。',
    source: '达人交付清单 + 平台作品数据（播放/点赞/评论），hashtags 用分号分隔。',
    prerequisites: ['达人主档已导入（同一 creatorId）。'],
    prerequisiteSummary: '达人主档',
    semantics: [
      '按 (creatorId, workId) 去重 merge：同 workId 再次导入则覆盖该条作品，其余作品保留。',
      'featured 接受 true / 1 / yes（字符串或布尔）。',
      'hashtags 为分号分隔字符串（如 "skincare;serum"），服务端拆为数组。',
    ],
    fields: [
      { name: 'creatorId', type: 'string', required: true, desc: '达人 ID' },
      { name: 'workId', type: 'string', required: true, desc: '作品唯一 ID（上游系统的作品标识/链接指纹）' },
      { name: 'title', type: 'string', required: true, desc: '作品标题' },
      { name: 'cover', type: 'string', required: false, desc: '封面图 URL' },
      { name: 'url', type: 'string', required: false, desc: '作品链接' },
      { name: 'platform', type: 'string', required: false, desc: '发布平台' },
      { name: 'publishedAt', type: 'string', required: false, desc: '发布时间' },
      { name: 'impressions', type: 'string', required: false, desc: '曝光/播放量' },
      { name: 'likes', type: 'string', required: false, desc: '点赞数' },
      { name: 'comments', type: 'string', required: false, desc: '评论数' },
      { name: 'shares', type: 'string', required: false, desc: '分享数' },
      { name: 'saves', type: 'string', required: false, desc: '收藏数' },
      { name: 'engagementRate', type: 'string', required: false, desc: '互动率（如 "6.1%"）' },
      { name: 'contentType', type: 'string', required: false, desc: '内容类型（video / post / live…）' },
      { name: 'hashtags', type: 'string', required: false, desc: '话题标签，分号分隔' },
      { name: 'productLink', type: 'string', required: false, desc: '带货商品链接' },
      { name: 'duration', type: 'string', required: false, desc: '时长（视频）' },
      { name: 'featured', type: 'string', required: false, desc: '是否精选（true/1/yes）' },
      { name: 'attrClicks', type: 'string', required: false, desc: '归因点击数' },
      { name: 'attrOrders', type: 'string', required: false, desc: '归因订单数' },
      { name: 'attrGmv', type: 'string', required: false, desc: '归因 GMV' },
      { name: 'attrCtr', type: 'string', required: false, desc: '归因 CTR' },
      { name: 'attrCvr', type: 'string', required: false, desc: '归因 CVR' },
    ],
    requestExample: `{
  "items": [
    {
      "creatorId": "creator-leo-sato",
      "workId": "work-7391024",
      "title": "Sensitive skin? This serum changed my routine",
      "url": "https://tiktok.com/@leo.sato/video/7391024",
      "platform": "TikTok",
      "publishedAt": "2026-11-22",
      "impressions": "412000",
      "likes": "38200",
      "comments": "1240",
      "shares": "2100",
      "contentType": "video",
      "hashtags": "skincare;serum;sensitiveskin",
      "featured": "true",
      "attrClicks": "8600",
      "attrOrders": "214",
      "attrGmv": "$9,842.50"
    }
  ]
}`,
    response: '{ "updated": 1, "skipped": 0 }',
  },
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'collaboration-daily',
    method: 'POST',
    path: '/campaigns/import/collaboration-daily',
    title: '合作每日明细（内容表现）',
    purpose: '按天记录每位达人在 campaign 下的内容表现（曝光/互动/CPS 效果）——报告核心趋势图表的数据源。',
    source: '平台后台每日数据截图/导出汇总；同一天多内容类型分行（contentType 区分）。',
    prerequisites: ['Campaign 已创建', '达人已挂到该 Campaign（CampaignCreator 链接已建立）'],
    prerequisiteSummary: 'Campaign + 达人挂链',
    semantics: [
      '按 (campaignId, creatorId) 定位合作链接；任一不存在则整组 skipped。',
      '合并键 (contentType, date)：同日同类型重导覆盖，其余日期保留，最终按日期排序。',
      'contentType 缺省为 default；同一天有视频+图文两类数据时用两行表示。',
    ],
    fields: [
      { name: 'campaignId', type: 'string', required: true, desc: 'Campaign ID' },
      { name: 'creatorId', type: 'string', required: true, desc: '达人 ID' },
      { name: 'dailyDate', type: 'YYYY-MM-DD', required: true, desc: '数据日期' },
      { name: 'contentType', type: 'string', required: false, desc: '内容类型（缺省 default）' },
      { name: 'dailyImpressions', type: 'number', required: false, desc: '当日曝光' },
      { name: 'dailyLikes', type: 'number', required: false, desc: '当日点赞' },
      { name: 'dailyComments', type: 'number', required: false, desc: '当日评论' },
      { name: 'dailyShares', type: 'number', required: false, desc: '当日分享' },
      { name: 'dailySaves', type: 'number', required: false, desc: '当日收藏' },
      { name: 'dailyCpsClicks', type: 'number', required: false, desc: '当日 CPS 点击' },
      { name: 'dailyCpsOrders', type: 'number', required: false, desc: '当日 CPS 订单' },
      { name: 'dailyCpsGmv', type: 'number', required: false, desc: '当日 CPS GMV' },
      { name: 'dailyCpsCommission', type: 'number', required: false, desc: '当日 CPS 佣金' },
    ],
    requestExample: `{
  "items": [
    {
      "campaignId": "camp-everyday-bf",
      "creatorId": "creator-leo-sato",
      "dailyDate": "2026-11-28",
      "contentType": "video",
      "dailyImpressions": 96000,
      "dailyLikes": 8400,
      "dailyComments": 310,
      "dailyShares": 520,
      "dailyCpsClicks": 1900,
      "dailyCpsOrders": 48,
      "dailyCpsGmv": 2210.40,
      "dailyCpsCommission": 331.56
    }
  ]
}`,
    response: '{ "updated": 1, "skipped": 0 }',
  },
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'cps',
    method: 'POST',
    path: '/campaigns/import/cps',
    title: 'CPS 链接效果汇总',
    purpose: '每条追踪链接的累计效果（点击/订单/GMV/佣金/花费）——链接级维度分析与 ROI 计算的数据源。',
    source: '联盟平台（Amazon Attribution / ShareASale / 平台联盟后台）链接报表导出，每链接一行。',
    prerequisites: ['Campaign 已创建', '达人已挂到该 Campaign'],
    prerequisiteSummary: 'Campaign + 达人挂链',
    semantics: [
      '合并键 (campaignCreatorId, contentType)——即同一达人在同一 campaign 下的同类型链接，重导覆盖。',
      '必填 campaignId + creatorId + contentType 三者齐全才处理，否则 skipped。',
      '金额支持 $ 前缀与千分位逗号（服务端清洗为 Decimal）。',
      '维度标签（productName/category/market/promoName/promoType）空值落 NULL。',
    ],
    fields: [
      { name: 'campaignId', type: 'string', required: true, desc: 'Campaign ID' },
      { name: 'creatorId', type: 'string', required: true, desc: '达人 ID' },
      { name: 'contentType', type: 'string', required: true, desc: '内容类型（每类链接一行，如 video / post）' },
      { name: 'linkUrl', type: 'string', required: false, desc: '追踪链接 URL' },
      { name: 'clicks', type: 'number', required: false, desc: '累计点击' },
      { name: 'impressions', type: 'number', required: false, desc: '累计曝光' },
      { name: 'orders', type: 'number', required: false, desc: '累计订单' },
      { name: 'gmv', type: 'string | number', required: false, desc: '累计 GMV（支持 $ 千分位）' },
      { name: 'commission', type: 'string | number', required: false, desc: '累计佣金' },
      { name: 'spend', type: 'string | number', required: false, desc: '累计花费（投放/佣金外成本）' },
      { name: 'productName', type: 'string', required: false, desc: '推广商品名（维度标签）' },
      { name: 'category', type: 'string', required: false, desc: '商品类目（维度标签）' },
      { name: 'market', type: 'string', required: false, desc: '投放市场（维度标签，如 US）' },
      { name: 'promoName', type: 'string', required: false, desc: '活动名（维度标签）' },
      { name: 'promoType', type: 'string', required: false, desc: '活动类型（维度标签）' },
    ],
    requestExample: `{
  "items": [
    {
      "campaignId": "camp-everyday-bf",
      "creatorId": "creator-leo-sato",
      "contentType": "video",
      "linkUrl": "https://example.com/track/leo-bf",
      "clicks": 8621,
      "impressions": 412000,
      "orders": 214,
      "gmv": "$9,842.50",
      "commission": "$1,476.38",
      "spend": "0",
      "productName": "BF Gift Box",
      "category": "Gift Set",
      "market": "US",
      "promoName": "BF 2026",
      "promoType": "CPS"
    }
  ]
}`,
    response: '{ "updated": 1, "skipped": 0 }',
  },
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'cps-daily',
    method: 'POST',
    path: '/campaigns/import/cps-daily',
    title: 'CPS 每日明细',
    purpose: 'CPS 链接按天拆分的效果（含每日新客）——报告环比/趋势分析的核心数据源，GMV/Orders/Clicks 每日曲线由它构成。',
    source: '联盟后台按日报表导出；与 cps 汇总接口配套（同一链接先导汇总再导每日）。',
    prerequisites: ['Campaign 已创建', '达人已挂到该 Campaign', '建议先导 cps 汇总（每日明细会挂到同一链接记录上）'],
    prerequisiteSummary: 'Campaign + 达人挂链',
    semantics: [
      '按 (campaignId, creatorId, contentType) 定位 CPS 链接记录；不存在则自动创建空汇总记录。',
      '合并键 date：同日重导覆盖，其余日期保留，按日期排序合并。',
      'dailyNewCustomers 用于报告 New Customers 指标。',
    ],
    fields: [
      { name: 'campaignId', type: 'string', required: true, desc: 'Campaign ID' },
      { name: 'creatorId', type: 'string', required: true, desc: '达人 ID' },
      { name: 'contentType', type: 'string', required: true, desc: '内容类型（与 cps 汇总一致）' },
      { name: 'date', type: 'YYYY-MM-DD', required: true, desc: '数据日期' },
      { name: 'dailyClicks', type: 'string | number', required: false, desc: '当日点击' },
      { name: 'dailyImpressions', type: 'string | number', required: false, desc: '当日曝光' },
      { name: 'dailyOrders', type: 'string | number', required: false, desc: '当日订单' },
      { name: 'dailyGmv', type: 'string | number', required: false, desc: '当日 GMV（$ 前缀自动去除）' },
      { name: 'dailyCommission', type: 'string | number', required: false, desc: '当日佣金' },
      { name: 'dailySpend', type: 'string | number', required: false, desc: '当日花费' },
      { name: 'dailyNewCustomers', type: 'string | number', required: false, desc: '当日新客数' },
    ],
    requestExample: `{
  "items": [
    {
      "campaignId": "camp-everyday-bf",
      "creatorId": "creator-leo-sato",
      "contentType": "video",
      "date": "2026-11-28",
      "dailyClicks": "1900",
      "dailyImpressions": "96000",
      "dailyOrders": "48",
      "dailyGmv": "$2,210.40",
      "dailyCommission": "$331.56",
      "dailyNewCustomers": "31"
    }
  ]
}`,
    response: '{ "updated": 1, "skipped": 0 }',
  },
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'orders',
    method: 'POST',
    path: '/campaigns/import/orders',
    title: '订单商品明细',
    purpose: '联盟平台订单级导出（含商品行）——Top-Sales 商品排行、购物篮结构、QTY 分析的唯一数据源。',
    source: '联盟平台订单导出 CSV（每商品一行；同一订单多商品时 orderId 重复多行）。',
    prerequisites: ['Campaign 已创建', '（可选）达人已挂链——creatorId 归因到具体达人，缺失则计为未归因'],
    prerequisiteSummary: 'Campaign（达人挂链可选）',
    semantics: [
      '分组键 (campaignId, orderId)：同单多商品行自动合并为一个订单。',
      '幂等：重导同一订单先清空旧商品行再重建，不产生重复。',
      'lineTotal 缺省时自动按 unitPrice × qty 计算。',
      'creatorId 归因键是达人主档 ID（Creator.id），非合作链接 ID。',
      '媒体归因（2026-08-25 起）：publisherUrl/siteName 域名归一化 → 自动 upsert Publisher（媒体主档）→ 挂 publisherId；订单先归因到媒体维度，达人只是媒体类型之一。',
      '商品主档（2026-08-25 起）：每商品行按 (productName, sku) 自动 upsert Product 主档并挂 productId。',
      'Awin 镜像字段：ORDER_MIRROR_FIELDS 字典处理 40 个可选字段，空串统一转 null；saleAmount/commission/oldSaleAmount/oldCommission 自动转 Decimal，validationDate/clickThroughTime 自动转 DateTime。',
    ],
    fields: [
      { name: 'campaignId', type: 'string', required: true, desc: 'Campaign ID' },
      { name: 'orderId', type: 'string', required: true, desc: '订单号（联盟平台原始单号）' },
      { name: 'productName', type: 'string', required: true, desc: '商品名（商品行必填，空行跳过）' },
      { name: 'creatorId', type: 'string', required: false, desc: '归因达人 ID（取首行；缺省=未归因）' },
      { name: 'orderDate', type: 'YYYY-MM-DD', required: false, desc: '下单日期（取首行）' },
      { name: 'orderStatus', type: 'string', required: false, desc: '订单状态（paid / refunded…，取首行）' },
      { name: 'category', type: 'string', required: false, desc: '商品类目' },
      { name: 'sku', type: 'string', required: false, desc: '商品 SKU' },
      { name: 'qty', type: 'number', required: false, desc: '件数（缺省 1）' },
      { name: 'unitPrice', type: 'string | number', required: false, desc: '单价（支持 $ 千分位）' },
      { name: 'lineTotal', type: 'string | number', required: false, desc: '行小计（缺省按单价×件数）' },
      // ── Awin transactions 镜像字段（全部可选，空串→null） ──
      { name: 'awinId', type: 'string', required: false, desc: 'Awin 交易 ID' },
      { name: 'advertiserId', type: 'string', required: false, desc: '广告商 ID' },
      { name: 'saleAmount', type: 'string | number', required: false, desc: 'Awin 销售额（Decimal 自动转换）' },
      { name: 'commission', type: 'string | number', required: false, desc: 'Awin 佣金（Decimal 自动转换）' },
      { name: 'validationDate', type: 'string', required: false, desc: '验证日期（DateTime 自动转换）' },
      { name: 'clickRef', type: 'string', required: false, desc: '点击引用' },
      { name: 'type', type: 'string', required: false, desc: '交易类型（Awin 原始值，如 sale/lead）' },
      { name: 'siteName', type: 'string', required: false, desc: '发布商站点名' },
      { name: 'url', type: 'string', required: false, desc: '落地页 URL' },
      { name: 'declineReason', type: 'string', required: false, desc: '拒绝原因' },
      { name: 'clickThroughTime', type: 'string', required: false, desc: '点击时间（DateTime 自动转换）' },
      { name: 'voucherCodeUsed', type: 'string', required: false, desc: '使用的优惠券码' },
      { name: 'lapseTime', type: 'number', required: false, desc: '滞后时间（秒，parseInt）' },
      { name: 'amended', type: 'string', required: false, desc: '是否修改（yes/no）' },
      { name: 'amendReason', type: 'string', required: false, desc: '修改原因' },
      { name: 'oldSaleAmount', type: 'string | number', required: false, desc: '原销售额（Decimal 自动转换）' },
      { name: 'oldCommission', type: 'string | number', required: false, desc: '原佣金（Decimal 自动转换）' },
      { name: 'differentCurrency', type: 'string', required: false, desc: '是否不同币种' },
      { name: 'clickDevice', type: 'string', required: false, desc: '点击设备' },
      { name: 'transactionDevice', type: 'string', required: false, desc: '交易设备' },
      { name: 'publisherUrl', type: 'string', required: false, desc: '发布商 URL' },
      { name: 'transactionParts', type: 'string', required: false, desc: '交易分账' },
      { name: 'customerCountry', type: 'string', required: false, desc: '客户国家' },
      { name: 'customParameters', type: 'string', required: false, desc: '自定义参数' },
      { name: 'paidToPublisher', type: 'string', required: false, desc: '是否已支付给发布商' },
      { name: 'paymentStatus', type: 'string', required: false, desc: '支付状态' },
      { name: 'paymentId', type: 'string', required: false, desc: '支付 ID' },
      { name: 'transactionQueryId', type: 'string', required: false, desc: '交易查询 ID' },
      { name: 'clickRef2', type: 'string', required: false, desc: '点击引用 2' },
      { name: 'clickRef3', type: 'string', required: false, desc: '点击引用 3' },
      { name: 'clickRef4', type: 'string', required: false, desc: '点击引用 4' },
      { name: 'clickRef5', type: 'string', required: false, desc: '点击引用 5' },
      { name: 'clickRef6', type: 'string', required: false, desc: '点击引用 6' },
      { name: 'voucherCode', type: 'string', required: false, desc: '优惠券码' },
      { name: 'commissionSharingPublisherId', type: 'string', required: false, desc: '佣金分成发布商 ID' },
      { name: 'commissionSharingPublisher', type: 'string', required: false, desc: '佣金分成发布商' },
      { name: 'commissionSharingSelectedRatePublisherId', type: 'string', required: false, desc: '佣金分成选中费率发布商 ID' },
      { name: 'products', type: 'string', required: false, desc: '商品信息（JSON）' },
      { name: 'campaignLabel', type: 'string', required: false, desc: '活动标签' },
      { name: 'customerAcquisition', type: 'string', required: false, desc: '客户获取标识' },
    ],
    requestExample: `{
  "items": [
    {
      "campaignId": "camp-everyday-bf",
      "orderId": "BF-88231742",
      "creatorId": "creator-leo-sato",
      "orderDate": "2026-11-28",
      "orderStatus": "paid",
      "productName": "BF Gift Box",
      "category": "Gift Set",
      "sku": "BFGIFT-01",
      "qty": 2,
      "unitPrice": "$59.99",
      "lineTotal": "$119.98",
      "awinId": "36954321",
      "commission": "17.99",
      "clickDevice": "iOS",
      "customerCountry": "JP",
      "voucherCode": "BFCM26"
    },
    {
      "campaignId": "camp-everyday-bf",
      "orderId": "BF-88231742",
      "productName": "Winter Hand Cream Trio",
      "category": "Skincare",
      "qty": 1,
      "unitPrice": "18.50"
    }
  ]
}`,
    response: '{ "updated": 1, "skipped": 0 }（updated 计订单数，非商品行数）',
  },
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'orders-list',
    method: 'GET',
    path: '/campaigns/orders/list',
    title: '订单明细列表',
    purpose: '订单明细列表查询（数据管理页）：分页返回订单及商品行展开——admin 全局可见，非 admin 限本人 campaign。',
    source: '系统内数据（orders 导入接口写入），无需上游提供。',
    prerequisites: ['无前置——已有订单数据即可查询。'],
    prerequisiteSummary: null,
    semantics: [
      '权限：admin 全局可见所有订单；非 admin 仅可见本人拥有的 campaign 下的订单。',
      '分页：page 默认 1，pageSize 默认 20；orderDate 倒序排列。',
      'campaignId 筛选可选；订单行内展开商品明细（QTY/单价/小计）。',
    ],
    fields: [
      { name: 'campaignId', type: 'string', required: false, desc: 'Query 参数：按 Campaign 筛选（缺省=全部可见订单）' },
      { name: 'page', type: 'number', required: false, desc: 'Query 参数：页码（默认 1）' },
      { name: 'pageSize', type: 'number', required: false, desc: 'Query 参数：每页条数（默认 20）' },
    ],
    requestExample: `GET /api/v1/campaigns/orders/list?campaignId=camp-everyday-bf&page=1&pageSize=20`,
    response: `{
  "orders": [
    {
      "orderId": "BF-88231742",
      "campaignId": "camp-everyday-bf",
      "creatorId": "creator-leo-sato",
      "orderDate": "2026-11-28",
      "orderStatus": "paid",
      "commission": "17.99",
      "items": [
        { "productName": "BF Gift Box", "sku": "BFGIFT-01", "qty": 2, "unitPrice": "59.99", "lineTotal": "119.98" },
        { "productName": "Winter Hand Cream Trio", "sku": null, "qty": 1, "unitPrice": "18.50", "lineTotal": "18.50" }
      ]
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20
}`,
  },
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'order-insights',
    method: 'GET',
    path: '/campaigns/:id/order-insights',
    title: '订单商品聚合（Top-Sales + 购物篮）',
    purpose: '订单商品聚合分析——Top-Sales 商品排行（含 QTY）与购物篮结构指标，供报告引用。',
    source: '系统内数据（orders 导入接口写入的订单商品行聚合），无需上游提供。',
    prerequisites: ['Campaign 已创建。'],
    prerequisiteSummary: 'Campaign',
    semantics: [
      '按 Campaign 维度聚合订单商品行，输出 Top-Sales 排行（含件数 QTY）与购物篮指标（basketAnalysis）。',
      'start / end 均为可选（YYYY-MM-DD），用于限定订单日期窗口；缺省聚合全部订单。',
      '非本人 campaign 且非 admin 时返回错误。',
    ],
    fields: [
      { name: 'id', type: 'string', required: true, desc: '路径参数：Campaign ID' },
      { name: 'start', type: 'YYYY-MM-DD', required: false, desc: 'Query 参数：起始订单日期（含）' },
      { name: 'end', type: 'YYYY-MM-DD', required: false, desc: 'Query 参数：截止订单日期（含）' },
    ],
    requestExample: `GET /api/v1/campaigns/camp-everyday-bf/order-insights?start=2026-11-01&end=2026-11-30`,
    response: `{
  "topProducts": [
    { "productName": "BF Gift Box", "qty": 428, "revenue": "25,675.72" },
    { "productName": "Winter Hand Cream Trio", "qty": 193, "revenue": "3,570.50" }
  ],
  "basketAnalysis": {
    "avgItemsPerOrder": 1.9,
    "avgOrderValue": "76.31",
    "topCombination": "BF Gift Box + Winter Hand Cream Trio"
  }
}`,
  },
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'order-stats-recompute',
    method: 'POST',
    path: '/campaigns/:id/order-stats/recompute',
    title: '订单日级统计重算',
    purpose: '手动重算 OrderDailyStat 中间层（订单表真源日级聚合）——数据迁移后回填或统计异常排查用。',
    source: '系统内数据（orders 导入接口写入的订单），无需上游提供。',
    prerequisites: ['Campaign 已创建。'],
    prerequisiteSummary: 'Campaign',
    semantics: [
      '以订单表为真源，按日聚合 revenue / orders / newCustomer 标签 / device 维度，重建 OrderDailyStat 中间层。',
      '幂等：重复调用结果一致（全量重建该 campaign 的日级统计）。',
      '运维接口：常规数据链路无需调用；仅在迁移回填或排查统计偏差时使用。',
    ],
    fields: [{ name: 'id', type: 'string', required: true, desc: '路径参数：Campaign ID' }],
    requestExample: `POST /api/v1/campaigns/camp-everyday-bf/order-stats/recompute`,
    response: `{
  "recomputed": 30,
  "dateRange": { "start": "2026-11-01", "end": "2026-11-30" }
}`,
  },
  {
    id: 'publisher-stats-recompute',
    method: 'POST',
    path: '/campaigns/:id/publisher-stats/recompute',
    title: '媒体日统计重算',
    purpose: '手动重算 PublisherDailyStat 中间层（媒体 × 日聚合：成交侧订单 + 流量侧链接）——数据迁移回填或媒体维度统计排查用。',
    source: '系统内数据（订单表 + LinkPerformance.daily），无需上游提供。',
    prerequisites: ['Campaign 已创建（订单已导入并完成媒体归因更佳）。'],
    prerequisiteSummary: 'Campaign',
    semantics: [
      '成交侧：CampaignOrder 按 (publisherId, 日) 聚合 orders / gmv / commission；订单导入时自动执行，也可手动调用。',
      '流量侧：LinkPerformance.daily 的 clicks / impressions 并入同一 (publisherId, 日) 格——链接效果导入后才有值，缺失时该侧为 0（不编造）。',
      '派生指标（ctr / cvr / epc）不入库，由消费侧按 clicks/orders/gmv 现算。',
      '幂等：重复调用结果一致（全量重建该 campaign 的媒体日统计；残留孤儿行自动清理）。',
    ],
    fields: [{ name: 'id', type: 'string', required: true, desc: '路径参数：Campaign ID' }],
    requestExample: `POST /api/v1/campaigns/cmszwk2dw000y8edagyejkj3f/publisher-stats/recompute`,
    response: `{
  "rows": 195,
  "dropped": 0
}`,
  },
];

export const API_DOC_CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.2.0',
    date: '2026-08-25',
    changes: [
      { kind: '新增', text: '媒体维度数据结构：Publisher（媒体主档）/ LinkPerformance（链接效果）/ PublisherDailyStat（媒体日统计中间表）——订单先归因到链接与媒体，达人只是媒体类型之一；clicks/impressions/ctr/cvr/epc 归集到链接维度。' },
      { kind: '变更', text: '订单导入接口自动媒体归因（publisherUrl/siteName 域名归一化 → upsert Publisher）+ 商品主档自动维护（(productName, sku) → upsert Product）。' },
      { kind: '新增', text: '媒体日统计重算接口（publisher-stats/recompute）：成交侧订单聚合 + 流量侧链接点击并入 (媒体 × 日) 格，幂等重建。' },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-08-21',
    changes: [
      { kind: '新增', text: '订单导入接口扩展 Awin transactions 全列镜像（40 字段：awinId/commission/clickDevice/customerCountry/voucherCode 等；空串→null，Decimal/DateTime 自动转换）。' },
      { kind: '新增', text: '3 个数据管理接口——订单列表（orders/list）、商品聚合（order-insights）、日级统计重算（order-stats/recompute）。' },
      { kind: '变更', text: '接口文档支持 GET 方法标签（此前仅 POST）。' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-08-19',
    changes: [
      { kind: '新增', text: '接口文档上线：整理 7 个上游数据导入接口（达人基础/受众画像/作品/合作每日/CPS 汇总/CPS 每日/订单明细）的完整契约——字段表、合并语义、前置依赖与请求示例。' },
      { kind: '新增', text: '变更日志机制：接口每次迭代须同步更新本文档并在此追加记录。' },
    ],
  },
];
