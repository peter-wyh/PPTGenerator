import { Router } from 'express';
import { projectsController } from './projects.controller';
import { validate } from '../../middleware/validate';
import { createProjectSchema, idParamSchema, updateProjectSchema } from './projects.schema';
import { authenticate } from '../../middleware/auth';
import { exportRoutes } from '../export/export.routes';

const router = Router();

router.use(authenticate);

router.get('/', projectsController.list);
router.post('/', validate({ body: createProjectSchema }), projectsController.create);
router.get('/:id', validate({ params: idParamSchema }), projectsController.get);
router.get('/:id/html', validate({ params: idParamSchema }), projectsController.getHtml);
router.patch('/:id', validate({ params: idParamSchema, body: updateProjectSchema }), projectsController.update);
router.delete('/:id', validate({ params: idParamSchema }), projectsController.remove);
router.post('/:id/duplicate', validate({ params: idParamSchema }), projectsController.duplicate);
// 从模版创建项目：body { templateId, name? }
router.post('/from-template', projectsController.createFromTemplate);
router.post('/:id/share', validate({ params: idParamSchema }), projectsController.createShare);
router.delete('/:id/share', validate({ params: idParamSchema }), projectsController.revokeShare);
// /projects/:id/export（PDF 导出，复用本 router 的 authenticate）
router.use('/', exportRoutes);

export const projectsRoutes = router;
