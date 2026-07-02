/**
 * 业务组件 catalog —— 完整 port demo.html 的 BUSINESS_COMPONENTS / LAYOUTS / STYLE_OPTIONS。
 * 20 类业务组件，分 4 组。对齐设计文档 §3.5：单 type 'business-block' + businessKind 二级分发。
 */

export interface BusinessItem {
  id: string;
  icon: string;
  name: string;
  desc: string;
  title: string;
  meta: string;
  details: string[];
}

export interface BusinessGroup {
  group: string;
  items: BusinessItem[];
}

export interface BusinessLayout {
  w: number;
  h: number;
  form: string;
}

export const BUSINESS_GROUPS: BusinessGroup[] = [
  {
    group: '基础页面',
    items: [
      {
        id: 'cover',
        icon: '◆',
        name: '封面信息',
        desc: '品牌叙事封面',
        title: 'GlowLab TikTok 增长提案',
        meta: 'BUSINESS PRESENTATION · 2026 Q4',
        details: ['MEDIATEK · BEAUTY', '让每一条真实内容，都转化为可衡量的品牌增长'],
      },
      {
        id: 'agenda',
        icon: '☷',
        name: '目录导航',
        desc: '章节导航',
        title: 'PROJECT ROADMAP',
        meta: '品牌诊断 → 策略路径 → 内容执行 → 增长复盘',
        details: [],
      },
    ],
  },
  {
    group: '公司与服务',
    items: [
      {
        id: 'milestone',
        icon: '↗',
        name: '公司里程碑',
        desc: '横向时间轴',
        title: '成长里程碑',
        meta: '2019 — 2026',
        details: ['2019 业务启航', '2022 服务 100+ 品牌', '2024 AI 营销能力上线', '2026 覆盖全球市场'],
      },
      {
        id: 'global',
        icon: '◎',
        name: '全球布局',
        desc: '区域布局',
        title: '全球化业务网络',
        meta: '12 个市场 · 6 个区域办公室 · 1000+ 创作者资源',
        details: ['亚太', '北美', '欧洲', '中东'],
      },
      {
        id: 'brand-wall',
        icon: '▦',
        name: '合作品牌墙',
        desc: '品牌矩阵',
        title: '与 300+ 增长型品牌共创',
        meta: '覆盖美妆、生活方式、3C、零售与旅游五大行业',
        details: ['LUMIÈRE', 'NOVA HOME', 'MOTION', 'EVERYDAY', 'WANDER'],
      },
      {
        id: 'org',
        icon: '⌘',
        name: '团队组织架构',
        desc: '组织分栏',
        title: '策略 × 创意 × 运营 × 数据',
        meta: '35 人项目组 · 每个 Campaign 配置 1 名增长负责人',
        details: ['策略咨询 · 20%', '创意内容 · 25%', '媒介运营 · 35%', '数据技术 · 20%'],
      },
      {
        id: 'service',
        icon: '✦',
        name: '核心服务矩阵',
        desc: '能力矩阵',
        title: '从人群洞察到生意增长',
        meta: '以内容为核心，连接达人资源、媒体资源与转化数据',
        details: ['达人策略与招募', 'TikTok 内容投放', '社媒媒体采买', 'AI 数据归因'],
      },
    ],
  },
  {
    group: '策略与方案',
    items: [
      {
        id: 'challenge',
        icon: '!',
        name: '机会与挑战',
        desc: '洞察矩阵',
        title: '年轻肌肤赛道的增长窗口',
        meta: 'Z 世代消费者更信任真实测评与即时可验证的功效表达',
        details: ['18–24 岁高潜人群', '竞品内容同质化', '敏感肌细分机会', 'UGC 可信背书'],
      },
      {
        id: 'process',
        icon: '→',
        name: '合作评估流程',
        desc: '流程步骤',
        title: '4 周完成从需求到上线',
        meta: '明确增长目标后，以创作者匹配度与内容可复制性作为决策标准',
        details: ['品牌增长诊断', '达人资源评估', '内容方案共创', '上线复盘迭代'],
      },
      {
        id: 'calendar',
        icon: '□',
        name: '营销活动日历',
        desc: '季度日历',
        title: '2026 年度内容营销节奏',
        meta: '围绕关键消费节点提前 4–6 周进行人群预热与内容蓄水',
        details: ['春季焕新 · 上新种草', '618 · 集中转化', '开学季 · 场景渗透', '黑五圣诞 · 礼赠爆发'],
      },
      {
        id: 'campaign-plan',
        icon: '⌁',
        name: 'Campaign 方案',
        desc: '推广路径',
        title: '30 天 TikTok 增长路径',
        meta: '70 位创作者 · 120 条内容 · 3 个媒体资源位 · 全程数据追踪',
        details: ['种子达人预热', '头部达人引爆', 'Spark Ads 扩散', 'GMV 与评论复盘'],
      },
    ],
  },
  {
    group: '案例与结案',
    items: [
      {
        id: 'case-showcase',
        icon: '▣',
        name: '合作案例',
        desc: '案例叙事',
        title: 'LUMIÈRE 敏感肌精华上市',
        meta: '以"7 天肌肤状态日记"内容线串联测评、种草与即时转化',
        details: ['7 天真实挑战', '70 位 TikTok 创作者', '12.6M 累计曝光', 'GMV 达成 138%'],
      },
      {
        id: 'campaign-overview',
        icon: '◉',
        name: 'Campaign 概览',
        desc: '指标概览',
        title: 'LUMIÈRE Campaign 核心成效',
        meta: '投放周期：2026.10.12 – 2026.11.10 · TikTok / Spark Ads',
        details: ['曝光量 12.6M', '触达人数 8.1M', '互动率 8.7%', '转化率 3.8%'],
      },
      {
        id: 'creator-list',
        icon: '◒',
        name: '达人名单',
        desc: '达人清单',
        title: '创作者合作矩阵',
        meta: '共 70 位创作者 · 头部 6 / 腰部 24 / KOC 40 · 以敏感肌人群为核心',
        details: ['Mia Chen · 1.28M', 'Sofia Lane · 684K', 'Ava Park · 312K', 'Jamie Wu · 86K'],
      },
      {
        id: 'creator-profile',
        icon: '●',
        name: '达人介绍',
        desc: '媒体资料卡',
        title: 'Mia Chen',
        meta: 'Beauty & Skincare Creator · @miaglowup',
        details: [
          'Macro Creator',
          '1.28M followers',
          '8.7% engagement',
          '12.6M campaign views',
          'Women 18–34 · US / UK',
        ],
      },
      {
        id: 'content-analysis',
        icon: '◔',
        name: '作品分析',
        desc: '表现漏斗',
        title: '内容表现与转化分析',
        meta: '"7 天日记"视频贡献 46% 播放量，评论高频词为 gentle / glow / repurchase',
        details: ['UGC 测评 · 46%', '达人演示 · 31%', '成分科普 · 15%', '礼赠场景 · 8%'],
      },
      {
        id: 'retrospective',
        icon: '↻',
        name: '复盘与建议',
        desc: '行动结论',
        title: '从爆款内容到下一轮增长',
        meta: '功效可视化内容显著提升收藏与加购；下一阶段应放大中腰部创作者的持续转化',
        details: ['保留 7 天日记机制', '缩短前 3 秒功效表达', '追加 12 位敏感肌达人', '目标 GMV +35%'],
      },
    ],
  },
  {
    group: '报价与工具',
    items: [
      {
        id: 'package',
        icon: '≡',
        name: '套餐对比',
        desc: '套餐对比',
        title: 'TikTok 整合营销套餐',
        meta: '适配新品试水、增长加速与品牌整合三种阶段',
        details: ['20–80 位达人', 'Spark Ads 资源位', '8–15% CPS 佣金', '4–8 周服务周期'],
      },
      {
        id: 'report',
        icon: '▤',
        name: '周报 / 月报',
        desc: '进度摘要',
        title: '第 3 周 Campaign 进度',
        meta: '目标曝光 10M · 当前完成 8.6M · 核心创作者内容已全部上线',
        details: ['GMV ¥1.24M', '互动率 8.7%', '内容上线 84%', '下周追加 Spark Ads'],
      },
      {
        id: 'funnel',
        icon: '▽',
        name: '增长漏斗',
        desc: '转化漏斗',
        title: '内容驱动的转化漏斗',
        meta: '从品牌曝光到店铺下单，每一步都匹配内容和媒体动作',
        details: ['12.6M 曝光', '8.1M 触达', '1.1M 互动', '84K 下单'],
      },
    ],
  },
];

