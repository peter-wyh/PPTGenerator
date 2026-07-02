import { Router } from 'express';
import { usersController } from './users.controller';
import { validate } from '../../middleware/validate';
import { createUserSchema, updateUserSchema } from './users.schema';
import { authenticate, requireRole } from '../../middleware/auth';

const router = Router();

router.use(authenticate, requireRole('ADMIN'));

router.get('/', usersController.list);
router.post('/', validate({ body: createUserSchema }), usersController.create);
router.patch('/:id', validate({ body: updateUserSchema }), usersController.update);
router.delete('/:id', usersController.remove);

export const usersRoutes = router;
