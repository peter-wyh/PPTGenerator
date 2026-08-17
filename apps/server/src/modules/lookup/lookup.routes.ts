import { Router } from 'express';
import { lookupController } from './lookup.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  idParamSchema,
  createMerchantSchema,
  updateMerchantSchema,
  createBusinessLineSchema,
  updateBusinessLineSchema,
  createAdvertiserSchema,
  updateAdvertiserSchema,
  listAdvertisersQuerySchema,
  listBusinessLinesQuerySchema,
} from './lookup.schema';

const router = Router();

// 全部端点需登录（业务线字典不对匿名暴露；已核实登录页等 pre-auth 表面不调 lookup）。
router.use(authenticate);

router.get('/merchants', lookupController.listMerchants);
router.get('/merchants/:id', validate({ params: idParamSchema }), lookupController.getMerchant);
router.get('/business-lines', validate({ query: listBusinessLinesQuerySchema }), lookupController.listBusinessLines);
router.get('/business-lines/:id', validate({ params: idParamSchema }), lookupController.getBusinessLine);
router.get('/advertisers', validate({ query: listAdvertisersQuerySchema }), lookupController.listAdvertisers);
router.get('/advertisers/:id', validate({ params: idParamSchema }), lookupController.getAdvertiser);

router.post('/merchants', validate({ body: createMerchantSchema }), lookupController.createMerchant);
router.patch('/merchants/:id', validate({ params: idParamSchema, body: updateMerchantSchema }), lookupController.updateMerchant);
router.delete('/merchants/:id', validate({ params: idParamSchema }), lookupController.removeMerchant);

router.post('/business-lines', validate({ body: createBusinessLineSchema }), lookupController.createBusinessLine);
router.patch('/business-lines/:id', validate({ params: idParamSchema, body: updateBusinessLineSchema }), lookupController.updateBusinessLine);
router.delete('/business-lines/:id', validate({ params: idParamSchema }), lookupController.removeBusinessLine);

router.post('/advertisers', validate({ body: createAdvertiserSchema }), lookupController.createAdvertiser);
router.patch('/advertisers/:id', validate({ params: idParamSchema, body: updateAdvertiserSchema }), lookupController.updateAdvertiser);
router.delete('/advertisers/:id', validate({ params: idParamSchema }), lookupController.removeAdvertiser);

export const lookupRoutes = router;