export const BUSINESS_BY_ID: Record<string, BusinessItem> = Object.fromEntries(
  BUSINESS_GROUPS.flatMap((g) => g.items).map((it) => [it.id, it]),
);

export const BUSINESS_LAYOUTS: Record<string, BusinessLayout> = {
  cover: { w: 760, h: 430, form: '品牌叙事' },
  agenda: { w: 660, h: 340, form: '章节导航' },
  milestone: { w: 760, h: 240, form: '横向时间轴' },
  global: { w: 620, h: 320, form: '区域布局' },
  'brand-wall': { w: 760, h: 250, form: '品牌矩阵' },
  org: { w: 680, h: 270, form: '组织分栏' },
  service: { w: 760, h: 270, form: '能力矩阵' },
  challenge: { w: 650, h: 320, form: '洞察矩阵' },
  process: { w: 780, h: 230, form: '流程步骤' },
  calendar: { w: 760, h: 310, form: '季度日历' },
  'campaign-plan': { w: 800, h: 240, form: '推广路径' },
  'case-showcase': { w: 760, h: 360, form: '案例叙事' },
  'campaign-overview': { w: 700, h: 250, form: '指标概览' },
  'creator-list': { w: 680, h: 320, form: '达人清单' },
  'creator-profile': { w: 700, h: 270, form: '媒体资料卡' },
  'content-analysis': { w: 620, h: 300, form: '表现漏斗' },
  retrospective: { w: 680, h: 290, form: '行动结论' },
  package: { w: 760, h: 310, form: '套餐对比' },
  report: { w: 680, h: 260, form: '进度摘要' },
  funnel: { w: 560, h: 320, form: '转化漏斗' },
};

