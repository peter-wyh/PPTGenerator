/**
 * Seed: 创建一份「单页面 Campaign 月报」报告方案 + 示例项目。
 *
 * 1. 在 ReportScheme 表中新增一条单页面月报方案
 * 2. 创建一个 Project（styleType=single），用 report-single-page 模板生成一页，
 *    自动绑定 campaign 数据
 *
 * Usage: npx tsx prisma/seed-single-page-report.ts
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

/* ── 组件工厂（与 templates.ts t() 等价，独立产出纯 JSON） ── */

function cmp(type: string, x: number, y: number, w: number, h: number, data: Record<string, unknown> = {}) {
  return { id: randomUUID(), type, x, y, w, h, data };
}

const SCHEME_CODE = 'single-page-campaign-monthly';

async function main() {
  const owner = await prisma.user.findFirst({ select: { id: true, name: true } });
  if (!owner) throw new Error('No user found');
  const ownerId = owner.id;
  console.log(`Using owner: ${owner.name}`);

  /* ── 1. 创建 / 更新 ReportScheme ── */
  const scheme = await prisma.reportScheme.upsert({
    where: { code: SCHEME_CODE },
    update: {},
    create: {
      code: SCHEME_CODE,
      name: '单页面 Campaign 月报',
      description: '单页面全览：KPI + 趋势 + 漏斗 + 渠道表格（综合/经典/仪表盘/叙事 4 种风格可选）',
      businessLineCode: null, // 通用方案
      pageCount: 1,
      enabled: true,
      sortOrder: 100,
      defaultStyle: 'business-sober',
      ownerId,
    },
  });
  console.log(`✅ ReportScheme: ${scheme.code} → ${scheme.name}`);

  /* ── 2. 创建 Project（styleType=single, 1 页） ── */
  const campaignId = 'camp-glowlab-q4';

  // ── 组件布局（综合风）──
  const components = [
    // 标题
    cmp('text', 80, 40, 1120, 50, {
      content: 'Campaign 月报 · 综合概览',
      fontSize: 28,
      fontWeight: 700,
      fontFamily: '',
      color: '#1A1A1A',
    }),
    // KPI 看板（满宽）
    cmp('kpi-board', 80, 100, 1120, 120, {}),
    // 趋势柱状图（左）
    cmp('bar-chart', 80, 240, 660, 200, { title: '' }),
    // 转化漏斗（右）
    cmp('funnel-chart', 780, 240, 420, 200, {}),
    // 渠道表格标题
    cmp('text', 80, 460, 1120, 24, {
      content: '渠道 / 合作方表现',
      fontSize: 16,
      fontWeight: 600,
      fontFamily: '',
      color: '#1A1A1A',
    }),
    // 渠道表格
    cmp('table', 80, 490, 1120, 200, {
      headers: ['合作方', '类型', '平台', '粉丝/访问量', '互动率', 'GMV', 'ROAS', '状态'],
      rows: [
        ['GlowLab Q4 Campaign', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
      ],
    }),
  ];

  const existingProject = await prisma.project.findFirst({
    where: {
      ownerId,
      name: '单页 Campaign 月报（示例）',
    },
    select: { id: true },
  });

  const pages = [
    {
      id: randomUUID(),
      name: 'Campaign 月报 · 综合概览',
      pageType: 'report-single-page',
      campaignId,
      components,
    },
  ];

  const meta = {
    theme: {
      color: { primary: '#FF5C00', secondary: '#FF8533', chartPalette: ['#FF5C00', '#3B82F6', '#22C55E', '#8B5CF6', '#F59E0B', '#EC4899'], neutralText: '#1A1A1A', neutralBg: '#FFFFFF' },
      font: { text: 'noto-sans-sc', number: 'inter' },
      density: 'standard',
      radius: 'small',
      layout: { safeMargin: 48, gridSize: 10, showGrid: true, showSafeArea: true },
      background: { type: 'color', color: '#FFFFFF' },
      preset: 'business-sober',
    },
    styleType: 'single',
    templateType: 'report-single-page',
    scenario: 'campaign-report',
    campaignId,
    businessLine: 'DM',
    creator: ownerId,
  };

  if (existingProject) {
    // Update existing
    const updated = await prisma.project.update({
      where: { id: existingProject.id },
      data: {
        name: '单页 Campaign 月报（示例）',
        pages: pages as any,
        meta: meta as any,
        width: 1280,
        height: 720,
      },
    });
    console.log(`✅ Project updated: ${updated.id}`);
  } else {
    const project = await prisma.project.create({
      data: {
        name: '单页 Campaign 月报（示例）',
        ownerId,
        pages: pages as any,
        width: 1280,
        height: 720,
        meta: meta as any,
      },
    });
    console.log(`✅ Project created: ${project.id}`);
  }

  console.log(`\n🎉 Seed complete! Scheme + Project for single-page campaign report.`);
  console.log(`   Campaign: ${campaignId}`);
  console.log(`   Style: business-sober (商务沉稳)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
