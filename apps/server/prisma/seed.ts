import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/hash';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = 'admin@mediakit.local';
  const password = 'admin123';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] admin user already exists: ${email}`);
    return;
  }

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

main()
  .catch((err) => {
    console.error('[seed] failed', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
