// publisher-stats.service.ts
// 媒体日统计中间层：recomputePublisherStats 从 CampaignOrder（成交侧）+
// LinkPerformance.daily（流量侧）物化到 PublisherDailyStat。
// 达人数据统计 / campaign 数据统计的直查源（Click_References 口径的落库形态）。
// 口径对齐 order-stats.service：日期 = 订单表已存 UTC 值截断，不做二次时区转换；
// 成交侧 gmv 存 saleAmount SUM（Lead 模式为占位值，消费侧需按 type 区分），
// commission 为真实收益真源；流量侧 clicks/impressions 仅当链接效果已导入才有值。
import { prisma } from '../../prisma';
import { Prisma } from '@prisma/client';

/** queryRaw SUM 可能返回 string/Decimal/null，统一为 Decimal。 */
function dec(v: unknown): Prisma.Decimal {
  if (v === null || v === undefined) return new Prisma.Decimal(0);
  if (v instanceof Prisma.Decimal) return v;
  return new Prisma.Decimal(Number(v) || 0);
}

/**
 * 重算 campaign 的媒体日统计。
 * @returns rows = 写入/更新的 (campaign × publisher × date) 行数；dropped = 无 publisherId 或无 orderDate 被跳过的订单数
 */
export async function recomputePublisherStats(campaignId: string): Promise<{ rows: number; dropped: number }> {
  // 1) 成交侧：订单表按 (publisherId, DATE(orderDate)) 聚合
  const dealRows = (await prisma.$queryRawUnsafe(
    `SELECT publisherId, DATE_FORMAT(orderDate, '%Y-%m-%d') AS statDate,
            COUNT(*) AS orders,
            COALESCE(SUM(saleAmount), 0) AS gmv,
            COALESCE(SUM(commission), 0) AS commission
     FROM CampaignOrder
     WHERE campaignId = ? AND publisherId IS NOT NULL AND publisherId != '' AND orderDate IS NOT NULL
     GROUP BY publisherId, statDate`,
    campaignId,
  )) as Array<{ publisherId: string; statDate: string; orders: number; gmv: unknown; commission: unknown }>;
  const [noPub] = (await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS n FROM CampaignOrder
     WHERE campaignId = ? AND (publisherId IS NULL OR publisherId = '' OR orderDate IS NULL)`,
    campaignId,
  )) as Array<{ n: number }>;

  // 2) 流量侧：LinkPerformance.daily JSON 合并为 (publisherId, date) → {clicks, impressions}
  const traffic = new Map<string, { clicks: number; impressions: number }>();
  const links = await prisma.linkPerformance.findMany({
    where: { campaignId },
    select: { publisherId: true, daily: true },
  });
  for (const l of links) {
    const arr = Array.isArray(l.daily) ? (l.daily as Array<{ date?: unknown; clicks?: unknown; impressions?: unknown }>) : [];
    for (const d of arr) {
      const date = String(d.date ?? '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const key = `${l.publisherId}::${date}`;
      const cell = traffic.get(key) ?? { clicks: 0, impressions: 0 };
      cell.clicks += Number(d.clicks ?? 0) || 0;
      cell.impressions += Number(d.impressions ?? 0) || 0;
      traffic.set(key, cell);
    }
  }

  // 3) 合并键集：成交 ∪ 流量（仅有流量无成交的日也建行，orders=0）
  const keys = new Set<string>();
  for (const r of dealRows as Array<{ publisherId: string; statDate: string }>) keys.add(`${r.publisherId}::${r.statDate}`);
  for (const k of traffic.keys()) keys.add(k);

  // 4) upsert 写入
  const dealMap = new Map<string, { orders: number; gmv: Prisma.Decimal; commission: Prisma.Decimal }>();
  for (const r of dealRows as Array<{ publisherId: string; statDate: string; orders: number; gmv: unknown; commission: unknown }>) {
    dealMap.set(`${r.publisherId}::${r.statDate}`, {
      orders: Number(r.orders) || 0,
      gmv: dec(r.gmv),
      commission: dec(r.commission),
    });
  }

  let rows = 0;
  for (const key of keys) {
    const [publisherId, statDate] = key.split('::');
    const d = dealMap.get(key) ?? { orders: 0, gmv: new Prisma.Decimal(0), commission: new Prisma.Decimal(0) };
    const t = traffic.get(key) ?? { clicks: 0, impressions: 0 };
    await prisma.publisherDailyStat.upsert({
      where: { campaignId_publisherId_statDate: { campaignId, publisherId, statDate } },
      create: {
        campaignId, publisherId, statDate,
        clicks: t.clicks, impressions: t.impressions,
        orders: d.orders, gmv: d.gmv, commission: d.commission,
      },
      update: {
        clicks: t.clicks, impressions: t.impressions,
        orders: d.orders, gmv: d.gmv, commission: d.commission,
        recomputedAt: new Date(),
      },
    });
    rows++;
  }

  // 5) 清理孤儿：该 campaign 下已不在键集内的旧行（重导删除订单后残留）
  if (rows > 0 || keys.size === 0) {
    const stale = await prisma.publisherDailyStat.findMany({
      where: { campaignId },
      select: { publisherId: true, statDate: true },
    });
    for (const s of stale) {
      if (!keys.has(`${s.publisherId}::${s.statDate}`)) {
        await prisma.publisherDailyStat.deleteMany({ where: { campaignId, publisherId: s.publisherId, statDate: s.statDate } });
      }
    }
  }

  return { rows, dropped: Number((noPub as { n: number })?.n) || 0 };
}
