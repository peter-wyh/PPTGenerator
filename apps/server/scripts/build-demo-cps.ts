/**
 * ★ 演示数据构建脚本(用户指示:数据不够,在数据管理侧构建数据到数据库) ★
 * 为 4 个数据缺口 campaign 构建 CPS daily + 聚合列演示数据,走正式导入通道
 * (importCpsPerformance + importCpsDaily,幂等可重放),不直写表。
 *
 * 特性:
 * - 确定性伪随机(固定种子):重放结果完全一致,可复现
 * - 自洽性:聚合列 = 全部 daily 逐字段合计(汇总口径=周期口径)
 * - 曲线形状:冷启动 ramp、周末上扬、大促峰值(618)、上新爆发、长尾衰减
 * - WANDER:保留已有 8-01~8-11 真实导入行,只补缺失日期;聚合列=已有+新增合计
 *
 * ⚠️ 本脚本生成的是模拟数据(非平台真实导出),量级参照库内已有 campaign 校准。
 */
import { prisma } from '../src/prisma';
import { importService } from '../src/modules/campaigns/campaigns.service';

// ── 确定性伪随机(LCG) ──────────────────────────────────────────
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
const hash = (str: string) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

// ── 每日形状函数(乘数) ─────────────────────────────────────────
type Shape = (date: Date, dayIdx: number, totalDays: number) => number;
const dow = (d: Date) => d.getUTCDay();

const rampShape: Shape = (d, i) => {
  let m = 1;
  if (i < 3) m *= 0.55 + i * 0.18;                       // 冷启动
  if (dow(d) === 0 || dow(d) === 6) m *= 1.22;           // 周末上扬
  if (i > 0 && i % 9 === 0) m *= 0.82;                   // 波动低谷
  return m;
};
const launchShape: Shape = (d, i, n) => {
  let m = 1;
  if (i < 7) m *= 1.55 - i * 0.06;                       // 上新首周爆发
  else if (i > n - 8) m *= 0.72;                         // 尾部衰减
  if (dow(d) === 0 || dow(d) === 6) m *= 1.18;
  return m;
};
const mega618Shape: Shape = (d, i) => {
  let m = 1;
  const day = d.getUTCDate();
  if (d.getUTCMonth() === 5) {
    if (day >= 16) m *= 1.9 + (day - 16) * 0.42;         // 618 预热爬坡
    if (day === 18) m *= 1.35;                           // 618 当天尖峰
    if (day >= 19) m *= 0.55;                            // 大促后回落
  }
  if (dow(d) === 0 || dow(d) === 6) m *= 1.12;
  return m;
};
const seedingShape: Shape = (d, i, n) => {
  let m = 1;
  if (i < 14) m *= 0.62;                                 // 种草期低转化
  else if (i < 24) m *= 1.45;                            // 爆发窗口
  else m *= 0.88;                                        // 长尾
  if (dow(d) === 0 || dow(d) === 6) m *= 1.15;
  return m;
};
const summerShape: Shape = (d, i, n) => {
  let m = 1;
  if (d.getUTCMonth() === 6) m *= 1.12;                  // 7月暑期高峰
  if (i > n - 12) m *= 0.86;                             // 8月下旬回落
  if (dow(d) === 0 || dow(d) === 6) m *= 1.18;
  return m;
};

