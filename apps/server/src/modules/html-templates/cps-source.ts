/**
 * CPS 效果统一取数（cps-daily 导入废弃后的新真源）。
 *
 * 背景：CpsPerformance 冻结（存量保留、不再写入）。报告/统计取数切换：
 *   - 流量侧（clicks/impressions/spend，含每日）：LinkPerformance.daily（数组式
 *     {date,clicks,impressions,spend}）
 *   - 成交侧（orders/gmv/commission/newCustomers，含每日）：CampaignOrder 逐单现算
 *     （真源；newCustomers = customerAcquisition='New' 标签计数）
 *
 * ★ 数据闭环（0826 定稿）：订单来自链接，链接来自媒体合作。
 *   LinkPerformance.campaignCreatorId 直接挂合作行（1:1 唯一约束）；
 *   归因优先级：直接 FK > publisher.creatorId 间接推导（未回填兜底）> __campaign__ 桶。
 *   未归因到合作行的链接只进 campaign 级合计（__campaign__ 桶）。
 */
import { prisma } from '../../prisma';
import { Prisma } from '@prisma/client';

export interface DailyCell {
  clicks: number; impressions: number; spend: number;
  orders: number; gmv: number; commission: number; newCustomers: number;
  /** 流量侧来源标记:该 cell 至少有一条 LP daily 行(clicks 字段真实存在,0 即真 0)。 */
  fromLp?: boolean;
}

export interface CreatorCps {
  /** 周期标量：流量来自 LinkPerformance 聚合列；成交来自订单表全量。 */
  clicks: number; impressions: number; spend: number;
  orders: number; gmv: number; commission: number; newCustomers: number;
  /** 每日合并（流量侧 LP.daily × 成交侧订单按日聚合；日期并集）。 */
  daily: Map<string, DailyCell>;
  /** 链接明细（contentType 统一 tracking_url——LP 无内容类型维度）。 */
  links: {
    contentType: string; linkUrl: string | null;
    clicks: number; impressions: number; orders: number; gmv: number; commission: number; spend: number;
  }[];
}

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/**
 * ★ 行级合并视图（CpsPerformance 冻结后报告链路的统一行源）。
 *
 * 每个合作行的「CPS 行」= 未迁移的 CpsPerformance 存量行 + LinkPerformance 伪行：
 *   - LP 行归因：campaignCreatorId 直接 FK（闭环）> publisher.creatorId 间接推导
 *     （未回填兜底）> migratedFromCpsId 溯源回溯；
 *   - 都归不上 -> 只进 '__campaign__' 桶（campaign 级合计，不进任何合作行）。
 *
 * 消费端把 `cc.cpsPerformances` 换成 `merged.get(cc.id) ?? []` 即可，行形状兼容
 * （clicks/impressions/orders/gmv/commission/spend/linkUrl/contentType/daily 数组）。
 * 防双计：已迁移的 CPS 行（daily/聚合列已复制进 LP）一律跳过。
 */
export interface MergedCpsRow {
  id: string;
  contentType: string;
  linkUrl: string | null;
  clicks: number; impressions: number; orders: number;
  gmv: number; commission: number; spend: number;
  daily: Record<string, unknown>[];
}

type Any = Record<string, any>;

