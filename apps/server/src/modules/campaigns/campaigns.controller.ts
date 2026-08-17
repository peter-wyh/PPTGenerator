import type { Request, Response } from 'express';
import { campaignService, creatorService, campaignCreatorService, performanceService, collaborationService, importService } from './campaigns.service';
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
    res.json({ campaigns: await campaignService.list({ ownerId: userId(req), ...q }) });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    res.json({ campaign: await campaignService.getOrThrow(req.params.id, userId(req)) });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const v = req.user as AuthPayload;
    assertBusinessLine(v, (req.body as { businessLineCode?: string })?.businessLineCode);
    res.status(201).json({ campaign: await campaignService.create(v.id, req.body) });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const v = req.user as AuthPayload;
    assertBusinessLine(v, (req.body as { businessLineCode?: string })?.businessLineCode);
    res.json({ campaign: await campaignService.update(req.params.id, v.id, req.body) });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await campaignService.remove(req.params.id, userId(req));
    res.status(204).end();
  }),

  // ─── Analytics ───────────────────────────────────────────────────────────────
  getAnalytics: asyncHandler(async (req: Request, res: Response) => {
    res.json({ analytics: await campaignService.getAnalytics(req.params.campaignId, userId(req)) });
  }),

  updateAnalytics: asyncHandler(async (req: Request, res: Response) => {
    const result = await campaignService.updateAnalytics(req.params.campaignId, userId(req), req.body.analytics ?? req.body);
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
    res.json({ campaignCreators: await campaignCreatorService.listByCampaign(req.params.campaignId, userId(req)) });
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
    const linkId = await performanceService.resolveLinkId(campaignId, creatorId, userId(req));
    const perf = await performanceService.getByCampaignCreator(linkId);
    res.json({ performance: perf });
  }),

  upsertPerformance: asyncHandler(async (req: Request, res: Response) => {
    const { campaignId, creatorId } = req.params;
    const linkId = await performanceService.resolveLinkId(campaignId, creatorId, userId(req));
    const perf = await performanceService.upsert({ campaignCreatorId: linkId, ...req.body });
    res.status(201).json({ performance: perf });
  }),

  // ─── Collaboration ─────────────────────────────────────────────────────────
  getCollaboration: asyncHandler(async (req: Request, res: Response) => {
    const { campaignId, creatorId } = req.params;
    const linkId = await performanceService.resolveLinkId(campaignId, creatorId, userId(req));
    const collab = await collaborationService.getByCampaignCreator(linkId);
    res.json({ collaboration: collab });
  }),

  upsertCollaboration: asyncHandler(async (req: Request, res: Response) => {
    const { campaignId, creatorId } = req.params;
    const linkId = await performanceService.resolveLinkId(campaignId, creatorId, userId(req));
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
};
