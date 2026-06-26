import { Router } from 'express'
import { validate } from '../../middleware/validate'
import { auth } from '../../middleware/auth'
import { loginSchema } from './auth.schema'
import * as ctrl from './auth.controller'

const router = Router()

router.post('/login', validate({ body: loginSchema }), ctrl.login)
router.post('/refresh', ctrl.refresh)
router.post('/logout', ctrl.logout)
router.get('/me', auth(), ctrl.me)

export default router
