/**
 * 业务线账号 seed：
 * 1. 按库中 BusinessLine 为每条业务线 upsert 一个 USER 账号（{code小写}@mediakit.local / mediakit123）。
 * 2. 把 ADMIN 名下的存量业务数据按 businessLine 字段划归到对应业务线账号（ownerId 机制）。
 *
 * 幂等：可重复执行。划归只动「当前归 ADMIN 所有」的行，不会抢业务线账号新建的数据。
 * 注：划归放这里而不放 migration——UPDATE JOIN 依赖业务线账号已存在，migration 无法保证顺序。
 * 本文件只导出函数，不自动执行（main 由 seed.ts 编排；也避免被 import 时意外跑库）。
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/hash';

const prisma = new PrismaClient();

const PASSWORD = 'mediakit123';

export async function seedBusinessLineUsers(): Promise<void> {
  const lines = await prisma.businessLine.findMany({ orderBy: { code: 'asc' } });
  if (lines.length === 0) {
    console.log('[seed-users] BusinessLine 表为空，跳过（先跑 seed-lookup-tables.ts）');
    return;
  }
  for (const bl of lines) {
    const email=***;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { name: bl.name, businessLineCode: bl.code },
      });
      console.log(`[seed-users] updated: ${email} (${bl.code})`);
    } else {
      await prisma.user.create({
        data: {
          email,
          passwordHash: hashPassword(PASSWORD),
          name: bl.name,
          role: 'USER',
          businessLineCode: bl.code,
        },
      });
      console.log(`[seed-users] created: ${email} / ${PASSWORD} (${bl.code})`);
    }
  }

  // 孤儿账号（businessLineCode 指向已删除的业务线）：仅告警，不删——
  // User 删除会级联删其名下 Campaign/Project 等数据。
  const orphans = await prisma.user.findMany({
    where: { businessLineCode: { notIn: lines.map((b) => b.code) } },
    select: { email: true, businessLineCode: true },
  });
  for (const o of orphans) {
    console.warn(`[seed-users] WARN: ${o.email} 的业务线 ${o.businessLineCode} 已不存在（保留账号与数据）`);
  }
}

/** 把 ADMIN 名下存量数据按业务线划归（ownerId → 业务线账号）。只动 ADMIN 拥有的行。 */
export async function reassignOwnersToBusinessLines(): Promise<void> {
  // Campaign：结构化 businessLineCode 列
  const c1 = await prisma.$executeRaw`
    UPDATE \`Campaign\` c
    JOIN \`User\` u ON u.businessLineCode = c.businessLineCode AND u.role = 'USER'
    JOIN \`User\` a ON a.id = c.ownerId AND a.role = 'ADMIN'
    SET c.ownerId = u.id`;

  // DataRecord(CAMPAIGN)：data JSON 里的 businessLine
  const c2 = await prisma.$executeRaw`
    UPDATE \`DataRecord\` d
    JOIN \`User\` u
      ON u.businessLineCode = JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.businessLine'))
      AND u.role = 'USER'
    JOIN \`User\` a ON a.id = d.ownerId AND a.role = 'ADMIN'
    SET d.ownerId = u.id
    WHERE d.kind = 'CAMPAIGN'`;

  // Project：meta JSON 里的 businessLine（NULL 业务线的留 admin）
  const c3 = await prisma.$executeRaw`
    UPDATE \`Project\` p
    JOIN \`User\` u
      ON u.businessLineCode = JSON_UNQUOTE(JSON_EXTRACT(p.meta, '$.businessLine'))
      AND u.role = 'USER'
    JOIN \`User\` a ON a.id = p.ownerId AND a.role = 'ADMIN'
    SET p.ownerId = u.id`;

  console.log(`[seed-users] reassign: Campaign=${c1} DataRecord(CAMPAIGN)=${c2} Project=${c3}`);
}
