import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const schemes = await prisma.reportScheme.findMany({
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      pageCount: true,
      businessLineCode: true,
      defaultStyle: true,
      sortOrder: true,
      enabled: true,
    },
  });
  console.log(`Found ${schemes.length} schemes:`);
  console.log(JSON.stringify(schemes, null, 2));

  // Also check STYLE_PRESETS available
  const projects = await prisma.project.count();
  console.log(`\nTotal projects: ${projects}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
