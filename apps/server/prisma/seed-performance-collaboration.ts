/**
 * Phase 3 seed: CreatorPerformance / Collaboration
 * 数据来源：apps/web/src/api/mock/creatorPerformance.ts + collaborationSeed.ts
 *
 * 生成方式：遍历所有 CampaignCreator 记录，调用 mock 生成器获取
 * CreatorCampaignPerformance（summary/posts/daily/placements/cps）
 * 和 buildSeedCollaboration（deliverables）。
 *
 * Usage: npx tsx prisma/seed-performance-collaboration.ts
 *
 * 幂等：upsert by campaignCreatorId。
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Inline mock data generators (simplified deterministic versions) ─────────

/** 确定性哈希（与前端 mock 一致）。 */
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

interface SeedSummary {
  posts: number;
  totalImpressions: string;
  totalEngagement: string;
  avgEngagementRate: string;
}

function buildSummary(campaignId: string, creatorId: string): SeedSummary {
  const h = hash(campaignId + creatorId);
  const posts = 1 + (h % 4);
  const baseImp = 50000 + (h % 200000);
  const engRate = (4 + (h % 9)).toFixed(1) + '%';
  const eng = Math.round(baseImp * (parseFloat(engRate) / 100)).toString();
  return {
    posts,
    totalImpressions: baseImp.toLocaleString(),
    totalEngagement: eng,
    avgEngagementRate: engRate,
  };
}

function buildDeliverables(campaignId: string, creatorId: string): unknown[] {
  const h = hash(creatorId);
  const allTypes = ['post', 'reels', 'video', 'image', 'story', 'live'] as const;
  const n = 1 + (h % 3); // 1~3 types
  const types: string[] = [];
  for (let i = 0; i < n; i++) {
    types.push(allTypes[(h + i * 3) % allTypes.length]);
  }
  return [...new Set(types)].map((contentType) => ({
    contentType,
    screenshots: [],
    metrics: [],
  }));
}

function buildCps(campaignId: string, creatorId: string): unknown {
  const h = hash(campaignId + ':' + creatorId);
  const gmv = (10000 + (h % 90000)).toLocaleString();
  const orders = 50 + (h % 500);
  return {
    gmv: `$${gmv}`,
    orders: orders.toString(),
    clicks: (1000 + (h % 5000)).toLocaleString(),
    cvr: ((1 + (h % 4)) / 10).toFixed(1) + '%',
    roas: (2 + (h % 8)).toFixed(1) + 'x',
    commission: `$${Math.round(gmv.replace(/[$,]/g, '') as unknown as number * 0.12).toLocaleString()}`,
    spend: `$${Math.round(gmv.replace(/[$,]/g, '') as unknown as number * 0.15).toLocaleString()}`,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const links = await prisma.campaignCreator.findMany({
    select: { id: true, campaignId: true, creatorId: true },
  });

  console.log(`Found ${links.length} CampaignCreator links to seed.`);

  let perfCount = 0;
  let collabCount = 0;

  for (const link of links) {
    // 1. CreatorPerformance
    const summary = buildSummary(link.campaignId, link.creatorId);
    const cps = buildCps(link.campaignId, link.creatorId);

    await prisma.creatorPerformance.upsert({
      where: { campaignCreatorId: link.id },
      create: {
        campaignCreatorId: link.id,
        summary: summary as object,
        cps: cps as object,
      },
      update: {
        summary: summary as object,
        cps: cps as object,
      },
    });
    perfCount++;

    // 2. Collaboration
    const deliverables = buildDeliverables(link.campaignId, link.creatorId);
    const legacyId = `collab:${link.campaignId}:${link.creatorId}`;

    await prisma.collaboration.upsert({
      where: { campaignCreatorId: link.id },
      create: {
        campaignCreatorId: link.id,
        deliverables: deliverables as object,
        legacyId,
      },
      update: {
        deliverables: deliverables as object,
        legacyId,
      },
    });
    collabCount++;
  }

  console.log(`✅ CreatorPerformance: ${perfCount}`);
  console.log(`✅ Collaboration: ${collabCount}`);
  console.log('\n🎉 Phase 3 seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
