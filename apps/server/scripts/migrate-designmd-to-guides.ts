/**
 * 一次性迁移:BusinessLine.designMd 非空 → 该业务线一条 isDefault Guide。
 * 幂等:同名迁移指南已存在则跳过。designMd 字段保留(只读),注入路径已在前序 commit 废除。
 * Usage: npx tsx scripts/migrate-designmd-to-guides.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SUFFIX = '设计规范(迁移)';

async function main() {
  const bls = await prisma.businessLine.findMany({ where: { designMd: { not: null } } });
  for (const bl of bls) {
    const content = (bl.designMd ?? '').trim();
    if (!content) { console.log(`[skip] ${bl.code} designMd 空白`); continue; }
    const name = `${bl.name} ${SUFFIX}`;
    const exists = await prisma.guide.findFirst({ where: { businessLineId: bl.id, name } });
    if (exists) { console.log(`[skip] ${bl.code} 已迁移(${name})`); continue; }
    await prisma.$transaction([
      prisma.guide.updateMany({ where: { businessLineId: bl.id, isDefault: true }, data: { isDefault: false } }),
      prisma.guide.create({ data: { businessLineId: bl.id, name, content, isDefault: true } }),
    ]);
    console.log(`[migrated] ${bl.code} → "${name}"`);
  }
  console.log('done');
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
