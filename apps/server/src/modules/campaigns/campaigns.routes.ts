import { Router } from 'express';
import { campaignController } from './campaigns.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  idParamSchema,
  createCampaignSchema,
  updateCampaignSchema,
  listCampaignsQuerySchema,
  createCreatorSchema,
  updateCreatorSchema,
  listCreatorsQuerySchema,
  createCampaignCreatorSchema,
  updateCampaignCreatorSchema,
} from './campaigns.schema';

const router = Router();

// 全部需要登录（按 ownerId 隔离数据）。
router.use(authenticate);

// ─── Campaign ────────────────────────────────────────────────────────────────
router.get('/', validate({ query: listCampaignsQuerySchema }), campaignController.list);
router.get('/:id', validate({ params: idParamSchema }), campaignController.get);
router.post('/', validate({ body: createCampaignSchema }), campaignController.create);
router.patch('/:id', validate({ params: idParamSchema, body: updateCampaignSchema }), campaignController.update);
router.delete('/:id', validate({ params: idParamSchema }), campaignController.remove);

// ─── Creator ─────────────────────────────────────────────────────────────────
router.get('/creators/list', validate({ query: listCreatorsQuerySchema }), campaignController.listCreators);
router.get('/creators/:id', validate({ params: idParamSchema }), campaignController.getCreator);
router.post('/creators', validate({ body: createCreatorSchema }), campaignController.createCreator);
router.patch('/creators/:id', validate({ params: idParamSchema, body: updateCreatorSchema }), campaignController.updateCreator);
router.delete('/creators/:id', validate({ params: idParamSchema }), campaignController.removeCreator);

// ─── CampaignCreator ─────────────────────────────────────────────────────────
router.get('/:campaignId/creators', campaignController.listLinks);
router.post('/links', validate({ body: createCampaignCreatorSchema }), campaignController.upsertLink);
router.patch('/links/:id', validate({ params: idParamSchema, body: updateCampaignCreatorSchema }), campaignController.updateLink);
router.delete('/links/:id', validate({ params: idParamSchema }), campaignController.removeLink);

// ─── Performance / Collaboration ─────────────────────────────────────────────
// 路由: /:campaignId/creators/:creatorId/performance | /collaboration
router.get('/:campaignId/creators/:creatorId/performance', campaignController.getPerformance);
router.put('/:campaignId/creators/:creatorId/performance', campaignController.upsertPerformance);
router.get('/:campaignId/creators/:creatorId/collaboration', campaignController.getCollaboration);
router.put('/:campaignId/creators/:creatorId/collaboration', campaignController.upsertCollaboration);

// ─── Batch Import (structured tables) ────────────────────────────────────────
router.post('/import/creators', campaignController.importCreators);
router.post('/import/creator-audience', campaignController.importCreatorAudience);
router.post('/import/creator-works', campaignController.importCreatorWorks);
router.post('/import/collaboration-daily', campaignController.importCollaborationDaily);
router.post('/import/cps', campaignController.importCps);
router.post('/import/cps-daily', campaignController.importCpsDaily);

export const campaignsRoutes = router;
