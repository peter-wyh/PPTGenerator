import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../middleware/validate';
import { loginSchema } from './auth.schema';
import { authenticate } from '../../middleware/auth';
import { loginEmailLimiter, loginIpLimiter } from '../../middleware/rate-limit';

const router = Router();

// 登录防爆破：IP + 邮箱双桶专用限流（validate 先行，保证 email 桶 key 合法）
router.post('/login', validate({ body: loginSchema }), loginIpLimiter, loginEmailLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);

export const authRoutes = router;
