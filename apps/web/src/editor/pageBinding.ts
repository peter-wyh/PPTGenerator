import type { Page, ReportCampaign, ReportCreator, ReportDataContext, EditorComponent, ComponentData, DataSourceMode, DmMonthlyData, DmBiweeklyData } from '@mediakit/shared';
import { pageCategory } from '@mediakit/shared';
import { allReportCreators } from './store';
import {
  getCampaignSummary, getConversionFunnel, getRevenueTimeline, getPublishers,
  getGeoPerformance, getPlacementWideRows, getDeviceBreakdown, getContentTopics,
  getSearchTerms, getHourlyPerformance,
} from '@/api/affiliate';
import { listPlacementTypeSummary } from '@/api/creatorPerformance';
import { metricsToRows } from './campaignMetrics';

/** 组件 → 绑定大类。未登记的组件不参与自动填充（查表得 undefined）。 */
export const COMPONENT_BINDING_KIND: Partial<Record<string, 'creator' | 'campaign' | 'project' | 'dm'>> = {
  // creator 型（取 page.creatorId）
  'creator-avatar-card': 'creator',
  'meta-strip': 'creator',
  'creator-stats-strip': 'creator',
  'creator-fan-gender': 'creator',
  'creator-fan-age': 'creator',
  'creator-fan-city': 'creator',
  'creator-audience-profile': 'creator',
  'creator-works-list': 'creator',
  'creator-works-table': 'creator',
  'work-screenshot': 'creator',
  // campaign 型（取 page.campaignId）
  'campaign-summary': 'campaign',
  'funnel-chart': 'campaign',
  'revenue-timeline': 'campaign',
  'publisher-table': 'campaign',
  'geo-distribution': 'campaign',
  'placement-wide-table': 'campaign',
  'placement-type-summary': 'campaign',
  'device-breakdown': 'campaign',
  'content-topic-performance': 'campaign',
  'search-term-table': 'campaign',
  'hourly-heatmap': 'campaign',
  'kpi-board': 'campaign',
  // project 型（取 projectMeta + reportData.campaign，无 page 级绑定键）
  // text 组件仅在 _dataSource==='project' 时填充（用户通过属性面板显式标记「跟随项目」）。
  'text': 'project',
  'strategy-block': 'project',
  // dm 型（DM 月报/双周报专用，取 reportData.dmMonthly / dmBiweekly）
  'dm-hero': 'dm',
  'dm-channel-content': 'dm',
  'dm-product-grid': 'dm',
  'dm-ad-placement': 'dm',
  'dm-featured-creators': 'dm',
  'dm-creator-posts': 'dm',
  'dm-creator-profiles': 'dm',
  'dm-optimization-review': 'dm',
  'dm-package-images': 'dm',
  'dm-kpi-board': 'dm',
};

/** page.creatorId → 合并达人列表（campaignCreators + creators）中解析。找不到 → undefined。 */
export function resolvePageCreator(page: Page, reportData: ReportDataContext): ReportCreator | undefined {
  if (!page.creatorId) return undefined;
  return allReportCreators(reportData).find((c) => c.id === page.creatorId);
}

/** page.campaignId → 全局 reportData.campaign（唯一）。不匹配 → undefined。 */
export function resolvePageCampaign(page: Page, reportData: ReportDataContext): ReportCampaign | undefined {
  if (!page.campaignId || !reportData.campaign) return undefined;
  return reportData.campaign.id === page.campaignId ? reportData.campaign : undefined;
}

/**
 * project 型填充：从 projectMeta + reportData 取项目级信息。
 * - text 组件：根据 _dataSource==='project' 标记，填充副标题（广告主·周期）或 campaign 名称等。
 *   仅 cover 大类的非标题 text 组件自动填充；其他页面需用户显式标记。
 * - strategy-block：填充 campaign 摘要文案。
 */
