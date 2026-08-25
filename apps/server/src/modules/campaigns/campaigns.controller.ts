import type { Request, Response } from 'express';
import { campaignService, creatorService, campaignCreatorService, performanceService, collaborationService, importService, cpsOverviewService } from './campaigns.service';
import { orderStatsService } from './order-stats.service';
import { recomputePublisherStats } from './publisher-stats.service';
import { asyncHandler } from '../../utils/asyncHandler';
import type { AuthPayload } from '../../types/express';
import { assertBusinessLine } from '../../utils/business-line';

function userId(req: Request): string {
  return (req.user as AuthPayload).id;
}

export const campaignController = {
  // ─── Campaign ──────────────────────────────────────────────────────────────
  list: asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as { businessLineId?: string; advertiserId?: string; businessLineCode?: string; status?: string };
    const v = req.user as AuthPayload;
    res.json({ campaigns: await campaignService.list({ ownerId: v.id, admin: v.role === 'ADMIN', viewerBusinessLineCode: v.businessLineCode, ...q }) });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const v = req.user as AuthPayload;
    res.json({ campaign: await campaignService.getOrThrow(req.params.id, v.id, v.role === 'ADMIN') });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const v = req.user as AuthPayload;
    const body = req.body as { businessLineCode?: string; businessLineId?: string };
    // 守卫覆盖 code 与 id 两条赋值路径：仅给 id 时解析成 code 再校验。
    let code = body.businessLineCode;
    if (!code && body.businessLineId) code = (await campaignService.resolveBusinessLineCode(body.businessLineId)) ?? undefined;
    assertBusinessLine(v, code);
    res.status(201).json({ campaign: await campaignService.create(v.id, req.body) });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const v = req.user as AuthPayload;
    const body = req.body as { businessLineCode?: string; businessLineId?: string };
    let code = body.businessLineCode;
    if (!code && body.businessLineId) code = (await campaignService.resolveBusinessLineCode(body.businessLineId)) ?? undefined;
    assertBusinessLine(v, code);
    res.json({ campaign: await campaignService.update(req.params.id, v.id, req.body) });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await campaignService.remove(req.params.id, userId(req));
    res.status(204).end();
  }),

  // ─── Analytics ───────────────────────────────────────────────────────────────
  getAnalytics: asyncHandler(async (req: Request, res: Response) => {
    const v = req.user as AuthPayload;
    res.json({ analytics: await campaignService.getAnalytics(req.params.campaignId, v.id, v.role === 'ADMIN') });
  }),

  updateAnalytics: asyncHandler(async (req: Request, res: Response) => {
    const v = req.user as AuthPayload;
    const result = await campaignService.updateAnalytics(req.params.campaignId, v.id, req.body.analytics ?? req.body, v.role === 'ADMIN');
    res.json({ analytics: result.analytics });
  }),

  // ─── Creator ───────────────────────────────────────────────────────────────
  listCreators: asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as { platform?: string; tier?: string; category?: string; partnerType?: string; search?: string };
    res.json({ creators: await creatorService.list(q) });
  }),

  getCreator: asyncHandler(async (req: Request, res: Response) => {
    res.json({ creator: await creatorService.getOrThrow(req.params.id) });
  }),

  createCreator: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ creator: await creatorService.create(userId(req), req.body) });
  }),

  updateCreator: asyncHandler(async (req: Request, res: Response) => {
    res.json({ creator: await creatorService.update(req.params.id, req.user as AuthPayload, req.body) });
  }),

  removeCreator: asyncHandler(async (req: Request, res: Response) => {
    await creatorService.remove(req.params.id, req.user as AuthPayload);
    res.status(204).end();
  }),

  // ─── CampaignCreator ───────────────────────────────────────────────────────
  listLinks: asyncHandler(async (req: Request, res: Response) => {
    const v = req.user as AuthPayload;
    res.json({ campaignCreators: await campaignCreatorService.listByCampaign(req.params.campaignId, v.id, v.role === 'ADMIN') });
  }),

  upsertLink: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ campaignCreator: await campaignCreatorService.upsert(req.body, userId(req)) });
  }),

  updateLink: asyncHandler(async (req: Request, res: Response) => {
    res.json({ campaignCreator: await campaignCreatorService.update(req.params.id, userId(req), req.body) });
  }),

  removeLink: asyncHandler(async (req: Request, res: Response) => {
    await campaignCreatorService.remove(req.params.id, userId(req));
    res.status(204).end();
  }),

  // ─── Performance ───────────────────────────────────────────────────────────
  getPerformance: asyncHandler(async (req: Request, res: Response) => {
    const { campaignId, creatorId } = req.params;
    const v = req.user as AuthPayload;
    const linkId = await performanceService.resolveLinkId(campaignId, creatorId, v.id, v.role === 'ADMIN');
    const perf = await performanceService.getByCampaignCreator(linkId);
    res.json({ performance: perf });
  }),

  upsertPerformance: asyncHandler(async (req: Request, res: Response) => {
    const { campaignId, creatorId } = req.params;
    const v = req.user as AuthPayload;
    const linkId = await performanceService.resolveLinkId(campaignId, creatorId, v.id, v.role === 'ADMIN');
    const perf = await performanceService.upsert({ campaignCreatorId: linkId, ...req.body });
    res.status(201).json({ performance: perf });
  }),

  // ─── Collaboration ─────────────────────────────────────────────────────────
  getCollaboration: asyncHandler(async (req: Request, res: Response) => {
    const { campaignId, creatorId } = req.params;
    const v = req.user as AuthPayload;
    const linkId = await performanceService.resolveLinkId(campaignId, creatorId, v.id, v.role === 'ADMIN');
    const collab = await collaborationService.getByCampaignCreator(linkId);
    res.json({ collaboration: collab });
  }),

  upsertCollaboration: asyncHandler(async (req: Request, res: Response) => {
    const { campaignId, creatorId } = req.params;
    const v = req.user as AuthPayload;
    const linkId = await performanceService.resolveLinkId(campaignId, creatorId, v.id, v.role === 'ADMIN');
    const legacyId = `collab:${campaignId}:${creatorId}`;
    const collab = await collaborationService.upsert({
      campaignCreatorId: linkId,
      legacyId,
      ...req.body,
    });
    res.status(201).json({ collaboration: collab });
  }),

  // ─── Batch Import ───────────────────────────────────────────────────────────
  importCreators: asyncHandler(async (req: Request, res: Response) => {
    const items = (req.body.items ?? []) as Record<string, unknown>[];
    const result = await importService.importCreators(userId(req), items);
    res.json(result);
  }),

  importCreatorAudience: asyncHandler(async (req: Request, res: Response) => {
    const items = (req.body.items ?? []) as Record<string, unknown>[];
    const result = await importService.importCreatorAudience(userId(req), items);
    res.json(result);
  }),

  importCreatorWorks: asyncHandler(async (req: Request, res: Response) => {
    const items = (req.body.items ?? []) as Record<string, unknown>[];
    const result = await importService.importCreatorWorks(userId(req), items);
    res.json(result);
  }),

  importCollaborationDaily: asyncHandler(async (req: Request, res: Response) => {
    const items = (req.body.items ?? []) as Record<string, unknown>[];
    const result = await importService.importCollaborationDaily(userId(req), items);
    res.json(result);
  }),

  importCps: asyncHandler(async (req: Request, res: Response) => {
    const items = (req.body.items ?? []) as Record<string, unknown>[];
    const result = await importService.importCpsPerformance(userId(req), items);
    res.json(result);
  }),

  importCpsDaily: asyncHandler(async (req: Request, res: Response) => {
    const items = (req.body.items ?? []) as Record<string, unknown>[];
    const result = await importService.importCpsDaily(userId(req), items);
    res.json(result);
  }),

  importOrders: asyncHandler(async (req: Request, res: Response) => {
    const items = (req.body.items ?? []) as Record<string, unknown>[];
    const result = await importService.importOrders(userId(req), items);
    res.json(result);
  }),

  /** 订单商品聚合：Top-Sales（含 QTY）+ 购物篮指标。query: start/end（可选 YYYY-MM-DD）。 */
  getOrderInsights: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id ?? '');
    const { start, end } = req.query as { start?: string; end?: string };
    const v = req.user as AuthPayload;
    const insights = await campaignService.getOrderInsights(id, v.id, { start, end }, v.role === 'ADMIN');
    res.json(insights);
  }),

  /** 手动重算订单日级统计中间层（OrderDailyStat）。迁移后回填 / 排查用。 */
  recomputeOrderStats: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id ?? '');
    const v = req.user as AuthPayload;
    await campaignService.getOrThrow(id, v.id, v.role === 'ADMIN');
    const result = await orderStatsService.recomputeOrderStats(id);
    res.json(result);
  }),

  /** 手动重算媒体日统计中间层（PublisherDailyStat）。媒体维度统计回填 / 排查用。 */
  recomputePublisherStats: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id ?? '');
    const v = req.user as AuthPayload;
    await campaignService.getOrThrow(id, v.id, v.role === 'ADMIN');
    const result = await recomputePublisherStats(id);
    res.json(result);
  }),

  /** 订单明细列表（数据管理页）：query: campaignId/page/pageSize。admin 全局，非 admin 限本人 campaign。 */
  listOrders: asyncHandler(async (req: Request, res: Response) => {
    const v = req.user as AuthPayload;
    const { campaignId } = req.query as { campaignId?: string };
    const page = parseInt(String(req.query.page ?? '1'), 10) || 1;
    const pageSize = parseInt(String(req.query.pageSize ?? '20'), 10) || 20;
    const result = await campaignService.listOrders(v.id, {
      campaignId: campaignId || undefined,
      page,
      pageSize,
      admin: v.role === 'ADMIN',
    });
    res.json(result);
  }),

  /** CPS 概览（合作列表浮窗只读聚合）：params: id=campaignId, query: ccId/creatorId 可选。权限同 getOrThrow 三态。 */
  cpsOverview: asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id ?? '');
    const v = req.user as AuthPayload;
    await campaignService.getOrThrow(id, v.id, v.role === 'ADMIN');
    const ccId = String(req.query.ccId ?? '') || undefined;
    const creatorId = String(req.query.creatorId ?? '') || undefined;
    const result = await cpsOverviewService.getForCampaign(id, { campaignCreatorId: ccId, creatorId });
    res.json(result);
  }),
};
