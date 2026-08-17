import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/hash';
import { seedBusinessLineUsers, reassignOwnersToBusinessLines } from './seed-users';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // 1. admin（幂等 upsert）
  const email = 'admin@mediaket.local';
  const password = 'admin123';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] admin user already exists: ${email}`);
  } else {
    await prisma.user.create({
      data: {
        email,
        passwordHash: hashPassword(password),
        name: 'Admin',
        role: 'ADMIN',
      },
    });
    console.log(`[seed] created admin user: ${email} / ${password}`);
  }

  // 2. 业务线账号（{code小写}@mediaket.local / mediaket123）+ 存量划归
  await seedBusinessLineUsers();
  await reassignOwnersToBusinessLines();
}

main()
  .catch((err) => {
    console.error('[seed] failed', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
