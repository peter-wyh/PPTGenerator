import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/auth';
import { uploadController } from './upload.controller';

/** 上传路由（需鉴权）。最终路径：POST /api/v1/uploads。 */
const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    // image/svg+xml 会被 controller 的 EXT_BY_MIME 拒绝；在 multer 层一并拦截
    // （审计 #2：SVG 可内嵌 <script>，同域提供即存储型 XSS）。
    if (file.mimetype.startsWith('image/') && file.mimetype !== 'image/svg+xml') cb(null, true);
    else cb(null, false);
  },
});

router.use(authenticate);
router.post('/', upload.single('file'), uploadController.upload);

export const uploadRoutes = router;
