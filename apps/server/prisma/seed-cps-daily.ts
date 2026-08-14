/**
 * 为指定 campaign 的所有 creators 生成 CPS 每日明细，写入 CpsPerformance.daily JSON。
 *
 * 目的：让 recipe 报告的 Branch A（mapFromDaily，按 reportPeriod 从 daily 切片）有数据可读。
 *      没有 daily 数据时 recipe 退化到 Branch B（读 analytics 的汇总 blob），与本 campaign
 *      真实周期不对齐。补齐 daily 后，报告会按所选 reportPeriod 真实切片。
 *
 * 用法：
 *   npx tsx prisma/seed-cps-daily.ts [campaignId] [startDate] [endDate] [contentType]
 *   默认：camp-wander-summer  2026-08-01  2026-08-11  post
 *
 * 幂等：按 (campaignCreatorId, contentType, date) 合并覆盖；同 date 重跑只覆盖不累加。
 *
 * 数据为「演示用合成数据」，量级对齐既有 cps-test-* 种子（日 gmv ~100–700、clicks ~50–200、
 * orders ~2–11）。确定性伪随机（LCG，按 creator 序号 + 天数播种），重跑结果可复现。
 * 生产环境请走 POST /api/v1/campaigns/import/cps-daily 灌入真实数值，勿用本脚本。
 */
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** 确定性伪随机（LCG），保证同一入参重跑产出一致。 */
function seeded(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

async function main(): Promise<void> {
  const campaignId = process.argv[2] ?? 'camp-wander-summer';
  const start = process.argv[3] ?? '2026-08-01';
  const end = process.argv[4] ?? '2026-08-11';
  const contentType = process.argv[5] ?? 'post';

  const creators = await prisma.campaignCreator.findMany({
    where: { campaignId },
    include: { creator: true },
  });
  if (!creators.length) {
    throw new Error(`[seed-cps-daily] 未找到 campaign ${campaignId} 的 CampaignCreator 行`);
  }

  // 日期序列（含首尾）
  const days: string[] = [];
  const d0 = new Date(`${start}T00:00:00Z`);
  const d1 = new Date(`${end}T00:00:00Z`);
  for (let t = d0.getTime(); t <= d1.getTime(); t += 86_400_000) days.push(iso(new Date(t)));
  if (!days.length) throw new Error(`[seed-cps-daily] 日期区间为空：${start}..${end}`);

  let upserted = 0;
  for (let ci = 0; ci < creators.length; ci++) {
    const cc = creators[ci];
    const rnd = seeded(9973 + ci * 31 + days.length);

    // 每个 creator 一个稳定的基础量级，再按日波动（0.6–1.4×）
    const baseGmv = 200 + Math.floor(rnd() * 400);
    const baseClicks = 80 + Math.floor(rnd() * 120);
    const baseOrders = 3 + Math.floor(rnd() * 8);

    // 合并已有 daily（按 date 去重），保留导入过的真实数据不被覆盖以外的日期
    const existing = await prisma.cpsPerformance.findUnique({
      where: { campaignCreatorId_contentType: { campaignCreatorId: cc.id, contentType } },
    });
    const byDate = new Map<string, Record<string, unknown>>();
    if (Array.isArray(existing?.daily)) {
      for (const row of existing.daily as Record<string, unknown>[]) {
        if (row?.date) byDate.set(String(row.date), row);
      }
    }

    for (const date of days) {
      const w = 0.6 + rnd() * 0.8;
      const clicks = Math.round(baseClicks * w);
      const orders = Math.round(baseOrders * w);
      const gmv = Math.round(baseGmv * w);
      const newCustomers = Math.max(0, Math.round(orders * (0.35 + rnd() * 0.2))); // ~35–55% 新客
      const impressions = Math.round(clicks * (80 + rnd() * 60)); // CTR ~0.6–1.2%
      const spend = Math.round(gmv * (0.18 + rnd() * 0.06)); // 花费 ~18–24% GMV
      const commission = Math.round(gmv * 0.1); // 佣金 10%
      byDate.set(date, { date, clicks, impressions, orders, gmv, newCustomers, spend, commission });
    }

    const merged = [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));

    await prisma.cpsPerformance.upsert({
      where: { campaignCreatorId_contentType: { campaignCreatorId: cc.id, contentType } },
      update: { daily: merged as unknown as Prisma.InputJsonValue },
      create: {
        campaignCreatorId: cc.id,
        contentType,
        linkUrl: existing?.linkUrl ?? null,
        daily: merged as unknown as Prisma.InputJsonValue,
      },
    });
    upserted++;
    console.log(`  ${cc.creator?.name ?? cc.id} (${cc.id}): ${days.length} 天 (${start} → ${end})`);
  }

  console.log(
    `[seed-cps-daily] ${campaignId}: ${upserted} creators × ${days.length} 天 = ${upserted * days.length} 条 daily（contentType=${contentType}）`,
  );
}

main()
  .catch((err) => {
    console.error('[seed-cps-daily] failed', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
