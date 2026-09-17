// publisher-stats.service.ts
// 媒体×合作×日 统计主表（PublisherDailyStat）重算服务。
// 0917 合并：原 CreatorCpsDailyStat 并入本表——粒度细化为
//   (campaign × publisher × campaignCreator? × date)：
//   campaignCreatorId 非空 = 合作行切片（达人 CPS 视图读这里）；
//   NULL = 纯媒体行（无合作挂载的链接/订单）。
// 媒体视图 = 按 (publisher, date) GROUP BY 切片求和；达人 CPS 视图 = cc 非空切片。
// 数据源（口径不变）：
//   成交侧 = CampaignOrder 按 (publisher, cc, 日) 聚合；
//   流量侧 = LinkPerformance.daily 按 (publisher, cc, 日) 合并（数组式；键值式历史格式兼容）。
import { prisma } from '../../prisma';
import { Prisma } from '@prisma/client';

/** queryRaw SUM 可能返回 string/Decimal/null，统一为 Decimal。 */
function dec(v: unknown): Prisma.Decimal {
  if (v === null || v === undefined) return new Prisma.Decimal(0);
  if (v instanceof Prisma.Decimal) return v;
  return new Prisma.Decimal(Number(v) || 0);
}

/**
 * 重算 campaign 的统计主表（媒体×合作×日，全粒度）。
 * @returns rows = 写入/更新的行数；dropped = 无 publisherId 或无 orderDate 被跳过的订单数
 */