export function mergeCpsRows(campaign: Any): Map<string, MergedCpsRow[]> {
  const ccs: Any[] = campaign?.campaignCreators ?? [];
  const lps: Any[] = campaign?.linkPerformances ?? [];

  // cpsId -> ccId（迁移行回溯归因用）
  const ccByCpsId = new Map<string, string>();
  const migratedIds = new Set<string>();
  for (const lp of lps) if (lp?.migratedFromCpsId) migratedIds.add(lp.migratedFromCpsId);
  for (const cc of ccs) {
    for (const p of cc?.cpsPerformances ?? []) ccByCpsId.set(p.id, cc.id);
  }
  const ccIds = new Set(ccs.map((cc) => cc?.id).filter(Boolean));

  const out = new Map<string, MergedCpsRow[]>();
  const push = (ccId: string, row: MergedCpsRow) => {
    const arr = out.get(ccId); if (arr) arr.push(row); else out.set(ccId, [row]);
  };

  // 1) 未迁移 CPS 存量行（形状原样--含维度标签等 LP 没有的字段，经 as 兼容）
  for (const cc of ccs) {
    for (const p of cc?.cpsPerformances ?? []) {
      if (migratedIds.has(p.id)) continue; // 已复制进 LP，防双计
      push(cc.id, p as MergedCpsRow);
    }
  }
  // 2) LinkPerformance 伪行（新真源：聚合列 + daily 数组式 {date,clicks,impressions,spend}）
  for (const lp of lps) {
    // ★ 闭环归因：直接 FK 优先；间接推导仅作未回填兜底
    const ccId = (lp.campaignCreatorId && ccIds.has(lp.campaignCreatorId) ? lp.campaignCreatorId : null)
      ?? (lp.publisher?.creatorId && ccs.find((cc) => cc?.creatorId === lp.publisher.creatorId)?.id)
      ?? (lp.migratedFromCpsId ? ccByCpsId.get(lp.migratedFromCpsId) : null)
      ?? '__campaign__';
    push(ccId, {
      id: lp.id,
      contentType: 'tracking_url',
      linkUrl: lp.linkUrl ?? null,
      clicks: num(lp.clicks), impressions: num(lp.impressions), orders: num(lp.orders),
      gmv: num(lp.gmv), commission: num(lp.commission), spend: num(lp.spend),
      daily: Array.isArray(lp.daily) ? lp.daily : [],
    });
  }
  return out;
}