export type VariantId = 'standard' | 'cards' | 'accent' | 'light' | 'stats' | 'table' | 'results';

/** 各业务类型可用的变体（id → 显示名）。 */
export const BUSINESS_STYLE_OPTIONS: Record<string, [VariantId, string][]> = {
  cover: [['standard', '品牌叙事'], ['light', '极简留白'], ['accent', '视觉重点']],
  agenda: [['standard', '双栏导航'], ['cards', '章节卡片'], ['light', '轻量目录']],
  milestone: [['standard', '横向时间轴'], ['cards', '里程碑卡片'], ['accent', '高亮节点']],
  global: [['standard', '区域布局'], ['light', '数据留白'], ['accent', '市场聚焦']],
  'brand-wall': [['standard', '品牌矩阵'], ['cards', '品牌卡片'], ['light', '极简墙面']],
  org: [['standard', '组织分栏'], ['cards', '团队卡片'], ['accent', '比例重点']],
  service: [['standard', '能力矩阵'], ['cards', '服务卡片'], ['accent', '重点服务']],
  challenge: [['standard', '洞察矩阵'], ['cards', '机会卡片'], ['accent', '策略优先']],
  process: [['standard', '横向路径'], ['cards', '节点卡片'], ['accent', '当前阶段']],
  calendar: [['standard', '季度日历'], ['cards', '节点卡片'], ['light', '轻量排期']],
  'campaign-plan': [['standard', '推广路径'], ['cards', '阶段卡片'], ['accent', '引爆重点']],
  'case-showcase': [['standard', '杂志叙事'], ['results', '成效优先'], ['light', '留白案例']],
  'campaign-overview': [['standard', '指标概览'], ['stats', '主数值'], ['cards', '数据卡片']],
  'creator-list': [['standard', '达人清单'], ['cards', '达人卡片'], ['accent', '重点达人']],
  'creator-profile': [['standard', '媒体资料'], ['stats', '数据优先'], ['light', '极简档案']],
  'content-analysis': [['standard', '表现漏斗'], ['cards', '内容矩阵'], ['accent', '爆款重点']],
  retrospective: [['standard', '行动结论'], ['cards', '复盘卡片'], ['accent', '目标优先']],
  package: [['standard', '套餐对比'], ['table', '对比表格'], ['accent', '推荐套餐']],
  report: [['standard', '进度摘要'], ['stats', '达成优先'], ['cards', '行动卡片']],
  funnel: [['standard', '转化漏斗'], ['cards', '阶段卡片'], ['accent', '转化重点']],
};

const DEFAULT_OPTIONS: [VariantId, string][] = [
  ['standard', '标准样式'],
  ['cards', '卡片样式'],
  ['accent', '重点样式'],
];

export function getStyleOptions(kind: string): [VariantId, string][] {
  return BUSINESS_STYLE_OPTIONS[kind] ?? DEFAULT_OPTIONS;
}

export function getLayout(kind: string): BusinessLayout {
  return BUSINESS_LAYOUTS[kind] ?? { w: 580, h: 220, form: '业务组件' };
}

export function getBusinessItem(kind: string): BusinessItem {
  return (
    BUSINESS_BY_ID[kind] ?? {
      id: kind,
      icon: '▦',
      name: '业务组件',
      desc: '',
      title: '',
      meta: '',
      details: [],
    }
  );
}

export const ALL_BUSINESS_KINDS = BUSINESS_GROUPS.flatMap((g) => g.items.map((i) => i.id));
