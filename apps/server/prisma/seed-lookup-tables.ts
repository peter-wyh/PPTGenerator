/**
 * Phase 1 seed: Merchant / BusinessLine / Advertiser
 * 数据来源：apps/web/src/projectsMeta.ts（MERCHANTS / BUSINESS_LINE_META / ADVERTISER_META）
 *
 * Usage: npx prisma db seed  OR  npx tsx prisma/seed-lookup-tables.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── 种子数据（与 projectsMeta.ts 保持一致）─────────────────────────────────

interface MerchantSeed {
  id: string;
  name: string;
  logo?: string;
}

interface BusinessLineSeed {
  code: string;
  name: string;
  logo?: string;
  color?: string;
  merchantId: string;
}

interface AdvertiserSeed {
  name: string;
  logo?: string;
  businessLineCode: string;
  merchantId: string;
}

const MERCHANTS: MerchantSeed[] = [
  { id: 'm1', name: 'GlowLab Flagship Store',    logo: 'https://placehold.co/120x120/2563eb/ffffff?text=M1' },
  { id: 'm2', name: 'LUMIÈRE Global Store',      logo: 'https://placehold.co/120x120/1e293b/ffffff?text=M2' },
  { id: 'm3', name: 'NOVA Home Living Store',    logo: 'https://placehold.co/120x120/475569/ffffff?text=M3' },
  { id: 'm4', name: 'MOTION Sports Gear',        logo: 'https://placehold.co/120x120/dc2626/ffffff?text=M4' },
  { id: 'm5', name: 'EVERYDAY Essentials Store', logo: 'https://placehold.co/120x120/65a30d/ffffff?text=M5' },
  { id: 'm6', name: 'WANDER Outdoor Store',      logo: 'https://placehold.co/120x120/0d9488/ffffff?text=M6' },
];

const BUSINESS_LINES: BusinessLineSeed[] = [
  { code: 'FT', name: 'FineTech',    logo: 'https://placehold.co/120x120/2563eb/ffffff?text=FT', color: '#2563eb', merchantId: 'm1' },
  { code: 'SM', name: 'SocialMove',  logo: 'https://placehold.co/120x120/16a34a/ffffff?text=SM', color: '#16a34a', merchantId: 'm2' },
  { code: 'CX', name: 'CosmeX',      logo: 'https://placehold.co/120x120/db2777/ffffff?text=CX', color: '#db2777', merchantId: 'm3' },
  { code: 'DG', name: 'DigitalGo',   logo: 'https://placehold.co/120x120/ea580c/ffffff?text=DG', color: '#ea580c', merchantId: 'm4' },
  { code: 'KN', name: 'KitchenNest', logo: 'https://placehold.co/120x120/9333ea/ffffff?text=KN', color: '#9333ea', merchantId: 'm5' },
  { code: 'DM', name: 'DreamMart',   logo: 'https://placehold.co/120x120/0891b2/ffffff?text=DM', color: '#0891b2', merchantId: 'm6' },
];

const ADVERTISERS: AdvertiserSeed[] = [
  { name: 'GlowLab',     logo: 'https://placehold.co/120x120/2563eb/ffffff?text=GL', businessLineCode: 'FT', merchantId: 'm1' },
  { name: 'LUMIÈRE',     logo: 'https://placehold.co/120x120/1e293b/ffffff?text=LU', businessLineCode: 'SM', merchantId: 'm2' },
  { name: 'NOVA Home',   logo: 'https://placehold.co/120x120/475569/ffffff?text=NV', businessLineCode: 'CX', merchantId: 'm3' },
  { name: 'MOTION',      logo: 'https://placehold.co/120x120/dc2626/ffffff?text=MO', businessLineCode: 'DG', merchantId: 'm4' },
  { name: 'EVERYDAY',    logo: 'https://placehold.co/120x120/65a30d/ffffff?text=EV', businessLineCode: 'KN', merchantId: 'm5' },
  { name: 'WANDER',      logo: 'https://placehold.co/120x120/0d9488/ffffff?text=WA', businessLineCode: 'DM', merchantId: 'm6' },
];

async function main() {
  // 1. Merchants（upsert by id）
  for (const m of MERCHANTS) {
    await prisma.merchant.upsert({
      where: { id: m.id },
      update: { name: m.name, logo: m.logo },
      create: m,
    });
    console.log(`  ✓ Merchant: ${m.id} (${m.name})`);
  }

  // 2. BusinessLines（upsert by code）
  for (const bl of BUSINESS_LINES) {
    await prisma.businessLine.upsert({
      where: { code: bl.code },
      update: { name: bl.name, logo: bl.logo, color: bl.color, merchantId: bl.merchantId },
      create: bl,
    });
    console.log(`  ✓ BusinessLine: ${bl.code} (${bl.name})`);
  }

  // 3. Advertisers（upsert by name）
  for (const a of ADVERTISERS) {
    // 需要将 businessLineCode → businessLineId
    const bl = await prisma.businessLine.findUnique({ where: { code: a.businessLineCode } });
    if (!bl) throw new Error(`BusinessLine not found: ${a.businessLineCode}`);
    await prisma.advertiser.upsert({
      where: { name: a.name },
      update: { logo: a.logo, businessLineId: bl.id, merchantId: a.merchantId },
      create: { name: a.name, logo: a.logo, businessLineId: bl.id, merchantId: a.merchantId },
    });
    console.log(`  ✓ Advertiser: ${a.name}`);
  }

  console.log(`\n✅ Seed complete: ${MERCHANTS.length} merchants, ${BUSINESS_LINES.length} business lines, ${ADVERTISERS.length} advertisers`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
