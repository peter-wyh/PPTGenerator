// order-stats.service.ts
// 订单日级统计中间层：recomputeOrderStats 从 CampaignOrder 物化到 OrderDailyStat，
// getRange 供报告链路（buildCampaignContext / mapCampaign）消费。
// 口径：Revenue = commission（Lead 模式 saleAmount 恒 £1 占位）；
//       日期 = 订单表已存 UTC 值 DATE_FORMAT 截断，不做二次时区转换；
//       customerAcquisition 标签缺失时 newCustomerOrders 恒 0 且 hasNewCustomerTag=false
//       （消费侧据此渲染 N/A，而非编造 0）。
import { prisma } from '../../prisma';
import { Prisma } from '@prisma/client';

/** 聚合行（campaignCreatorId=''）哨兵。 */
const TOTAL_ROW = '';

type StatBucket = {
  totalOrders: number;
  approvedOrders: number;
  pendingOrders: number;
  otherOrders: number;
  totalCommission: Prisma.Decimal;
  approvedCommission: Prisma.Decimal;
  pendingCommission: Prisma.Decimal;
  totalSaleAmount: Prisma.Decimal;
  newCustomerOrders: number;
  hasNewCustomerTag: boolean;
};

function emptyBucket(): StatBucket {
  return {
    totalOrders: 0, approvedOrders: 0, pendingOrders: 0, otherOrders: 0,
    totalCommission: new Prisma.Decimal(0),
    approvedCommission: new Prisma.Decimal(0),
    pendingCommission: new Prisma.Decimal(0),
    totalSaleAmount: new Prisma.Decimal(0),
    newCustomerOrders: 0, hasNewCustomerTag: false,
  };
}

/** queryRaw SUM 可能返回 string/Decimal/null，统一为 Decimal。 */
function dec(v: unknown): Prisma.Decimal {
  if (v === null || v === undefined) return new Prisma.Decimal(0);
  return new Prisma.Decimal(v as Prisma.Decimal.Value);
}

/**
 * 重算 campaign 的订单日级统计（幂等：事务内 delete 全量 + createMany）。
 * @returns { rows, dropped }  dropped = orderDate 为空被跳过的单量（无日期不进日级）。
 */
