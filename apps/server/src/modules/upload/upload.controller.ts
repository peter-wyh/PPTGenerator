import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { createStorage } from './storage';
import { config } from '../../config';

/** 单例存储：按 env 选 local / oss。 */
const storage = createStorage(config.storage);

/** 允许的图片扩展（与路由 fileFilter 的 image/* 呼应）。 */
const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

export const uploadController = {
  upload: asyncHandler(async (req: Request, res: Response) => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) throw ApiError.badRequest('未提供文件');
    const ext = EXT_BY_MIME[file.mimetype];
    if (!ext) throw ApiError.badRequest('仅支持图片文件');
    const { url } = await storage.save(file.buffer, ext);
    res.status(201).json({ url });
  }),
};
