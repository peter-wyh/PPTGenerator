import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/auth';
import { fontsController } from './fonts.controller';

/**
 * 字体上传 / CRUD 路由（需鉴权）。最终路径：
 *   POST   /api/v1/fonts/upload
 *   GET    /api/v1/fonts
 *   DELETE /api/v1/fonts/:id
 */
const router = Router();

// 50MB；字体文件 + ZIP 包。
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const ok =
      name.endsWith('.ttf') ||
      name.endsWith('.otf') ||
      name.endsWith('.woff') ||
      name.endsWith('.woff2') ||
      name.endsWith('.zip') ||
      // 兜底：部分浏览器对字体给出 octet-stream，按扩展名放行
      file.mimetype === 'application/zip' ||
      file.mimetype === 'application/x-font-ttf' ||
      file.mimetype === 'application/x-font-otf' ||
      file.mimetype === 'font/ttf' ||
      file.mimetype === 'font/otf' ||
      file.mimetype === 'font/woff' ||
      file.mimetype === 'font/woff2';
    cb(null, ok);
  },
});

router.use(authenticate);
router.post('/upload', upload.single('file'), fontsController.upload);
router.get('/', fontsController.list);
router.delete('/:id', fontsController.remove);

export const fontsRoutes = router;
