/**
 * Phase 2b seed: 内容站(content_site) + 社群(community) 合作方 + 关联到已有 campaign
 *
 * 补充 seed-campaigns-creators.ts 中缺失的非达人合作方类型，
 * 让「数据管理-达人合作数据」页面能展示三种类型的合作方数据。
 *
 * Usage: npx tsx prisma/seed-content-community.ts
 *
 * 幂等：使用 upsert，重复运行安全。
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── 内容站(content_site) 种子数据 ───────────────────────────────────────────

interface SeedPartner {
  id: string;
  name: string;
  handle: string;      // 网站 URL 或社群名称
  platform: string;    // 'Web' / 'Community'
  partnerType: string; // 'content_site' / 'community'
  tier: string;        // mega / macro / micro
  followers: string;   // 内容站=Monthly Visits；社群=Members
  engagement: string;  // 内容站=Bounce Rate 补充；社群=Active Rate
  category: string;
  region: string;
  /** 头像 URL（picsum 占位，与其他 creator 种子一致；空则报告页降级首字母圆圈） */
  avatar?: string;
}

const CONTENT_SITES: SeedPartner[] = [
  {
    id: 'site-beautyinsider',
    name: 'Beauty Insider',
    handle: 'https://beautyinsider.com',
    platform: 'Web',
    partnerType: 'content_site',
    tier: 'mega',
    followers: '1.85M visits/mo',
    engagement: '42% bounce',
    category: 'Beauty & Skincare',
    region: 'US',
    avatar: 'https://picsum.photos/seed/Beauty%20Insider/200/200',
  },
  {
    id: 'site-skincarehub',
    name: 'Skincare Hub',
    handle: 'https://skincarehub.com',
    platform: 'Web',
    partnerType: 'content_site',
    tier: 'macro',
    followers: '620K visits/mo',
    engagement: '38% bounce',
    category: 'Skincare',
    region: 'US / EU',
    avatar: 'https://picsum.photos/seed/Skincare%20Hub/200/200',
  },
  {
    id: 'site-glowguide',
    name: 'Glow Guide',
    handle: 'https://glowguide.cn',
    platform: 'Web',
    partnerType: 'content_site',
    tier: 'macro',
    followers: '480K visits/mo',
    engagement: '35% bounce',
    category: 'Beauty',
    region: 'CN',
    avatar: 'https://picsum.photos/seed/Glow%20Guide/200/200',
  },
  {
    id: 'site-trendreport',
    name: 'Trend Report',
    handle: 'https://trendreport.jp',
    platform: 'Web',
    partnerType: 'content_site',
    tier: 'micro',
    followers: '180K visits/mo',
    engagement: '45% bounce',
    category: 'Lifestyle',
    region: 'JP',
    avatar: 'https://picsum.photos/seed/Trend%20Report/200/200',
  },
];

const COMMUNITIES: SeedPartner[] = [
  {
    id: 'comm-glowgang',
    name: 'Glow Gang',
    handle: 'Discord: GlowGang Official',
    platform: 'Community',
    partnerType: 'community',
    tier: 'mega',
    followers: '85.2K members',
    engagement: '23% DAU',
    category: 'Beauty & Skincare',
    region: 'US / UK',
    avatar: 'https://picsum.photos/seed/Glow%20Gang/200/200',
  },
  {
    id: 'comm-skincareclub',
    name: 'Skincare Club',
    handle: 'FB Group: Skincare Club',
    platform: 'Community',
    partnerType: 'community',
    tier: 'macro',
    followers: '42.6K members',
    engagement: '31% DAU',
    category: 'Skincare',
    region: 'US',
    avatar: 'https://picsum.photos/seed/Skincare%20Club/200/200',
  },
  {
    id: 'comm-meishetuan',
    name: '美涩团',
    handle: 'WeChat: 美涩团',
    platform: 'Community',
    partnerType: 'community',
    tier: 'macro',
    followers: '56.8K members',
    engagement: '28% DAU',
    category: 'Beauty',
    region: 'CN',
    avatar: 'https://picsum.photos/seed/美涩团/200/200',
  },
  {
    id: 'comm-glowlabfans',
    name: 'GlowLab Fans',
    handle: 'Telegram: GlowLab Fans',
    platform: 'Community',
    partnerType: 'community',
    tier: 'micro',
    followers: '18.3K members',
    engagement: '35% DAU',
    category: 'Beauty',
    region: 'Global',
  },
];

/** 内容站/社群 → Campaign 关联（关联到 2-3 个主要 campaign） */
const PARTNER_CAMPAIGN_LINKS: Record<string, string[]> = {
  'site-beautyinsider': ['camp-glowlab-q4', 'camp-lumiere-launch', 'camp-everyday-bf'],
  'site-skincarehub': ['camp-glowlab-q4', 'camp-lumiere-launch'],
  'site-glowguide': ['camp-glowlab-q4', 'camp-nova-home-618'],
  'site-trendreport': ['camp-wander-summer'],
  'comm-glowgang': ['camp-glowlab-q4', 'camp-everyday-bf'],
  'comm-skincareclub': ['camp-glowlab-q4', 'camp-lumiere-launch'],
  'comm-meishetuan': ['camp-nova-home-618', 'camp-glowlab-q4'],
  'comm-glowlabfans': ['camp-glowlab-q4', 'camp-wander-summer'],
};

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const admin = await prisma.user.findFirst({
    where: { email: 'admin@mediakit.local' },
  });
  if (!admin) {
    console.error('❌ No admin user found. Run seed-lookup-tables first.');
    process.exit(1);
  }
  const ownerId = admin.id;
  console.log(`Using owner: ${admin.name} (${ownerId})`);

  const allPartners = [...CONTENT_SITES, ...COMMUNITIES];

  // 1. Seed Creators（内容站 + 社群）
  let count = 0;
  for (const p of allPartners) {
    await prisma.creator.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        name: p.name,
        handle: p.handle,
        platform: p.platform,
        partnerType: p.partnerType,
        tier: p.tier,
        followers: p.followers,
        engagement: p.engagement,
        category: p.category,
        region: p.region,
        ...(p.avatar ? { avatar: p.avatar } : {}),
        ownerId,
      },
      update: {
        name: p.name,
        handle: p.handle,
        platform: p.platform,
        partnerType: p.partnerType,
        tier: p.tier,
        followers: p.followers,
        engagement: p.engagement,
        category: p.category,
        region: p.region,
        ...(p.avatar ? { avatar: p.avatar } : {}),
      },
    });
    count++;
  }
  console.log(`✅ Content site + Community creators: ${count} (${CONTENT_SITES.length} sites + ${COMMUNITIES.length} communities)`);

  // 2. Seed CampaignCreator links
  let linkCount = 0;
  for (const [partnerId, campaignIds] of Object.entries(PARTNER_CAMPAIGN_LINKS)) {
    for (const campaignId of campaignIds) {
      // 验证 campaign 存在
      const exists = await prisma.campaign.findUnique({ where: { id: campaignId } });
      if (!exists) {
        console.warn(`⚠️ Campaign ${campaignId} not found, skipping link for ${partnerId}`);
        continue;
      }
      await prisma.campaignCreator.upsert({
        where: { campaignId_creatorId: { campaignId, creatorId: partnerId } },
        create: { campaignId, creatorId: partnerId },
        update: {},
      });
      linkCount++;
    }
  }
  console.log(`✅ CampaignCreator links: ${linkCount}`);

  console.log('\n🎉 Phase 2b seed complete! (content_site + community)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
