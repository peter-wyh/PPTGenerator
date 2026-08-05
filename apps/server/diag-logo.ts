import { prisma } from './src/prisma';

async function main() {
  const p = await prisma.project.findUnique({ where: { id: 'cmsfo1xb20000tr5kvd1rsc5y' } });
  const meta = p?.meta as any;
  console.log('htmlContent length:', meta?.htmlContent?.length || 0);
  console.log('aiHtmlStatus:', meta?.aiHtmlStatus);
  console.log('first 200 chars:', (meta?.htmlContent || '').substring(0, 200));

  // Also check DG project
  const dg = await prisma.project.findUnique({ where: { id: 'cmsfk6o590002unl4afh1a67w' } });
  const dgMeta = dg?.meta as any;
  console.log('\n=== DG Project ===');
  console.log('htmlContent length:', dgMeta?.htmlContent?.length || 0);
  console.log('aiHtmlStatus:', dgMeta?.aiHtmlStatus);
  console.log('first 200 chars:', (dgMeta?.htmlContent || '').substring(0, 200));

  // Check all projects with htmlContent
  const all = await prisma.project.findMany({ select: { id: true, name: true, meta: true } });
  console.log('\n=== Projects with htmlContent ===');
  all.forEach(pr => {
    const len = (pr.meta as any)?.htmlContent?.length || 0;
    if (len > 0) console.log(`  ${pr.id} | ${pr.name} | ${len} chars | status=${(pr.meta as any)?.aiHtmlStatus}`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
