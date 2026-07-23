import puppeteer, { type Browser } from 'puppeteer';
import { ZipArchive } from 'archiver';
import { PassThrough } from 'stream';
import { config } from '../../config';
import { projectsService } from '../projects/projects.service';

/**
 * 导出（PDF / 图片）：owner 校验 → 确保项目有 share token（无则生成）→
 * puppeteer 访问 share 页面渲染 → 输出 PDF 或 PNG ZIP。
 *
 * 复用前端渲染，避免把 React + recharts 组件 SSR 化。需 WEB_URL 可达。
 */
async function ensureShareToken(ownerId: string, projectId: string): Promise<string> {
  const existing = await projectsService.getShareToken(ownerId, projectId);
  if (existing) return existing;
  return projectsService.createShareToken(ownerId, projectId);
}

async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

async function renderPdf(shareUrl: string, widthPx: number, heightPx: number): Promise<Buffer> {
  let browser: Browser | undefined;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.goto(shareUrl, { waitUntil: 'networkidle0', timeout: 60_000 });
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

/**
 * 图片导出：puppeteer 打开 share 页 → 逐页截图 → archiver 打包 ZIP。
 * ?print=1 模式下所有页面纵向排列，每页 canvasHeight 高，按偏移截取。
 * 返回 Readable stream（可直接 pipe 到 res），避免内存中拼接大 ZIP。
 */
async function renderImages(
  shareUrl: string,
  widthPx: number,
  heightPx: number,
  pageCount: number,
): Promise<{ stream: PassThrough; totalSize: Promise<number> }> {
  let browser: Browser | undefined;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: widthPx, height: heightPx, deviceScaleFactor: 2 });
    await page.goto(shareUrl, { waitUntil: 'networkidle0', timeout: 60_000 });

    // 等待所有 [data-page] 元素出现（print 模式每页一个 div）
    await page.waitForSelector(
      `:is([data-page]):nth-of-type(${pageCount})`,
      { timeout: 30_000 },
    );

    const archive = new ZipArchive({ zlib: { level: 6 } });
    const passthrough = new PassThrough();
    archive.pipe(passthrough);

    let totalSize = 0;
    archive.on('data', (chunk: Buffer) => { totalSize += chunk.length; });

    for (let i = 0; i < pageCount; i++) {
      const clip = { x: 0, y: i * heightPx, width: widthPx, height: heightPx };
      const png = await page.screenshot({ clip, type: 'png' });
      archive.append(Buffer.from(png), { name: `page-${String(i + 1).padStart(2, '0')}.png` });
    }

    await archive.finalize();
    const sizePromise = new Promise<number>((resolve) => {
      passthrough.on('end', () => resolve(totalSize));
    });

    return { stream: passthrough, totalSize: sizePromise };
  } finally {
    if (browser) await browser.close();
  }
}

export const exportService = {
  /** 生成项目 PDF，返回 Buffer + 推荐文件名。 */
  async exportProjectPdf(ownerId: string, projectId: string): Promise<{ buffer: Buffer; filename: string; projectName: string }> {
    const detail = await projectsService.getOwnedOrThrow(ownerId, projectId);
    const token = ensureShareToken(ownerId, projectId);
    const shareUrl = `${config.webUrl}/share/${token}?print=1`;
    const buffer = await renderPdf(shareUrl, detail.width, detail.height);
    const safeName = detail.name.replace(/[\\/:*?"<>|]/g, '_');
    return { buffer, filename: `${safeName}.pdf`, projectName: detail.name };
  },

  /** 导出项目为 PNG ZIP，返回 Readable stream。每页一张 2x 高清 PNG。 */
  async exportProjectImages(ownerId: string, projectId: string): Promise<{
    stream: PassThrough;
    filename: string;
    pageCount: number;
  }> {
    const detail = await projectsService.getOwnedOrThrow(ownerId, projectId);
    const pageCount = detail.pages?.length ?? 1;
    const token = ensureShareToken(ownerId, projectId);
    const shareUrl = `${config.webUrl}/share/${token}?print=1`;
    const { stream } = await renderImages(shareUrl, detail.width, detail.height, pageCount);
    const safeName = detail.name.replace(/[\\/:*?"<>|]/g, '_');
    return { stream, filename: `${safeName}.zip`, pageCount };
  },
};