export async function recomputeOrderStats(campaignId: string): Promise<{ rows: number; dropped: number }> {
  // 1) 按 creator×date×status 聚合（groupIncludes 语义：orderDate IS NULL 的单不进结果）
  const grouped = await prisma.$queryRaw<{
    campaignCreatorId: string | null;
    statDate: string;
    orderStatus: string | null;
    cnt: bigint;
    commission: unknown;
    saleAmount: unknown;
    newCustomers: bigint;
  }[]>(Prisma.sql`
    SELECT campaignCreatorId,
           DATE_FORMAT(orderDate, '%Y-%m-%d') AS statDate,
           orderStatus,
           COUNT(*) AS cnt,
           SUM(commission) AS commission,
           SUM(saleAmount) AS saleAmount,
           SUM(CASE WHEN customerAcquisition IS NOT NULL AND customerAcquisition != '' THEN 1 ELSE 0 END) AS newCustomers
    FROM CampaignOrder
    WHERE campaignId = ${campaignId} AND orderDate IS NOT NULL
    GROUP BY campaignCreatorId, statDate, orderStatus
  `);

  // 2) 国家/设备维度：campaign×date 聚合（只挂聚合行）
  const countryRows = await prisma.$queryRaw<{
    statDate: string;
    country: string;
    cnt: bigint;
    commission: unknown;
  }[]>(Prisma.sql`
    SELECT DATE_FORMAT(orderDate, '%Y-%m-%d') AS statDate,
           customerCountry AS country,
           COUNT(*) AS cnt,
           SUM(commission) AS commission
    FROM CampaignOrder
    WHERE campaignId = ${campaignId} AND orderDate IS NOT NULL
      AND customerCountry IS NOT NULL AND customerCountry != ''
    GROUP BY statDate, country
  `);
  const topCountriesByDate = new Map<string, { country: string; orders: number; commission: string }[]>();
  for (const r of countryRows) {
    const list = topCountriesByDate.get(r.statDate) ?? [];
    list.push({ country: r.country, orders: Number(r.cnt), commission: dec(r.commission).toFixed(2) });
    topCountriesByDate.set(r.statDate, list);
  }
  for (const [date, list] of topCountriesByDate) {
    list.sort((a, b) => b.orders - a.orders);
    topCountriesByDate.set(date, list.slice(0, 5));
  }

  // ★ 设备维度(clickDevice 100% 有值——43 列镜像中此前未被利用的维度)
  const deviceRows = await prisma.$queryRaw<{
    statDate: string;
    device: string;
    cnt: bigint;
  }[]>(Prisma.sql`
    SELECT DATE_FORMAT(orderDate, '%Y-%m-%d') AS statDate,
           clickDevice AS device,
           COUNT(*) AS cnt
    FROM CampaignOrder
    WHERE campaignId = ${campaignId} AND orderDate IS NOT NULL
      AND clickDevice IS NOT NULL AND clickDevice != ''
    GROUP BY statDate, device
  `);
  const topDevicesByDate = new Map<string, { device: string; orders: number }[]>();
  for (const r of deviceRows) {
    const list = topDevicesByDate.get(r.statDate) ?? [];
    list.push({ device: r.device, orders: Number(r.cnt) });
    topDevicesByDate.set(r.statDate, list);
  }
  for (const [date, list] of topDevicesByDate) {
    list.sort((a, b) => b.orders - a.orders);
    topDevicesByDate.set(date, list.slice(0, 5));
  }

  // 3) 归并：creator×date 桶 + 全 campaign 聚合桶（同日累加）
  const byKey = new Map<string, StatBucket & { campaignCreatorId: string; statDate: string; hasTag: boolean }>();
  const totalByDate = new Map<string, StatBucket>();
  for (const g of grouped) {
    const date = String(g.statDate);
    const creatorId = g.campaignCreatorId ?? ''; // 无归因的单只进聚合行
    // 状态归一化:AWIN 词表(Approved/Pending)与种子/其他源词表(paid/refunded 等)统一到桶。
    const raw = (g.orderStatus ?? '').trim().toLowerCase();
    const status =
      raw === 'approved' || raw === 'paid' || raw === 'confirmed'
        ? 'Approved'
        : raw === 'pending'
          ? 'Pending'
          : raw; // refunded/declined/... → other 桶
    const newCust = Number(g.newCustomers);

    const addInto = (b: StatBucket) => {
      b.totalOrders += Number(g.cnt);
      if (status === 'Approved') {
        b.approvedOrders += Number(g.cnt);
        b.approvedCommission = b.approvedCommission.plus(dec(g.commission));
      } else if (status === 'Pending') {
        b.pendingOrders += Number(g.cnt);
        b.pendingCommission = b.pendingCommission.plus(dec(g.commission));
      } else {
        b.otherOrders += Number(g.cnt);
      }
      b.totalCommission = b.totalCommission.plus(dec(g.commission));
      b.totalSaleAmount = b.totalSaleAmount.plus(dec(g.saleAmount));
      b.newCustomerOrders += newCust;
      if (newCust > 0) b.hasNewCustomerTag = true;
    };

    if (creatorId) {
      const key = `${creatorId}::${date}`;
      let row = byKey.get(key);
      if (!row) {
        const b = emptyBucket();
        row = { ...b, campaignCreatorId: creatorId, statDate: date, hasTag: false };
        byKey.set(key, row);
      }
      addInto(row);
    }

    const total = totalByDate.get(date) ?? emptyBucket();
    addInto(total);
    totalByDate.set(date, total);
  }

  // 4) 组装行：聚合行（''）+ creator×date 行
  const now = new Date();
  const rows: Prisma.OrderDailyStatCreateManyInput[] = [];
  for (const [date, b] of totalByDate) {
    rows.push({
      campaignId,
      campaignCreatorId: TOTAL_ROW,
      statDate: date,
      totalOrders: b.totalOrders,
      approvedOrders: b.approvedOrders,
      pendingOrders: b.pendingOrders,
      otherOrders: b.otherOrders,
      totalCommission: b.totalCommission,
      approvedCommission: b.approvedCommission,
      pendingCommission: b.pendingCommission,
      totalSaleAmount: b.totalSaleAmount,
      newCustomerOrders: b.newCustomerOrders,
      hasNewCustomerTag: b.hasNewCustomerTag,
      topCountries: topCountriesByDate.get(date) ?? undefined,
      topDevices: topDevicesByDate.get(date) ?? undefined,
      recomputedAt: now,
    });
  }
  for (const row of byKey.values()) {
    rows.push({
      campaignId,
      campaignCreatorId: row.campaignCreatorId,
      statDate: row.statDate,
      totalOrders: row.totalOrders,
      approvedOrders: row.approvedOrders,
      pendingOrders: row.pendingOrders,
      otherOrders: row.otherOrders,
      totalCommission: row.totalCommission,
      approvedCommission: row.approvedCommission,
      pendingCommission: row.pendingCommission,
      totalSaleAmount: row.totalSaleAmount,
      newCustomerOrders: row.newCustomerOrders,
      hasNewCustomerTag: row.hasNewCustomerTag,
      recomputedAt: now,
    });
  }

  // 5) orderDate 为空的单量（对账用）
  const [nullDate] = await prisma.$queryRaw<{ cnt: bigint }[]>(
    Prisma.sql`SELECT COUNT(*) AS cnt FROM CampaignOrder WHERE campaignId = ${campaignId} AND orderDate IS NULL`,
  );

  await prisma.$transaction([
    prisma.orderDailyStat.deleteMany({ where: { campaignId } }),
    ...(rows.length ? [prisma.orderDailyStat.createMany({ data: rows })] : []),
  ]);

  return { rows: rows.length, dropped: Number(nullDate?.cnt ?? 0) };
}

