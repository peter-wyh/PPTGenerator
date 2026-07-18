/**
 * Phase A-5 seed: 把 buildSeedCollaboration() 生成的**富 deliverables**
 * （含 screenshots/metrics/audience/wordcloud/publishedAt）写入 DB Collaboration.deliverables。
 *
 * 之前 seed-performance-collaboration.ts 写入的是空壳 deliverables（screenshots=[]），
 * 前端 hasRichData() 判定为空 → 每次都走 buildSeedCollaboration 兜底。
 *
 * 本脚本执行后，DB 即持有完整富内容，前端直接读 DB 无需兜底。
 * 仍会从前端重算的：daily（时间敏感：发布日→当前日期，最多30天）、cps（同上）。
 *
 * 用法：`npx tsx prisma/seed-collaboration-deliverables.ts`
 *
 * 注意：本脚本调用前端算法（apps/web/src/api/analytics/collaborationSeed.ts），
 *     因为算法是确定性生成的唯一真理来源。
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // 动态 import 前端 analytics 模块（ESM）
  const { buildSeedCollaboration } = await import(
    '../../web/src/api/analytics/collaborationSeed.js'
  );

  // 枚举所有 CampaignCreator 对（campaignId, creatorId）
  const ccs = await prisma.campaignCreator.findMany({
    select: {
      id: true,
      campaignId: true,
      creatorId: true,
      collaboration: { select: { id: true } },
    },
  });
  console.log(`[seed-collaboration-deliverables] CampaignCreator pairs: ${ccs.length}`);

  let updated = 0;
  let created = 0;
  let skipped = 0;

  for (const cc of ccs) {
    try {
      // 调用前端确定性算法生成富 deliverables
      const seed = buildSeedCollaboration(cc.campaignId, cc.creatorId);
      if (!seed.deliverables || seed.deliverables.length === 0) {
        skipped++;
        continue;
      }
      // 注意：daily 和 cps 不写入 DB（时间敏感，前端每次重算）
      // 只持久化 screenshots/metrics/audience/wordcloud/publishedAt/platform 等静态内容
      const staticDeliverables = seed.deliverables.map((d) => ({
        contentType: d.contentType,
        screenshots: d.screenshots ?? [],
        metrics: d.metrics ?? [],
        wordcloud: d.wordcloud ?? [],
        audience: d.audience,
        publishedAt: d.publishedAt,
        platform: d.platform,
      }));

      if (cc.collaboration) {
        await prisma.collaboration.update({
          where: { id: cc.collaboration.id },
          data: { deliverables: staticDeliverables as object },
        });
        updated++;
      } else {
        await prisma.collaboration.create({
          data: {
            campaignCreatorId: cc.id,
            deliverables: staticDeliverables as object,
          },
        });
        created++;
      }
    } catch (err) {
      console.error(`  failed for cc=${cc.id}:`, err instanceof Error ? err.message : err);
      skipped++;
    }
  }

  console.log(`[seed-collaboration-deliverables] done: created=${created} updated=${updated} skipped=${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
