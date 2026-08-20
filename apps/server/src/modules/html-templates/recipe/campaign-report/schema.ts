import { z } from 'zod';

export const CampaignReportContent = z.object({
  header: z.object({
    brand: z.object({ name: z.string(), logoText: z.string(), logoImgUrl: z.string().optional() }),
    merchant: z.object({ name: z.string(), logoText: z.string() }),
    period: z.object({ start: z.string(), end: z.string(), display: z.string() }),
  }),
  kpis: z.array(z.object({ label: z.string(), value: z.string(), highlight: z.boolean().optional() })),
  trend: z.object({
    labels: z.array(z.string()),
    revenue: z.array(z.number()),
    clicks: z.array(z.number()),
    orders: z.array(z.number()),
    /** false = daily 无 clicks 数据源,趋势图不渲染 Clicks 线(宁缺勿假,不画贴地 0 线)。 */
    hasClicks: z.boolean().optional(),
  }),
  publishers: z.array(z.object({
    name: z.string(),
    handle: z.string().optional(),
    type: z.object({ label: z.string(), kind: z.enum(['creator', 'fb', 'tg', 'site', 'other']) }),
    screenshotUrl: z.string(),
    revenue: z.string(),
    clicks: z.string(),
    orders: z.string(),
    linkUrl: z.string().optional(),
  })),
  insights: z.object({
    topCategories: z.array(z.object({ label: z.string(), pct: z.number(), color: z.string() })).optional(),
    topProducts: z.array(z.object({ name: z.string(), revenue: z.string() })).optional(),
    topMarket: z.array(z.object({ country: z.string(), revenue: z.string(), pct: z.number(), color: z.string() })).optional(),
    topDevices: z.array(z.object({ device: z.string(), orders: z.number(), pct: z.number() })).optional(),
    topPromotion: z.array(z.object({
      name: z.string(), type: z.string(), revenue: z.string(), usage: z.string(), tagKind: z.string(),
    })).optional(),
    newCustomerRate: z.object({
      rate: z.string(), newCount: z.number(), totalOrders: z.number(), deltaPct: z.string().optional(),
    }).optional(),
    mom: z.object({
      ordersMoM: z.string(), salesMoM: z.string(),
      currentOrders: z.number(), previousOrders: z.number(),
      currentSales: z.number(), previousSales: z.number(),
    }).optional(),
  }).optional(),
  /** 「宁缺勿假」覆盖元信息:无 daily→covered=null;missingDays>0→报告需明示区间。 */
  dataCoverage: z.object({
    requested: z.object({ start: z.string(), end: z.string() }),
    covered: z.object({ start: z.string(), end: z.string() }).nullable(),
    missingDays: z.number(),
    complete: z.boolean(),
  }).optional(),
  actionable: z.array(z.object({
    icon: z.string(),
    color: z.string(),
    title: z.string(),
    items: z.array(z.object({ text: z.string(), sub: z.string().optional() })),
    footer: z.string(),
  })),
});

export type CampaignReportContent = z.infer<typeof CampaignReportContent>;
