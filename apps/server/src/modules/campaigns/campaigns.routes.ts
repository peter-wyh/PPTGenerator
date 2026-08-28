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
// ★ 字面量路由必须先于 /:id 注册，否则被 :id 吞掉（orders/list 同理在下方集中放行前）
router.get('/order-daily-stats', campaignController.listOrderDailyStats);
router.get('/publisher-daily-stats', campaignController.listPublisherDailyStats);
router.get('/publisher-stat-publishers', campaignController.listPublisherStatPublishers);
router.get('/links/list', campaignController.listLinkPerformances);
router.get('/links/daily', campaignController.listLinkDailyStats);
/** 0828 批量总览：合作列表页一次拉全（须先于 /:id 注册，否则被吞） */
router.get('/collab-overview', campaignController.collabOverview);
router.get('/:id', validate({ params: idParamSchema }), campaignController.get);
router.post('/', validate({ body: createCampaignSchema }), campaignController.create);
router.patch('/:id', validate({ params: idParamSchema, body: updateCampaignSchema }), campaignController.update);
router.delete('/:id', validate({ params: idParamSchema }), campaignController.remove);

// ─── Analytics (Campaign 级分析数据) ──────────────────────────────────────────
router.get('/:campaignId/analytics', campaignController.getAnalytics);
router.put('/:campaignId/analytics', campaignController.updateAnalytics);

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
/** 合作行每日 CPS 真源现算（0827 整合，只读） */
router.get('/:campaignId/creators/:creatorId/cps-daily', campaignController.getCreatorCpsDaily);
router.put('/:campaignId/creators/:creatorId/collaboration', campaignController.upsertCollaboration);

// ─── Batch Import (structured tables) ────────────────────────────────────────
router.post('/import/creators', campaignController.importCreators);
router.post('/import/creator-audience', campaignController.importCreatorAudience);
router.post('/import/creator-works', campaignController.importCreatorWorks);
router.post('/import/collaboration-daily', campaignController.importCollaborationDaily);
router.post('/import/link-performance', campaignController.importLinkPerformance);
router.post('/import/orders', campaignController.importOrders);
router.get('/:id/cps-overview', campaignController.cpsOverview);
router.get('/orders/list', campaignController.listOrders);
router.get('/:id/order-insights', campaignController.getOrderInsights);
router.post('/:id/order-stats/recompute', campaignController.recomputeOrderStats);
router.post('/:id/publisher-stats/recompute', campaignController.recomputePublisherStats);

export const campaignsRoutes = router;