export function projectPatch(
  compType: string,
  page: Page,
  projectMeta: { advertiser?: string; scenarioSub?: string; scenario?: string; businessLine?: string } | null | undefined,
  reportData: ReportDataContext,
): Record<string, unknown> | null {
  const campaign = reportData.campaign;
  const cat = pageCategory(page.pageType);

  if (compType === 'text') {
    // 封面页：非标题 text 组件自动填充副标题
    if (cat === 'media-report' && page.titleComponentId) {
      // 跳过标题组件（由 refreshReportTitle 管理）
      // 此处无法拿到 comp.id，调用方在 fill() 中跳过 titleComponentId
    }
    // 构建副标题文案
    const parts: string[] = [];
    if (campaign?.advertiser) parts.push(campaign.advertiser);
    else if (projectMeta?.advertiser) parts.push(projectMeta.advertiser);
    if (campaign?.name) parts.push(campaign.name);
    // 周期
    let period = '';
    if (projectMeta?.scenarioSub === 'weekly') period = 'Weekly Report';
    else if (projectMeta?.scenarioSub === 'monthly') period = 'Monthly Report';
    else if (projectMeta?.scenarioSub === 'wrap-up') period = 'Wrap-up Report';
    if (campaign?.startDate && campaign?.endDate) {
      period = `${campaign.startDate} ~ ${campaign.endDate}`;
    }
    if (period) parts.push(period);
    if (parts.length === 0) return null;
    return { content: parts.join(' · ') };
  }

  if (compType === 'strategy-block') {
    if (!campaign) return null;
    const lines: string[] = [];
    if (campaign.advertiser) lines.push(`Advertiser: ${campaign.advertiser}`);
    if (campaign.platform) lines.push(`Platform: ${campaign.platform}`);
    if (campaign.startDate && campaign.endDate) lines.push(`Period: ${campaign.startDate} ~ ${campaign.endDate}`);
    if (campaign.budget) lines.push(`Budget: ${campaign.budget}`);
    if (campaign.status) lines.push(`Status: ${campaign.status}`);
    if (lines.length === 0) return null;
    return { content: lines.join('<br/>') };
  }

  return null;
}

/** 根据 ComponentType 从对应 mock 函数取数据，返回 data patch 对象。 */
export function campaignDataPatch(
  compType: string,
  campaignId: string,
): Record<string, unknown> | null {
  switch (compType) {
    case 'campaign-summary': {
      const s = getCampaignSummary(campaignId);
      return {
        campaignName: s.campaignName,
        period: s.period,
        metrics: [
          { label: 'Spend', value: s.totalSpend },
          { label: 'Revenue', value: s.totalRevenue },
          { label: 'ROAS', value: s.roas },
          { label: 'Commission', value: s.totalCommission },
        ],
        customerSplit: {
          newCustomers: s.newCustomers,
          returningCustomers: s.returningCustomers,
          newCustomerRate: s.newCustomerRate,
        },
      };
    }
    case 'funnel-chart':
      return { steps: getConversionFunnel(campaignId) };
    case 'revenue-timeline':
      return { points: getRevenueTimeline(campaignId, 14) };
    case 'publisher-table':
      return { rows: getPublishers(campaignId) };
    case 'geo-distribution':
      return { items: getGeoPerformance(campaignId) };
    case 'placement-wide-table':
      return { rows: getPlacementWideRows(campaignId) };
    case 'placement-type-summary':
      return { items: listPlacementTypeSummary(campaignId) };
    case 'device-breakdown':
      return { items: getDeviceBreakdown(campaignId) };
    case 'content-topic-performance':
      return { items: getContentTopics(campaignId) };
    case 'search-term-table':
      return { items: getSearchTerms(campaignId) };
    case 'hourly-heatmap':
      return { hours: getHourlyPerformance(campaignId) };
    default:
      return null;
  }
}

/** campaign 型组件填充：campaignDataPatch + kpi-board（metricsToRows）。无数据 → null。 */
export function campaignPatch(compType: string, campaign: ReportCampaign): Record<string, unknown> | null {
  if (compType === 'kpi-board') {
    if (!campaign.metrics?.length) return null;
    return { ...metricsToRows(campaign.metrics) };
  }
  return campaignDataPatch(compType, campaign.id);
}