export interface OrderStatsRange {
  /** 按日升序的聚合行（仅含有订单的日期）。 */
  days: {
    date: string;
    orders: number;
    approvedOrders: number;
    pendingOrders: number;
    otherOrders: number;
    commission: number;
    approvedCommission: number;
    pendingCommission: number;
    newCustomers: number;
    topCountries: { country: string; orders: number; commission: string }[];
    topDevices: { device: string; orders: number }[];
  }[];
  totals: {
    orders: number;
    approvedOrders: number;
    pendingOrders: number;
    otherOrders: number;
    commission: number;
    approvedCommission: number;
    pendingCommission: number;
    newCustomers: number;
    hasNewCustomerTag: boolean;
  };
  /** creator 维度全期求和（该区间内）。key = CampaignCreator.id */
  byCreator: Map<string, {
    orders: number;
    approvedOrders: number;
    pendingOrders: number;
    commission: number;
    newCustomers: number;
  }>;
}

/**
 * 读取 campaign 的中间层统计区间。
 * @returns null = 该 campaign 无任何中间层行（未 recompute / 无订单）——消费侧据此回落 daily JSON。
 */
export async function getRange(
  campaignId: string,
  start?: string,
  end?: string,
): Promise<OrderStatsRange | null> {
  const where: Prisma.OrderDailyStatWhereInput = {
    campaignId,
    ...(start || end ? {
      statDate: {
        ...(start ? { gte: start } : {}),
        ...(end ? { lte: end } : {}),
      },
    } : {}),
  };
  const [totalRows, creatorRows] = await Promise.all([
    prisma.orderDailyStat.findMany({
      where: { ...where, campaignCreatorId: TOTAL_ROW },
      orderBy: { statDate: 'asc' },
    }),
    prisma.orderDailyStat.findMany({ where: { ...where, campaignCreatorId: { not: TOTAL_ROW } } }),
  ]);
  if (!totalRows.length) return null;

  const days = totalRows.map((r) => ({
    date: r.statDate,
    orders: r.totalOrders,
    approvedOrders: r.approvedOrders,
    pendingOrders: r.pendingOrders,
    otherOrders: r.otherOrders,
    commission: Number(r.totalCommission),
    approvedCommission: Number(r.approvedCommission),
    pendingCommission: Number(r.pendingCommission),
    newCustomers: r.newCustomerOrders,
    topCountries: (r.topCountries as OrderStatsRange['days'][number]['topCountries']) ?? [],
    topDevices: (r.topDevices as OrderStatsRange['days'][number]['topDevices']) ?? [],
  }));
  const totals = days.reduce(
    (a, d) => ({
      orders: a.orders + d.orders,
      approvedOrders: a.approvedOrders + d.approvedOrders,
      pendingOrders: a.pendingOrders + d.pendingOrders,
      otherOrders: a.otherOrders + d.otherOrders,
      commission: Math.round((a.commission + d.commission) * 100) / 100,
      approvedCommission: Math.round((a.approvedCommission + d.approvedCommission) * 100) / 100,
      pendingCommission: Math.round((a.pendingCommission + d.pendingCommission) * 100) / 100,
      newCustomers: a.newCustomers + d.newCustomers,
      hasNewCustomerTag: a.hasNewCustomerTag || totalRows.some((r) => r.hasNewCustomerTag),
    }),
    {
      orders: 0, approvedOrders: 0, pendingOrders: 0, otherOrders: 0,
      commission: 0, approvedCommission: 0, pendingCommission: 0,
      newCustomers: 0, hasNewCustomerTag: false,
    },
  );

  const byCreator = new Map<string, OrderStatsRange['byCreator'] extends Map<string, infer V> ? V : never>();
  for (const r of creatorRows) {
    const cur = byCreator.get(r.campaignCreatorId) ?? {
      orders: 0, approvedOrders: 0, pendingOrders: 0, commission: 0, newCustomers: 0,
    };
    cur.orders += r.totalOrders;
    cur.approvedOrders += r.approvedOrders;
    cur.pendingOrders += r.pendingOrders;
    cur.commission = Math.round((cur.commission + Number(r.totalCommission)) * 100) / 100;
    cur.newCustomers += r.newCustomerOrders;
    byCreator.set(r.campaignCreatorId, cur);
  }

  return { days, totals, byCreator };
}

export const orderStatsService = { recomputeOrderStats, getRange };
