import { Router } from 'express'
import { auth, requireAdmin } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { createUserSchema, updateUserSchema, userIdParams } from './users.schema'
import * as ctrl from './users.controller'

const router = Router()

router.use(auth(), requireAdmin())

router.get('/', ctrl.list)
router.post('/', validate({ body: createUserSchema }), ctrl.create)
router.patch('/:id', validate({ params: userIdParams, body: updateUserSchema }), ctrl.update)
router.delete('/:id', validate({ params: userIdParams }), ctrl.remove)

export default router