const cap = (s?: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

/**
 * DM 型组件填充：根据 scenarioSub 决定从 dmMonthly / dmBiweekly 读取字段。
 * - 月报（monthly）: heroImage / channelContent / products / adPlacement / featuredCreators / creatorPosts
 * - 双周报（biweekly）: heroImage / channelContent / adPlacement / creatorProfiles / optimizationReview / packageImages / kpi
 * 无数据 → null（调用方跳过）。scenarioSub 缺失时按 monthly 兜底。
 */
export function dmPatch(
  compType: string,
  monthly: DmMonthlyData | undefined,
  biweekly: DmBiweeklyData | undefined,
  scenarioSub?: string,
): Record<string, unknown> | null {
  const isBiweekly = scenarioSub === 'biweekly';

  if (compType === 'dm-hero') {
    const url = isBiweekly ? biweekly?.heroImage : monthly?.heroImage;
    if (!url) return null;
    return { url };
  }
  if (compType === 'dm-channel-content') {
    const items = isBiweekly ? biweekly?.channelContent : monthly?.channelContent;
    if (!items?.length) return null;
    return { items: items.map((x) => ({ url: x.url, label: x.label })) };
  }
  if (compType === 'dm-ad-placement') {
    if (isBiweekly) {
      const items = biweekly?.adPlacement;
      if (!items) return null;
      return { url: items.url, label: items.label };
    }
    const ap = monthly?.adPlacement;
    if (!ap) return null;
    return { url: ap.url, label: ap.label };
  }
  // —— 月报独有 ——
  if (!isBiweekly && compType === 'dm-product-grid') {
    if (!monthly?.products?.length) return null;
    return { products: monthly.products.map((p) => ({ ...p })) };
  }
  if (!isBiweekly && compType === 'dm-featured-creators') {
    if (!monthly?.featuredCreators?.length) return null;
    return {
      creators: monthly.featuredCreators.map((c) => ({
        id: c.id,
        name: c.name,
        avatar: c.avatar ?? '',
        handle: c.handle ?? '',
        platform: c.platform ?? '',
        followers: c.followers ?? '',
      })),
    };
  }
  if (!isBiweekly && compType === 'dm-creator-posts') {
    if (!monthly?.creatorPosts?.length) return null;
    return {
      posts: monthly.creatorPosts.map((p) => ({
        id: p.id,
        cover: p.cover ?? '',
        title: p.title,
        platform: p.platform ?? '',
      })),
    };
  }
  // —— 双周报独有 ——
  if (isBiweekly && compType === 'dm-creator-profiles') {
    if (!biweekly?.creatorProfiles?.length) return null;
    return { items: biweekly.creatorProfiles.map((x) => ({ url: x.url, label: x.label })) };
  }
  if (isBiweekly && compType === 'dm-optimization-review') {
    if (!biweekly?.optimizationReview?.length) return null;
    return { items: biweekly.optimizationReview.map((x) => ({ url: x.url, label: x.label })) };
  }
  if (isBiweekly && compType === 'dm-package-images') {
    if (!biweekly?.packageImages?.length) return null;
    return { items: biweekly.packageImages.map((x) => ({ url: x.url, label: x.label })) };
  }
  if (isBiweekly && compType === 'dm-kpi-board') {
    if (!biweekly?.kpi?.length) return null;
    return { kpi: biweekly.kpi.map((k) => ({ ...k })) };
  }

  return null;
}

/**
 * creator 型组件填充。逻辑与各 creator importer 的 apply() 1:1（DRY：importer 改调本函数）。
 * campaignId 仅 creator-works-list / work-screenshot 需要（限定该 campaign 下作品）。
 * 无可用数据 → null（调用方跳过）。
 */
export function creatorPatch(
  compType: string,
  cr: ReportCreator,
  _campaignId: string,
): Record<string, unknown> | null {
  switch (compType) {
    case 'creator-avatar-card':
      return {
        name: cr.name,
        platform: (cr.platform ?? 'TikTok') as string,
        handle: cr.handle,
        followers: cr.followers,
        engagement: cr.engagement,
        avatar: cr.avatar ?? '',
        intro: [
          cr.category,
          cr.region,
          cr.tier ? cap(cr.tier) : '',
        ].filter(Boolean).join(' · '),
      };
    case 'meta-strip': {
      const rows: string[][] = [];
      if (cr.category) rows.push(['tag', 'CATEGORY', cr.category]);
      if (cr.region) rows.push(['target', 'REGION', cr.region]);
      if (cr.tier) rows.push(['trophy', 'TIER', cap(cr.tier)]);
      if (rows.length === 0) rows.push(['tag', 'NAME', cr.name]);
      return { rows };
    }
    case 'creator-stats-strip':
      if (!cr.stats?.length) return null;
      return { stats: cr.stats.map((s) => ({ ...s })) };
    case 'creator-fan-gender':
      if (!cr.audience?.genderSplit?.length) return null;
      return { slices: cr.audience.genderSplit.map((g) => ({ label: g.label, value: g.value, color: g.color ?? 'auto' })) };
    case 'creator-fan-age':
      if (!cr.audience?.ageRange?.length) return null;
      return { bars: cr.audience.ageRange.map((a) => ({ label: a.label, value: a.value, color: a.color ?? 'auto' })) };
    case 'creator-fan-city':
      if (!cr.audience?.topCities?.length) return null;
      return { bars: cr.audience.topCities.map((c) => ({ label: c.label, value: c.value, color: c.color ?? 'auto' })) };
    case 'creator-audience-profile': {
      const aud = cr.audience;
      if (!aud || (!aud.genderSplit?.length && !aud.ageRange?.length && !aud.topCities?.length)) return null;
      const pick = (arr?: { label: string; value: number; color?: string }[]) =>
        (arr ?? []).map((x) => ({ label: x.label, value: x.value, color: x.color }));
      return {
        modules: [
          { key: 'gender', selected: true, items: pick(aud.genderSplit) },
          { key: 'age', selected: true, items: pick(aud.ageRange) },
          { key: 'city', selected: true, items: pick(aud.topCities) },
        ],
      };
    }
    case 'creator-works-list':
    case 'creator-works-table':
    case 'work-screenshot':
      // 作品数据不再走同步 mock——改为在属性面板的 importer 中异步从 DB 获取
      return null;
    default:
      return null;
  }
}

/**
 * 纯 reducer：对 pageId 页面上的组件做绑定级联填充。
 * - 「新增组件」(newCompIds) → 无论源都填（首次落点）。
 * - 其余 → 仅当 _dataSource==='project'（跟随页面）才重填。
 * 填充 = 取 creatorPatch / campaignPatch / projectPatch 合并进 comp.data，并置 _dataSource='project'。
 * 无 patch（无数据 / 未登记）→ 不动该组件。
 *
 * project 型绑定需要额外参数 projectMeta（从 store 传入），用于填充项目级信息。
 */
export function applyPageBinding(
  pages: Page[],
  pageId: string,
  reportData: ReportDataContext,
  newCompIds: Set<string>,
  projectMeta?: { advertiser?: string; scenarioSub?: string; scenario?: string; businessLine?: string } | null,
): Page[] {
  const idx = pages.findIndex((p) => p.id === pageId);
  if (idx < 0) return pages;
  const page = pages[idx];
  const creator = resolvePageCreator(page, reportData);
  const campaign = resolvePageCampaign(page, reportData);
  // project 型不需要 creator/campaign 也能运行（直接从 reportData.campaign 取数据）
  const hasProjectData = !!reportData.campaign || !!projectMeta;
  const hasDmData = !!reportData.dmMonthly || !!reportData.dmBiweekly;

  const fill = (comp: EditorComponent): EditorComponent => {
    const kind = COMPONENT_BINDING_KIND[comp.type];
    if (!kind) return comp;
    const isNew = newCompIds.has(comp.id);
    const ds = (comp.data as { _dataSource?: DataSourceMode })._dataSource;
    const following = isNew || ds === 'project';
    if (!following) return comp;

    // project 型：跳过封面页标题组件（由 refreshReportTitle 管理）
    if (kind === 'project') {
      if (!hasProjectData) return comp;
      // 封面页标题组件跳过
      if (page.titleComponentId === comp.id) return comp;
      const patch = projectPatch(comp.type, page, projectMeta, reportData);
      if (!patch) return comp;
      return { ...comp, data: { ...comp.data, ...patch, _dataSource: 'project' } as unknown as ComponentData };
    }

    // dm 型：从 reportData.dmMonthly / dmBiweekly 读取
    if (kind === 'dm') {
      if (!hasDmData) return comp;
      const patch = dmPatch(
        comp.type,
        reportData.dmMonthly,
        reportData.dmBiweekly,
        projectMeta?.scenarioSub,
      );
      if (!patch) return comp;
      return { ...comp, data: { ...comp.data, ...patch, _dataSource: 'project' } as unknown as ComponentData };
    }

    // creator / campaign 型：需要对应的 page 级绑定
    if (!creator && !campaign) return comp;
    const patch =
      kind === 'creator' && creator
        ? creatorPatch(comp.type, creator, page.campaignId ?? '')
        : kind === 'campaign' && campaign
          ? campaignPatch(comp.type, campaign)
          : null;
    if (!patch) return comp;
    return { ...comp, data: { ...comp.data, ...patch, _dataSource: 'project' } as unknown as ComponentData };
  };

  const nextComps = page.components.map(fill);
  if (nextComps.every((c, i) => c === page.components[i])) return pages; // 无变化 → 原样返回
  const nextPages = pages.slice();
  nextPages[idx] = { ...page, components: nextComps };
  return nextPages;
}
