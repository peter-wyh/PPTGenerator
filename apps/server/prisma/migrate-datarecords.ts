/**
 * Phase 4 migration: DataRecord → Campaign / Creator 独立表
 *
 * 策略：遍历 DataRecord 中 kind=CAMPAIGN 和 kind=CREATOR 的记录，
 * 按 id upsert 到对应新表。已存在的种子数据不会被覆盖（upsert update 只补缺失字段）。
 * 旧 DataRecord 保留不删（降级而非删除，允许回滚）。
 *
 * Usage: npx tsx prisma/migrate-datarecords.ts
 *
 * 幂等：重复执行不会产生副作用。
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CampaignData {
  id: string;
  name: string;
  advertiser?: string;
  businessLine?: string;
  platform: string;
  startDate: string;
  endDate: string;
  budget: string;
  status?: string;
  owner?: string;
  metrics?: unknown[];
}

interface CreatorData {
  id: string;
  name: string;
  handle: string;
  platform: string;
  tier: string;
  followers: string;
  engagement: string;
  category?: string;
  region?: string;
  metrics?: unknown[];
}

async function migrateCampaigns(): Promise<{ migrated: number; skipped: number }> {
  const records = await prisma.dataRecord.findMany({ where: { kind: 'CAMPAIGN' } });
  let migrated = 0;
  let skipped = 0;

  for (const record of records) {
    const data = record.data as unknown as CampaignData;

    // 检查新表是否已存在（种子数据 id 可能不同）
    const existing = await prisma.campaign.findFirst({
      where: { OR: [{ id: record.id }, { name: data.name }] },
    });

    if (existing) {
      // 已存在 — 只补缺失字段
      await prisma.campaign.update({
        where: { id: existing.id },
        data: {
          ...(existing.status === null && data.status && { status: data.status }),
          ...(existing.owner === null && data.owner && { owner: data.owner }),
        },
      });
      skipped++;
    } else {
      // 不存在 — 创建（用旧 DataRecord 的 ownerId）
      await prisma.campaign.create({
        data: {
          id: record.id,
          name: data.name,
          platform: data.platform,
          startDate: data.startDate,
          endDate: data.endDate,
          budget: data.budget,
          status: data.status ?? null,
          owner: data.owner ?? data.advertiser ?? null,
          ownerId: record.ownerId,
          metrics: (data.metrics ?? []) as object[],
          // 旧数据通过字符串字段兼容
          businessLineCode: data.businessLine ?? null,
          advertiserName: data.advertiser ?? null,
        },
      });
      migrated++;
    }
  }

  return { migrated, skipped };
}

async function migrateCreators(): Promise<{ migrated: number; skipped: number }> {
  const records = await prisma.dataRecord.findMany({ where: { kind: 'CREATOR' } });
  let migrated = 0;
  let skipped = 0;

  for (const record of records) {
    const data = record.data as unknown as CreatorData;

    const existing = await prisma.creator.findFirst({
      where: { OR: [{ id: record.id }, { name: data.name }] },
    });

    if (existing) {
      // 已存在 — 只补缺失字段
      await prisma.creator.update({
        where: { id: existing.id },
        data: {
          ...(existing.category === '' && data.category && { category: data.category }),
          ...(existing.region === '' && data.region && { region: data.region }),
        },
      });
      skipped++;
    } else {
      await prisma.creator.create({
        data: {
          id: record.id,
          name: data.name,
          handle: data.handle,
          platform: data.platform,
          tier: data.tier,
          followers: data.followers,
          engagement: data.engagement,
          category: data.category ?? '',
          region: data.region ?? '',
          ownerId: record.ownerId,
          metrics: (data.metrics ?? []) as object[],
        },
      });
      migrated++;
    }
  }

  return { migrated, skipped };
}

async function migrateCollaborations(): Promise<{ migrated: number; skipped: number }> {
  const records = await prisma.dataRecord.findMany({ where: { kind: 'COLLABORATION' } });
  let migrated = 0;
  let skipped = 0;

  for (const record of records) {
    const data = record.data as unknown as {
      campaignId: string;
      creatorId: string;
      deliverables: unknown[];
    };

    // 找到对应的 CampaignCreator link
    const link = await prisma.campaignCreator.findUnique({
      where: { campaignId_creatorId: { campaignId: data.campaignId, creatorId: data.creatorId } },
    });

    if (!link) {
      console.warn(`  ⚠️ CampaignCreator not found for collab ${record.id}, skipping`);
      skipped++;
      continue;
    }

    const existing = await prisma.collaboration.findUnique({
      where: { campaignCreatorId: link.id },
    });

    if (existing) {
      // 只更新 deliverables（如果旧数据更丰富）
      const existingCount = Array.isArray(existing.deliverables) ? existing.deliverables.length : 0;
      const newCount = Array.isArray(data.deliverables) ? data.deliverables.length : 0;
      if (newCount > existingCount) {
        await prisma.collaboration.update({
          where: { campaignCreatorId: link.id },
          data: { deliverables: data.deliverables as object },
        });
      }
      skipped++;
    } else {
      await prisma.collaboration.create({
        data: {
          campaignCreatorId: link.id,
          deliverables: data.deliverables as object,
          legacyId: record.id,
        },
      });
      migrated++;
    }
  }

  return { migrated, skipped };
}

async function main() {
  console.log('─── Phase 4: DataRecord → 独立表迁移 ───\n');

  const camp = await migrateCampaigns();
  console.log(`Campaigns: ${camp.migrated} migrated, ${camp.skipped} already existed (updated)`);

  const cre = await migrateCreators();
  console.log(`Creators: ${cre.migrated} migrated, ${cre.skipped} already existed (updated)`);

  const coll = await migrateCollaborations();
  console.log(`Collaborations: ${coll.migrated} migrated, ${coll.skipped} already existed/skipped`);

  console.log('\n✅ Migration complete. DataRecord 表保留（降级，不删除）。');

  // 统计对比
  const stats = {
    campaigns: await prisma.campaign.count(),
    creators: await prisma.creator.count(),
    campaignCreators: await prisma.campaignCreator.count(),
    performances: await prisma.creatorPerformance.count(),
    collaborations: await prisma.collaboration.count(),
    dataRecords: await prisma.dataRecord.count(),
  };
  console.log('\n📊 新表统计:', JSON.stringify(stats, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
