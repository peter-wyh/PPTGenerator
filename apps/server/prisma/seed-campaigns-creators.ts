/**
 * Phase 2 seed: Campaign / Creator / CampaignCreator
 * 数据来源：apps/web/src/api/mock/ 中的 MOCK_CAMPAIGNS + CREATOR_META + CAMPAIGN_PROFILE
 *
 * Usage: npx tsx prisma/seed-campaigns-creators.ts
 *
 * 幂等：使用 upsert，重复运行安全。
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Mock data imports (inline copies to avoid TS path resolution issues) ────

interface SeedCampaign {
  id: string;
  name: string;
  advertiser: string;
  businessLine: string; // code: FT/SM/CX/DG/KN/DM
  platform: string;
  startDate: string;
  endDate: string;
  budget: string;
  status: string;
  owner: string;
}

const CAMPAIGNS: SeedCampaign[] = [
  { id: 'camp-glowlab-q4', name: 'GlowLab Q4 Sensitive Skin Serum Launch', advertiser: 'GlowLab', businessLine: 'FT', platform: 'TikTok', startDate: '2026-10-12', endDate: '2026-11-10', budget: '$300K', status: 'Active', owner: 'alex' },
  { id: 'camp-lumiere-launch', name: 'LUMIÈRE Anti-Aging Cream Launch', advertiser: 'LUMIÈRE', businessLine: 'SM', platform: 'TikTok', startDate: '2026-09-01', endDate: '2026-09-30', budget: '$520K', status: 'Completed', owner: 'stella' },
  { id: 'camp-nova-home-618', name: 'NOVA Home 618 Home Goods Mega Sale', advertiser: 'NOVA Home', businessLine: 'CX', platform: 'Instagram', startDate: '2026-05-20', endDate: '2026-06-20', budget: '$780K', status: 'Completed', owner: 'reese' },
  { id: 'camp-motion-spring', name: 'MOTION Spring Sports Seeding Campaign', advertiser: 'MOTION', businessLine: 'DG', platform: 'YouTube', startDate: '2026-03-01', endDate: '2026-04-15', budget: '$260K', status: 'Completed', owner: 'stacey' },
  { id: 'camp-everyday-bf', name: 'EVERYDAY Black Friday Gift Explosion', advertiser: 'EVERYDAY', businessLine: 'KN', platform: 'TikTok', startDate: '2026-11-20', endDate: '2026-12-25', budget: '$440K', status: 'Planning', owner: 'alex' },
  { id: 'camp-wander-summer', name: 'WANDER Summer Travel Content Marketing', advertiser: 'WANDER', businessLine: 'DM', platform: 'YouTube', startDate: '2026-07-01', endDate: '2026-08-31', budget: '$360K', status: 'Active', owner: 'stella' },
];

interface SeedCreator {
  id: string;
  name: string;
  handle: string;
  platform: string;
  tier: string;
  followers: string;
  engagement: string;
  category: string;
  region: string;
}

const CREATORS: SeedCreator[] = [
  { id: 'cre-mia', name: 'Mia Chen', handle: '@miaglowup', platform: 'TikTok', tier: 'mega', followers: '1.28M', engagement: '8.7%', category: 'Beauty', region: 'US / UK' },
  { id: 'cre-sofia', name: 'Sofia Lane', handle: '@sofialane', platform: 'TikTok', tier: 'macro', followers: '684K', engagement: '6.2%', category: 'Skincare', region: 'US' },
  { id: 'cre-ava', name: 'Ava Park', handle: '@avapark.daily', platform: 'Instagram', tier: 'macro', followers: '312K', engagement: '7.8%', category: 'Lifestyle', region: 'CN' },
  { id: 'cre-jamie', name: 'Jamie Wu', handle: '@jamiewu', platform: 'Douyin', tier: 'micro', followers: '86K', engagement: '11.4%', category: 'Beauty', region: 'CN' },
  { id: 'cre-leo', name: 'Leo Sato', handle: '@leosato', platform: 'YouTube', tier: 'mega', followers: '2.10M', engagement: '5.1%', category: 'Tech', region: 'JP' },
  { id: 'cre-nora', name: 'Nora Kim', handle: '@nora.kim', platform: 'Instagram', tier: 'macro', followers: '458K', engagement: '6.9%', category: 'Fashion', region: 'KR' },
  { id: 'cre-tom', name: 'Tom Reyes', handle: '@tomreyes', platform: 'TikTok', tier: 'micro', followers: '54K', engagement: '12.1%', category: 'Food', region: 'US' },
  { id: 'cre-iris', name: 'Iris Lin', handle: '@iris.lin', platform: 'Xiaohongshu', tier: 'macro', followers: '398K', engagement: '9.3%', category: 'Beauty', region: 'CN' },
  { id: 'cre-yuki', name: 'Yuki Tanaka', handle: '@yukitanaka', platform: 'Instagram', tier: 'mega', followers: '1.55M', engagement: '4.8%', category: 'Travel', region: 'JP' },
  { id: 'cre-marcus', name: 'Marcus Webb', handle: '@marcuswebb', platform: 'YouTube', tier: 'macro', followers: '576K', engagement: '7.5%', category: 'Sports', region: 'US' },
  { id: 'cre-priya', name: 'Priya Sharma', handle: '@priyasharma', platform: 'Instagram', tier: 'micro', followers: '92K', engagement: '10.8%', category: 'Wellness', region: 'IN' },
  { id: 'cre-stella', name: 'Stella Zhou', handle: '@stellazhou', platform: 'Douyin', tier: 'mega', followers: '2.84M', engagement: '6.5%', category: 'Fashion', region: 'CN' },
];

/** Campaign → Creator associations from CAMPAIGN_PROFILE.creators[] */
const CAMPAIGN_CREATORS: Record<string, string[]> = {
  'camp-glowlab-q4': ['cre-mia', 'cre-sofia', 'cre-tom', 'cre-iris', 'cre-ava', 'cre-jamie', 'cre-nora', 'cre-priya', 'cre-yuki', 'cre-marcus'],
  'camp-lumiere-launch': ['cre-stella', 'cre-nora', 'cre-iris', 'cre-mia', 'cre-ava', 'cre-priya'],
  'camp-nova-home-618': ['cre-yuki', 'cre-ava', 'cre-marcus', 'cre-jamie', 'cre-priya'],
  'camp-motion-spring': ['cre-marcus', 'cre-leo', 'cre-tom', 'cre-stella'],
  'camp-everyday-bf': ['cre-mia', 'cre-leo', 'cre-nora', 'cre-yuki', 'cre-stella'],
  'camp-wander-summer': ['cre-yuki', 'cre-leo', 'cre-nora', 'cre-stella', 'cre-marcus'],
};

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Find system owner user
  const admin = await prisma.user.findFirst({
    where: { email: 'admin@mediakit.local' },
  });
  if (!admin) {
    console.error('❌ No admin user found. Run seed-lookup-tables first.');
    process.exit(1);
  }
  const ownerId = admin.id;
  console.log(`Using owner: ${admin.name} (${ownerId})`);

  // 2. Build lookup maps for FK resolution
  const blMap = new Map<string, string>(); // code → id
  for (const bl of await prisma.businessLine.findMany()) {
    blMap.set(bl.code, bl.id);
  }
  const advMap = new Map<string, string>(); // name → id
  for (const adv of await prisma.advertiser.findMany()) {
    advMap.set(adv.name, adv.id);
  }

  // 3. Seed Campaigns
  let campaignCount = 0;
  for (const c of CAMPAIGNS) {
    await prisma.campaign.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        name: c.name,
        platform: c.platform,
        startDate: c.startDate,
        endDate: c.endDate,
        budget: c.budget,
        status: c.status,
        owner: c.owner,
        businessLineId: blMap.get(c.businessLine) ?? null,
        advertiserId: advMap.get(c.advertiser) ?? null,
        businessLineCode: c.businessLine,
        advertiserName: c.advertiser,
        ownerId,
      },
      update: {
        name: c.name,
        platform: c.platform,
        budget: c.budget,
        status: c.status,
        businessLineId: blMap.get(c.businessLine) ?? null,
        advertiserId: advMap.get(c.advertiser) ?? null,
        businessLineCode: c.businessLine,
        advertiserName: c.advertiser,
      },
    });
    campaignCount++;
  }
  console.log(`✅ Campaigns: ${campaignCount}`);

  // 4. Seed Creators
  let creatorCount = 0;
  for (const cr of CREATORS) {
    await prisma.creator.upsert({
      where: { id: cr.id },
      create: {
        id: cr.id,
        name: cr.name,
        handle: cr.handle,
        platform: cr.platform,
        tier: cr.tier,
        followers: cr.followers,
        engagement: cr.engagement,
        category: cr.category,
        region: cr.region,
        ownerId,
      },
      update: {
        name: cr.name,
        handle: cr.handle,
        platform: cr.platform,
        tier: cr.tier,
        followers: cr.followers,
        engagement: cr.engagement,
        category: cr.category,
        region: cr.region,
      },
    });
    creatorCount++;
  }
  console.log(`✅ Creators: ${creatorCount}`);

  // 5. Seed CampaignCreator associations
  let linkCount = 0;
  for (const [campaignId, creatorIds] of Object.entries(CAMPAIGN_CREATORS)) {
    for (const creatorId of creatorIds) {
      await prisma.campaignCreator.upsert({
        where: { campaignId_creatorId: { campaignId, creatorId } },
        create: { campaignId, creatorId },
        update: {},
      });
      linkCount++;
    }
  }
  console.log(`✅ CampaignCreator links: ${linkCount}`);

  console.log('\n🎉 Phase 2 seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
