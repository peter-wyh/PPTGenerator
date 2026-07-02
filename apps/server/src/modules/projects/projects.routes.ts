import { Router } from 'express';
import { projectsController } from './projects.controller';
import { validate } from '../../middleware/validate';
import { createProjectSchema, idParamSchema, updateProjectSchema } from './projects.schema';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', projectsController.list);
router.post('/', validate({ body: createProjectSchema }), projectsController.create);
router.get('/:id', validate({ params: idParamSchema }), projectsController.get);
router.patch('/:id', validate({ params: idParamSchema, body: updateProjectSchema }), projectsController.update);
router.delete('/:id', validate({ params: idParamSchema }), projectsController.remove);
router.post('/:id/duplicate', validate({ params: idParamSchema }), projectsController.duplicate);

export const projectsRoutes = router;
