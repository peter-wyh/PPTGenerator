/**
 * 业务组件 catalog —— 完整 port demo.html 的 BUSINESS_COMPONENTS / LAYOUTS / STYLE_OPTIONS。
 * 20 类业务组件，分 4 组。对齐设计文档 §3.5：单 type 'business-block' + businessKind 二级分发。
 *
 * 注意：item.title / meta / details 是「拖入新组件时的默认填充值」，已中性化为占位
 * （不再含 GlowLab / LUMIÈRE / Mia Chen 等真实品牌样例）。真实数据走 reportData → pageBinding 通道。
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
        title: '报告标题',
        meta: '副标题 · 期次',
        details: ['品牌 · 行业', '一句话价值主张'],
      },
      {
        id: 'agenda',
        icon: '☷',
        name: '目录导航',
        desc: '章节导航',
        title: '目录',
        meta: '章节概览或阅读路径',
        details: ['章节一', '章节二', '章节三', '章节四'],
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
        meta: '起始 — 至今',
        details: ['里程碑一', '里程碑二', '里程碑三', '里程碑四'],
      },
      {
        id: 'global',
        icon: '◎',
        name: '全球布局',
        desc: '区域布局',
        title: '全球化业务网络',
        meta: '区域布局描述',
        details: ['区域一', '区域二', '区域三', '区域四'],
      },
      {
        id: 'brand-wall',
        icon: '▦',
        name: '合作品牌墙',
        desc: '品牌矩阵',
        title: '品牌合作矩阵',
        meta: '覆盖行业与品类描述',
        details: ['品牌一', '品牌二', '品牌三', '品牌四', '品牌五'],
      },
      {
        id: 'org',
        icon: '⌘',
        name: '团队组织架构',
        desc: '组织分栏',
        title: '团队分工与协作',
        meta: '团队规模与分工描述',
        details: ['团队一', '团队二', '团队三', '团队四'],
      },
      {
        id: 'service',
        icon: '✦',
        name: '核心服务矩阵',
        desc: '能力矩阵',
        title: '核心服务能力',
        meta: '服务能力描述',
        details: ['服务一', '服务二', '服务三', '服务四'],
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
        title: '市场机会与挑战',
        meta: '市场洞察描述',
        details: ['洞察一', '洞察二', '洞察三', '洞察四'],
      },
      {
        id: 'process',
        icon: '→',
        name: '合作评估流程',
        desc: '流程步骤',
        title: '评估流程步骤',
        meta: '流程说明描述',
        details: ['步骤一', '步骤二', '步骤三', '步骤四'],
      },
      {
        id: 'calendar',
        icon: '□',
        name: '营销活动日历',
        desc: '季度日历',
        title: '年度营销节奏',
        meta: '营销节奏描述',
        details: ['节点一', '节点二', '节点三', '节点四'],
      },
      {
        id: 'campaign-plan',
        icon: '⌁',
        name: 'Campaign 方案',
        desc: '推广路径',
        title: 'Campaign 推广方案',
        meta: 'Campaign 方案描述',
        details: ['阶段一', '阶段二', '阶段三', '阶段四'],
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
        title: '合作案例标题',
        meta: '案例概述描述',
        details: ['亮点一', '亮点二', '亮点三', '成效 · --'],
      },
      {
        id: 'campaign-overview',
        icon: '◉',
        name: 'Campaign 概览',
        desc: '指标概览',
        title: 'Campaign 核心指标',
        meta: '投放周期 · 渠道',
        details: ['曝光量 · --', '触达人数 · --', '互动率 · --', '转化率 · --'],
      },
      {
        id: 'creator-list',
        icon: '◒',
        name: '达人名单',
        desc: '达人清单',
        title: '创作者合作矩阵',
        meta: '达人规模与结构描述',
        details: ['达人一', '达人二', '达人三', '达人四'],
      },
      {
        id: 'creator-profile',
        icon: '●',
        name: '达人介绍',
        desc: '媒体资料卡',
        title: '达人名称',
        meta: '达人定位 · 社交账号',
        details: ['达人层级', '-- 关注数', '-- 互动率', '-- 曝光', '受众画像描述'],
      },
      {
        id: 'content-analysis',
        icon: '◔',
        name: '作品分析',
        desc: '表现漏斗',
        title: '内容表现分析',
        meta: '内容表现与转化描述',
        details: ['内容一 · --', '内容二 · --', '内容三 · --', '内容四 · --'],
      },
      {
        id: 'retrospective',
        icon: '↻',
        name: '复盘与建议',
        desc: '行动结论',
        title: '复盘结论与建议',
        meta: '复盘结论描述',
        details: ['结论一', '结论二', '结论三', '结论四'],
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
        title: '套餐方案对比',
        meta: '套餐适配场景描述',
        details: ['套餐要点一', '套餐要点二', '套餐要点三', '套餐要点四'],
      },
      {
        id: 'report',
        icon: '▤',
        name: '周报 / 月报',
        desc: '进度摘要',
        title: '周期进度报告',
        meta: '报告周期与进度描述',
        details: ['指标一 · --', '指标二 · --', '指标三 · --', '指标四 · --'],
      },
      {
        id: 'funnel',
        icon: '▽',
        name: '增长漏斗',
        desc: '转化漏斗',
        title: '转化漏斗',
        meta: '转化路径描述',
        details: ['阶段一 · --', '阶段二 · --', '阶段三 · --', '阶段四 · --'],
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
