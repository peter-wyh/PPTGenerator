// mapper.ts
import { prisma } from '../../../../prisma';
import { ApiError } from '../../../../utils/ApiError';
import { formatMoney, formatNum, formatPct } from '../format';
import type { CampaignReportContent } from './schema';

type Any = Record<string, any>;

function metric(m: Any | null, key: string): number {
  return Number((m as Any)?.[key] ?? 0);
}

/** "2026-10-12" → "Oct 12"。 */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

export async function mapCampaign(campaignId: string): Promise<CampaignReportContent> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      campaignCreators: { include: { creator: true, performance: true, cpsPerformances: true } },
      businessLine: true, advertiser: true,
    },
  });
  if (!campaign) throw ApiError.notFound('Campaign 不存在');

  const m = (campaign.metrics ?? {}) as Any;
  const analytics = (campaign.analytics ?? {}) as Any;
  const trendSrc = analytics.trend ?? {};

  const totalRevenue = metric(m, 'totalRevenue');
  const clicks = metric(m, 'clicks');
  const orders = metric(m, 'orders');
  const newCustomers = metric(m, 'newCustomers');
  const aov = metric(m, 'aov') || (orders ? totalRevenue / orders : 0);

  const publishers = campaign.campaignCreators.map((cc) => {
    const cps = cc.cpsPerformances.reduce(
      (a, p) => ({ clicks: a.clicks + p.clicks, orders: a.orders + p.orders, gmv: a.gmv + Number(p.gmv) }),
      { clicks: 0, orders: 0, gmv: 0 },
    );
    const partner = cc.creator?.partnerType ?? 'creator';
    const kind = partner === 'content_site' ? 'site' : partner === 'community' ? 'fb' : 'creator';
    const platform = cc.creator?.platform ?? campaign.platform;
    return {
      name: cc.creator?.name ?? 'Unknown',
      handle: cc.creator?.handle || undefined,
      type: { label: kind === 'creator' ? 'Creator' : kind === 'site' ? 'Site' : 'Community', kind: kind as any },
      screenshotUrl: `https://placehold.co/120x68/f5f7fa/1e1c24?text=${encodeURIComponent(platform)}`,
      revenue: formatMoney(cps.gmv),
      clicks: formatNum(cps.clicks),
      orders: formatNum(cps.orders),
      linkUrl: cc.creator?.profileUrl || undefined,
    };
  });

  const newCustomerRate = metric(m, 'newCustomerRate');
  const insights = newCustomerRate
    ? {
        newCustomerRate: {
          rate: formatPct(Math.round(newCustomerRate * 10) / 10),
          newCount: newCustomers,
          totalOrders: orders,
          deltaPct: m.newCustomerDelta ? formatPct(Math.round(Number(m.newCustomerDelta) * 10) / 10) : undefined,
        },
      }
    : {};

  return {
    header: {
      brand: { name: campaign.businessLine?.name ?? campaign.businessLineCode ?? 'Brand', logoText: (campaign.businessLine?.name ?? campaign.businessLineCode ?? 'brand').toLowerCase() },
      merchant: { name: campaign.advertiser?.name ?? campaign.advertiserName ?? 'Merchant', logoText: (campaign.advertiser?.name ?? campaign.advertiserName ?? 'M').slice(0, 2).toUpperCase() },
      period: { start: campaign.startDate, end: campaign.endDate, display: `${shortDate(campaign.startDate)} - ${shortDate(campaign.endDate)}, ${campaign.startDate.slice(0, 4)}` },
    },
    kpis: [
      { label: 'Total Revenues', value: formatMoney(totalRevenue) },
      { label: 'Clicks', value: formatNum(clicks) },
      { label: 'Orders', value: formatNum(orders) },
      { label: 'New Customer Acquisition', value: formatNum(newCustomers), highlight: true },
      { label: 'AOV', value: formatMoney(aov) },
    ],
    trend: {
      labels: trendSrc.labels ?? [],
      revenue: trendSrc.revenue ?? [],
      clicks: trendSrc.clicks ?? [],
      orders: trendSrc.orders ?? [],
    },
    publishers,
    insights: Object.keys(insights).length ? insights : undefined,
    actionable: [], // 由 narrative 填
  };
}
