import puppeteer, { type Browser } from 'puppeteer';
import { config } from '../../config';
import { projectsService } from '../projects/projects.service';

/**
 * PDF 导出：owner 校验 → 确保项目有 share token（无则生成）→ puppeteer 访问
 * 前端 share 页 ?print=1 让浏览器渲染全部页面 → print-to-PDF（每页一屏，page-break 分页）。
 *
 * 复用前端渲染，避免把 React + recharts 组件 SSR 化。需 WEB_URL 可达。
 */
async function ensureShareToken(ownerId: string, projectId: string): Promise<string> {
  const existing = await projectsService.getShareToken(ownerId, projectId);
  if (existing) return existing;
  return projectsService.createShareToken(ownerId, projectId);
}

async function renderPdf(shareUrl: string, widthPx: number, heightPx: number): Promise<Buffer> {
  let browser: Browser | undefined;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.goto(shareUrl, { waitUntil: 'networkidle0', timeout: 60_000 });
    // px → inch（96 dpi）
    const widthIn = widthPx / 96;
    const heightIn = heightPx / 96;
    const pdf = await page.pdf({
      format: undefined as unknown as never,
      width: `${widthIn}in`,
      height: `${heightIn}in`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: false,
    });
    return Buffer.from(pdf);
  } finally {
    if (browser) await browser.close();
  }
}

export const exportService = {
  /** 生成项目 PDF，返回 Buffer + 推荐文件名。 */
  async exportProjectPdf(ownerId: string, projectId: string): Promise<{ buffer: Buffer; filename: string; projectName: string }> {
    // 复用所有权校验拿 detail（取 name/width/height）
    const detail = await projectsService.getOwnedOrThrow(ownerId, projectId);
    const token = await ensureShareToken(ownerId, projectId);
    const shareUrl = `${config.webUrl}/share/${token}?print=1`;
    const buffer = await renderPdf(shareUrl, detail.width, detail.height);
    const safeName = detail.name.replace(/[\\/:*?"<>|]/g, '_');
    return { buffer, filename: `${safeName}.pdf`, projectName: detail.name };
  },
};