// ── Campaign 构建配置 ──────────────────────────────────────────
type Config = {
  id: string; startDate: string; endDate: string;
  shape: Shape;
  target: { clicks: number; cvr: number; aov: number };   // 全周期目标量级
  commissionRate?: number; newCustRate?: number; ctr?: number;
  contentType?: string;
};
const CONFIGS: Config[] = [
  { id: 'camp-wander-summer', startDate: '2026-07-01', endDate: '2026-08-31', shape: summerShape,
    target: { clicks: 65000, cvr: 0.048, aov: 35 }, commissionRate: 0.10, newCustRate: 0.22, ctr: 0.09 },
  { id: 'camp-lumiere-launch', startDate: '2026-09-01', endDate: '2026-09-30', shape: launchShape,
    target: { clicks: 85000, cvr: 0.046, aov: 50 }, commissionRate: 0.10, newCustRate: 0.24, ctr: 0.08 },
  { id: 'camp-nova-home-618', startDate: '2026-05-20', endDate: '2026-06-20', shape: mega618Shape,
    target: { clicks: 120000, cvr: 0.045, aov: 70 }, commissionRate: 0.08, newCustRate: 0.20, ctr: 0.07 },
  { id: 'camp-motion-spring', startDate: '2026-03-01', endDate: '2026-04-15', shape: seedingShape,
    target: { clicks: 38000, cvr: 0.031, aov: 45 }, commissionRate: 0.11, newCustRate: 0.26, ctr: 0.10 },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => {
  const out: string[] = [];
  for (let t = new Date(a).getTime(); t <= new Date(b).getTime(); t += 86400000) out.push(iso(new Date(t)));
  return out;
};
const r2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  for (const cfg of CONFIGS) {
    const camp = await prisma.campaign.findUnique({
      where: { id: cfg.id },
      select: { campaignCreators: { select: { id: true, creatorId: true, cpsPerformances: { select: { contentType: true, daily: true } } } } },
    });
    if (!camp) { console.log(`!! campaign 不存在: ${cfg.id}`); continue; }
    const contentType = cfg.contentType ?? camp.campaignCreators[0]?.cpsPerformances[0]?.contentType ?? 'post';
    const creators = camp.campaignCreators.map((cc) => ({ linkId: cc.id, creatorId: cc.creatorId }));
    const n = creators.length;

    // creator 权重(几何衰减+归一,确定性)
    const raw = creators.map((_, i) => Math.pow(0.82, i));
    const wSum = raw.reduce((a, b) => a + b, 0);
    const weights = raw.map((w) => w / wSum);

    // 已有 daily(如 WANDER 8-01~8-11)——保留不覆盖,聚合列合计时并入
    const existingDaily = await prisma.cpsPerformance.findMany({
      where: { campaignCreatorId: { in: creators.map((c) => c.linkId) }, contentType },
      select: { campaignCreatorId: true, daily: true },
    });
    const existingByCreator = new Map<string, Record<string, any>[]>();
    for (const row of existingDaily) {
      const arr = (row.daily as any[]) ?? [];
      if (arr.length) existingByCreator.set(row.campaignCreatorId, arr);
    }

    const allDates = daysBetween(cfg.startDate, cfg.endDate);
    const totalDays = allDates.length;

    // ── 生成 daily 行(跳过已有日期)──
    const agg = { clicks: 0, impressions: 0, orders: 0, gmv: 0, commission: 0, spend: 0, newCustomers: 0 };
    const dailyItems: Record<string, unknown>[] = [];
    const perfItems: Record<string, unknown>[] = [];

    creators.forEach((cr, ci) => {
      const perCreatorAgg = { clicks: 0, impressions: 0, orders: 0, gmv: 0, commission: 0, spend: 0, newCustomers: 0 };
      const have = new Set((existingByCreator.get(cr.linkId) ?? []).map((d) => String(d.date)));

      allDates.forEach((date, di) => {
        if (have.has(date)) return; // 已有真实行不覆盖
        const r = rng(hash(`${cfg.id}:${cr.creatorId}:${date}`));
        const d = new Date(date);
        const shapeM = cfg.shape(d, di, totalDays);
        const jitter = 0.88 + r() * 0.24;

        const clicks = Math.max(0, Math.round((cfg.target.clicks * weights[ci] / totalDays) * shapeM * jitter));
        const cvr = cfg.target.cvr * (0.82 + r() * 0.4);
        const orders = Math.max(0, Math.round(clicks * cvr));
        const aov = cfg.target.aov * (0.85 + r() * 0.3);
        const gmv = r2(orders * aov);
        const commission = r2(gmv * (cfg.commissionRate ?? 0.1) * (0.95 + r() * 0.1));
        const impressions = Math.max(clicks, Math.round(clicks / (cfg.ctr ?? 0.08) * (0.9 + r() * 0.2)));
        const spend = r2(commission * (0.92 + r() * 0.16)); // 投放≈佣金(混合结算)
        const newCustomers = Math.max(0, Math.round(orders * (cfg.newCustRate ?? 0.22) * (0.85 + r() * 0.3)));

        if (clicks === 0 && orders === 0) return;
        dailyItems.push({
          campaignId: cfg.id, creatorId: cr.creatorId, contentType, date,
          dailyClicks: String(clicks), dailyImpressions: String(impressions),
          dailyOrders: String(orders), dailyGmv: String(gmv), dailyCommission: String(commission),
          dailySpend: String(spend), dailyNewCustomers: String(newCustomers),
        });
        perCreatorAgg.clicks += clicks; perCreatorAgg.impressions += impressions;
        perCreatorAgg.orders += orders; perCreatorAgg.gmv += gmv;
        perCreatorAgg.commission += commission; perCreatorAgg.spend += spend;
        perCreatorAgg.newCustomers += newCustomers;
      });

      // 并入已有真实行到聚合
      const haveRows = existingByCreator.get(cr.linkId) ?? [];
      for (const d of haveRows) {
        perCreatorAgg.clicks += Number(d.clicks) || 0; perCreatorAgg.impressions += Number(d.impressions) || 0;
        perCreatorAgg.orders += Number(d.orders) || 0; perCreatorAgg.gmv += Number(d.gmv) || 0;
        perCreatorAgg.commission += Number(d.commission) || 0; perCreatorAgg.spend += Number(d.spend) || 0;
        perCreatorAgg.newCustomers += Number(d.newCustomers) || 0;
      }
      perfItems.push({
        campaignId: cfg.id, creatorId: cr.creatorId, contentType,
        clicks: String(perCreatorAgg.clicks), impressions: String(perCreatorAgg.impressions),
        orders: String(perCreatorAgg.orders), gmv: String(r2(perCreatorAgg.gmv)),
        commission: String(r2(perCreatorAgg.commission)), spend: String(r2(perCreatorAgg.spend)),
      });
      agg.clicks += perCreatorAgg.clicks; agg.orders += perCreatorAgg.orders; agg.gmv += perCreatorAgg.gmv;
      agg.newCustomers += perCreatorAgg.newCustomers;
    });

    // ── 走正式导入通道(幂等) ──
    const r1 = await importService.importCpsPerformance('system-build-demo', perfItems);
    const r2n = await importService.importCpsDaily('system-build-demo', dailyItems);
    const kept = [...existingByCreator.values()].reduce((a, arr) => a + arr.length, 0);
    console.log(`✓ ${cfg.id}: daily 新增 ${r2n.updated} 行(保留已有 ${kept}) | 聚合 ${r1.updated}/${n} links | 合计 clicks=${agg.clicks} orders=${agg.orders} gmv=$${r2(agg.gmv)} newCust=${agg.newCustomers}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error('ERR', e); process.exit(1); });
