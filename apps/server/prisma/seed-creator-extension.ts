/**
 * Phase A-1 seed: 把前端 mock 中的 Creator 扩展字段（bio/tags/contact/rate/audience/works/stats/profile）
 * 写入 Creator 表的 JSON 列（metrics/audience/works/stats/profile）。
 *
 * 数据源：apps/web/src/api/mock/creators.ts 中的 MOCK_CREATORS
 *
 * Usage: npx tsx prisma/seed-creator-extension.ts
 *
 * 幂等：update only，不创建新 creator；重复运行安全。
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // 动态 import 前端 mock 模块（ESM）
  // 注意：路径相对于 apps/server/cwd，需要回退到根仓库
  const { MOCK_CREATORS } = await import('../../web/src/api/analytics/creators.js');

  console.log(`[seed-creator-extension] MOCK_CREATORS loaded: ${MOCK_CREATORS.length}`);

  let updated = 0;
  let skipped = 0;

  for (const c of MOCK_CREATORS) {
    // 检查 creator 是否存在（避免创建新记录）
    const existing = await prisma.creator.findUnique({ where: { id: c.id } });
    if (!existing) {
      console.log(`  ⏭️  ${c.id} (${c.name}) not in DB, skip`);
      skipped++;
      continue;
    }

    // profile JSON 列：bio/tags/contact/rate/profileUrl/avatar/recentPostsCount/engagementMedian
    const profile = {
      bio: c.bio,
      tags: c.tags,
      contact: c.contact,
      rate: c.rate,
      profileUrl: c.profileUrl,
      avatar: c.avatar,
      recentPostsCount: c.recentPostsCount,
      engagementMedian: c.engagementMedian,
    };

    await prisma.creator.update({
      where: { id: c.id },
      data: {
        metrics: c.metrics as any,
        audience: c.audience as any,
        works: c.works as any,
        stats: c.stats as any,
        profile,
        // avatar 也存在独立列
        avatar: c.avatar ?? existing.avatar,
      },
    });
    console.log(`  ✅ ${c.id} (${c.name}) updated: metrics/audience/works/stats/profile`);
    updated++;
  }

  console.log(`\n🎉 Done. Updated: ${updated}, Skipped: ${skipped}`);
}

main()
  .catch((e) => {
    console.error('[seed-creator-extension] failed', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