export async function recomputePublisherStats(campaignId: string): Promise<{ rows: number; dropped: number }> {
  // 1) 成交侧：订单按 (publisherId, campaignCreatorId, DATE(orderDate)) 聚合。
  //    campaignCreatorId 取闭环归因（直接 FK 优先，LP 兜底）——与原 CPS 表同口径，
  //    无合作归因的订单 cc 为 NULL 落纯媒体行。
  const dealRows = (await prisma.$queryRaw(Prisma.sql`
    SELECT o.publisherId,
           COALESCE(o.campaignCreatorId, lp.campaignCreatorId) AS ccId,
           DATE_FORMAT(o.orderDate, '%Y-%m-%d') AS statDate,
           COUNT(*) AS orders,
           COALESCE(SUM(o.saleAmount), 0) AS gmv,
           COALESCE(SUM(o.commission), 0) AS commission,
           SUM(CASE WHEN UPPER(o.customerAcquisition) IN ('NEW', '新客') THEN 1 ELSE 0 END) AS newCust
    FROM CampaignOrder o
    LEFT JOIN LinkPerformance lp ON lp.id = o.linkPerformanceId
    WHERE o.campaignId = ${campaignId} AND o.publisherId IS NOT NULL AND o.publisherId != '' AND o.orderDate IS NOT NULL
    GROUP BY o.publisherId, ccId, statDate`)) as Array<{ publisherId: string; ccId: string | null; statDate: string; orders: number; gmv: unknown; commission: unknown; newCust: number }>;
  const [noPub] = (await prisma.$queryRaw(Prisma.sql`
    SELECT COUNT(*) AS n FROM CampaignOrder
    WHERE campaignId = ${campaignId} AND (publisherId IS NULL OR publisherId = '' OR orderDate IS NULL)`)) as Array<{ n: number }>;

  // 2) 流量侧：LinkPerformance.daily 合并为 (publisherId, ccId, date) → {clicks, impressions}
  //    链接的 campaignCreatorId 即切片键（无挂载 → NULL 纯媒体行）；键值式历史格式兼容。
  const traffic = new Map<string, { clicks: number; impressions: number }>();
  const links = await prisma.linkPerformance.findMany({
    where: { campaignId },
    select: { publisherId: true, campaignCreatorId: true, daily: true },
  });
  for (const l of links) {
    const d = l.daily as unknown;
    let arr: Array<{ date?: unknown; clicks?: unknown; impressions?: unknown }> = [];
    if (Array.isArray(d)) arr = d;
    else if (d && typeof d === 'object') arr = Object.entries(d as Record<string, unknown>).map(([date, cell]) => ({ date, ...(cell as object) }));
    for (const row of arr) {
      const date = String(row.date ?? '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const key = `${l.publisherId}::${l.campaignCreatorId ?? 'NULL'}::${date}`;
      const cell = traffic.get(key) ?? { clicks: 0, impressions: 0 };
      cell.clicks += Number(row.clicks ?? 0) || 0;
      cell.impressions += Number(row.impressions ?? 0) || 0;
      traffic.set(key, cell);
    }
  }

  // 3) 合并键集：成交 ∪ 流量（仅有流量无成交的日也建行，orders=0）
  const keys = new Set<string>();
  for (const r of dealRows) keys.add(`${r.publisherId}::${r.ccId ?? 'NULL'}::${r.statDate}`);
  for (const k of traffic.keys()) keys.add(k);

  // 4) upsert 写入（切片粒度；键含 ccId，MySQL unique 键对 NULL 列需 id 兜底更新——
  //    cc 为 NULL 的键用 findFirst 定位旧行，避免 unique(NULL) 语义坑）
  const dealMap = new Map<string, { orders: number; gmv: Prisma.Decimal; commission: Prisma.Decimal; newCust: number }>();
  for (const r of dealRows) {
    dealMap.set(`${r.publisherId}::${r.ccId ?? 'NULL'}::${r.statDate}`, {
      orders: Number(r.orders) || 0,
      gmv: dec(r.gmv),
      commission: dec(r.commission),
      newCust: Number(r.newCust) || 0,
    });
  }

  let rows = 0;
  for (const key of keys) {
    const [publisherId, ccToken, statDate] = key.split('::');
    const ccId = ccToken === 'NULL' ? null : ccToken;
    const d = dealMap.get(key) ?? { orders: 0, gmv: new Prisma.Decimal(0), commission: new Prisma.Decimal(0), newCust: 0 };
    const t = traffic.get(key) ?? { clicks: 0, impressions: 0 };
    if (ccId) {
      await prisma.publisherDailyStat.upsert({
        where: { campaignId_publisherId_campaignCreatorId_statDate: { campaignId, publisherId, campaignCreatorId: ccId, statDate } },
        create: {
          campaignId, publisherId, campaignCreatorId: ccId, statDate,
          clicks: t.clicks, impressions: t.impressions,
          orders: d.orders, gmv: d.gmv, commission: d.commission, newCustomerOrders: d.newCust,
        },
        update: {
          clicks: t.clicks, impressions: t.impressions,
          orders: d.orders, gmv: d.gmv, commission: d.commission, newCustomerOrders: d.newCust,
          recomputedAt: new Date(),
        },
      });
    } else {
      // cc=NULL 行：unique 索引对 NULL 不判重 → 先查旧行再 update/create
      const existing = await prisma.publisherDailyStat.findFirst({
        where: { campaignId, publisherId, campaignCreatorId: null, statDate },
        select: { id: true },
      });
      const data = {
        clicks: t.clicks, impressions: t.impressions,
        orders: d.orders, gmv: d.gmv, commission: d.commission, newCustomerOrders: d.newCust,
        recomputedAt: new Date(),
      };
      if (existing) await prisma.publisherDailyStat.update({ where: { id: existing.id }, data });
      else await prisma.publisherDailyStat.create({ data: { campaignId, publisherId, campaignCreatorId: null, statDate, ...data } });
    }
    rows++;
  }

  // 5) 清理孤儿：该 campaign 下已不在键集内的旧行（重导删除订单后残留；
  //    0917 合并后的旧纯媒体重复行也在重算时被此步收敛删除）
  if (rows > 0 || keys.size === 0) {
    const stale = await prisma.publisherDailyStat.findMany({
      where: { campaignId },
      select: { publisherId: true, campaignCreatorId: true, statDate: true },
    });
    for (const s of stale) {
      if (!keys.has(`${s.publisherId}::${s.campaignCreatorId ?? 'NULL'}::${s.statDate}`)) {
        await prisma.publisherDailyStat.deleteMany({
          where: { campaignId, publisherId: s.publisherId, campaignCreatorId: s.campaignCreatorId, statDate: s.statDate },
        });
      }
    }
  }

  return { rows, dropped: Number((noPub as { n: number })?.n) || 0 };
}
