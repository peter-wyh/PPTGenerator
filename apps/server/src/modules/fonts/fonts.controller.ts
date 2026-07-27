/**
 * 字体上传 / 列出 / 删除 控制器。
 *
 * POST /api/v1/fonts/upload
 *   - 单文件 TTF/OTF/WOFF/WOFF2
 *   - 或 ZIP（自动解包提取其中的字体文件）
 *   - 返回 { fonts: FontRecord[] }（ZIP 可能多条）
 *
 * GET  /api/v1/fonts         → { fonts: FontRecord[] }
 * DELETE /api/v1/fonts/:id   → { ok: true } | 404
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { config } from '../../config';
import { FontStorage, type FontRecord } from './fontStorage';
import {
  parseFontName,
  extractFontsFromZip,
  isFontFile,
  FONT_EXTENSIONS,
} from './fontParser';

/** 单例存储：复用 config.storage 的 uploadDir + publicBase。 */
const storage = new FontStorage({
  uploadDir: config.storage.uploadDir,
  publicBase: config.storage.publicBase,
});

/** 最大上传体积（字体 + ZIP）：50MB。 */
const MAX_FONT_BYTES = 50 * 1024 * 1024;

/** 把单个字体 buffer 保存为 FontRecord（解析 name + 落盘 + 写元数据）。 */
async function saveFontFile(
  data: Buffer,
  originalName: string,
): Promise<FontRecord> {
  const { name, format } = parseFontName(data, originalName);
  return storage.save({ name, format, data, originalName });
}

export const fontsController = {
  /** 上传：单字体或 ZIP。 */
  upload: asyncHandler(async (req: Request, res: Response) => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) throw ApiError.badRequest('未提供文件');

    if (file.size > MAX_FONT_BYTES) {
      throw ApiError.badRequest(`文件过大（> ${MAX_FONT_BYTES / 1024 / 1024}MB）`);
    }

    const lowerName = file.originalname.toLowerCase();
    const isZip = lowerName.endsWith('.zip') || file.mimetype === 'application/zip';

    if (isZip) {
      const entries = extractFontsFromZip(file.buffer);
      if (entries.length === 0) {
        throw ApiError.badRequest('ZIP 中未找到字体文件（支持 TTF/OTF/WOFF/WOFF2）');
      }
      const records: FontRecord[] = [];
      for (const e of entries) {
        // 限制单 ZIP 总解压体积（防 zip bomb：每条 < MAX）
        if (e.data.length > MAX_FONT_BYTES) {
          throw ApiError.badRequest(`ZIP 内文件过大：${e.name}`);
        }
        records.push(await saveFontFile(e.data, e.name.split('/').pop() ?? e.name));
      }
      res.status(201).json({ fonts: records });
      return;
    }

    if (!isFontFile(file.originalname)) {
      throw ApiError.badRequest(
        `仅支持字体文件（${FONT_EXTENSIONS.join('/').toUpperCase()}）或 ZIP 包`,
      );
    }

    const record = await saveFontFile(file.buffer, file.originalname);
    res.status(201).json({ fonts: [record] });
  }),

  /** 列出所有自定义字体。 */
  list: asyncHandler(async (_req: Request, res: Response) => {
    const fonts = await storage.list();
    res.json({ fonts });
  }),

  /** 删除单个字体。 */
  remove: asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id;
    const removed = await storage.remove(id);
    if (!removed) throw ApiError.notFound(`字体不存在: ${id}`);
    res.json({ ok: true });
  }),
};
