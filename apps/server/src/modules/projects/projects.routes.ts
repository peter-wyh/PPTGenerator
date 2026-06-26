import { Router } from 'express'
import { auth } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { createProjectSchema, updateProjectSchema, projectIdParams } from './projects.schema'
import * as ctrl from './projects.controller'

const router = Router()
router.use(auth())

router.get('/', ctrl.list)
router.post('/', validate({ body: createProjectSchema }), ctrl.create)
router.get('/:id', validate({ params: projectIdParams }), ctrl.getOne)
router.patch('/:id', validate({ params: projectIdParams, body: updateProjectSchema }), ctrl.update)
router.delete('/:id', validate({ params: projectIdParams }), ctrl.remove)
router.post('/:id/duplicate', validate({ params: projectIdParams }), ctrl.duplicate)

export default router