export async function loadCreatorCps(campaignId: string): Promise<{
  /** ccId → 聚合（含 '__campaign__' 桶：未归因 creator 的链接/订单只进 campaign 级）。 */
  byCc: Map<string, CreatorCps>;
  /** campaign 级每日合并（全部行并集）。 */
  campaignDaily: Map<string, DailyCell>;
  /** campaign 级周期合计（全部行含未归因）。 */
  totals: { clicks: number; impressions: number; spend: number; orders: number; gmv: number; commission: number; newCustomers: number };
  /** 有真实日数据的行数（判定 hasDaily 用）。 */
  dailyRowCount: number;
  /** cc 列表（id → creatorId/name 映射，供消费者定位）。 */
  ccList: { id: string; creatorId: string | null; creatorName: string }[];
}> {
  const ccs = await prisma.campaignCreator.findMany({
    where: { campaignId },
    select: { id: true, creatorId: true, creator: { select: { name: true } } },
  });
  const ccList = ccs.map((c) => ({ id: c.id, creatorId: c.creatorId, creatorName: c.creator?.name ?? c.id }));
  const ccByCreatorId = new Map(ccs.filter((c) => c.creatorId).map((c) => [c.creatorId as string, c.id]));

  const emptyCell = (): DailyCell => ({ clicks: 0, impressions: 0, spend: 0, orders: 0, gmv: 0, commission: 0, newCustomers: 0 });
  const emptyCps = (): CreatorCps => ({ clicks: 0, impressions: 0, spend: 0, orders: 0, gmv: 0, commission: 0, newCustomers: 0, daily: new Map(), links: [] });
  const byCc = new Map<string, CreatorCps>();
  for (const c of ccList) byCc.set(c.id, emptyCps());
  const ensure = (key: string) => { let e = byCc.get(key); if (!e) { e = emptyCps(); byCc.set(key, e); } return e; };

  // ── 流量侧：LinkPerformance（含 daily 数组）──
  const lps = await prisma.linkPerformance.findMany({
    where: { campaignId },
    include: { publisher: { select: { creatorId: true } } }, // 未回填 cc 的存量行兜底归因用
  });
  let dailyRowCount = 0;
  for (const lp of lps) {
    // ★ 闭环归因：campaignCreatorId 直接 FK 优先；publisher.creatorId 仅作未回填兜底。
    const key = (lp.campaignCreatorId && byCc.has(lp.campaignCreatorId) ? lp.campaignCreatorId : null)
      ?? (lp.publisher?.creatorId ? (ccByCreatorId.get(lp.publisher.creatorId) ?? '__campaign__') : '__campaign__');
    const e = ensure(key);
    e.clicks += num(lp.clicks); e.impressions += num(lp.impressions); e.spend += num(lp.spend);
    e.links.push({
      contentType: 'tracking_url', linkUrl: lp.linkUrl,
      clicks: num(lp.clicks), impressions: num(lp.impressions), orders: num(lp.orders),
      gmv: num(lp.gmv), commission: num(lp.commission), spend: num(lp.spend),
    });
    const daily = Array.isArray(lp.daily) ? (lp.daily as Record<string, unknown>[]) : [];
    for (const d of daily) {
      const date = String(d?.date ?? '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      dailyRowCount++;
      const cell = e.daily.get(date) ?? emptyCell();
      cell.clicks += num(d.clicks); cell.impressions += num(d.impressions); cell.spend += num(d.spend);
      // clicks 字段真实存在(含 0)才算流量真源——导入通道无 clicks key(Trivago Awin)不置位
      if (d.clicks !== undefined && d.clicks !== null && d.clicks !== '') cell.fromLp = true;
      e.daily.set(date, cell);
    }
  }

  // ── 成交侧：CampaignOrder 逐单按日聚合（含新客标签计数）──
  // 归因：订单自身 campaignCreatorId 优先；缺失时经 linkPerformanceId -> LP.campaignCreatorId
  // （闭环兜底）。注意 CampaignOrder 无软删列（勿写 deletedAt--历史 bug：列不存在 SQL 必炸）。
  const rows: Array<{ ccId: string | null; d: string; cnt: bigint; sale: unknown; comm: unknown; nc: bigint }> =
    await prisma.$queryRaw(Prisma.sql`
      SELECT COALESCE(o.campaignCreatorId, lp.campaignCreatorId) AS ccId,
             DATE_FORMAT(o.orderDate, '%Y-%m-%d') AS d,
             COUNT(*) AS cnt,
             COALESCE(SUM(o.saleAmount), 0) AS sale,
             COALESCE(SUM(o.commission), 0) AS comm,
             SUM(CASE WHEN o.customerAcquisition = 'New' THEN 1 ELSE 0 END) AS nc
      FROM CampaignOrder o
      LEFT JOIN LinkPerformance lp ON o.linkPerformanceId = lp.id
      WHERE o.campaignId = ${campaignId} AND o.orderDate IS NOT NULL
      GROUP BY ccId, d
    `);
  for (const r of rows) {
    const date = String(r.d ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const key = r.ccId && byCc.has(r.ccId) ? r.ccId : '__campaign__';
    const e = ensure(key);
    const cnt = Number(r.cnt); const sale = num(r.sale); const comm = num(r.comm); const nc = Number(r.nc);
    e.orders += cnt; e.gmv += sale; e.commission += comm; e.newCustomers += nc;
    const cell = e.daily.get(date) ?? emptyCell();
    cell.orders += cnt; cell.gmv += sale; cell.commission += comm; cell.newCustomers += nc;
    e.daily.set(date, cell);
  }

  // ── campaign 级合并 ──
  const campaignDaily = new Map<string, DailyCell>();
  const totals = { clicks: 0, impressions: 0, spend: 0, orders: 0, gmv: 0, commission: 0, newCustomers: 0 };
  for (const e of byCc.values()) {
    totals.clicks += e.clicks; totals.impressions += e.impressions; totals.spend += e.spend;
    totals.orders += e.orders; totals.gmv += e.gmv; totals.commission += e.commission; totals.newCustomers += e.newCustomers;
    for (const [date, cell] of e.daily) {
      const c = campaignDaily.get(date) ?? emptyCell();
      c.clicks += cell.clicks; c.impressions += cell.impressions; c.spend += cell.spend;
      c.orders += cell.orders; c.gmv += cell.gmv; c.commission += cell.commission; c.newCustomers += cell.newCustomers;
      campaignDaily.set(date, c);
    }
  }
  return { byCc, campaignDaily, totals, dailyRowCount, ccList };
}
