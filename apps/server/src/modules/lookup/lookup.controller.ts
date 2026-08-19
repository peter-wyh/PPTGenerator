import type { Request, Response } from 'express';
import { merchantService, businessLineService, advertiserService, marketingEventService } from './lookup.service';
import { asyncHandler } from '../../utils/asyncHandler';

export const lookupController = {
  // ─── Merchant ──────────────────────────────────────────────────────────────
  listMerchants: asyncHandler(async (_req: Request, res: Response) => {
    res.json({ merchants: await merchantService.list() });
  }),

  getMerchant: asyncHandler(async (req: Request, res: Response) => {
    res.json({ merchant: await merchantService.getOrThrow(req.params.id) });
  }),

  createMerchant: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ merchant: await merchantService.create(req.body) });
  }),

  updateMerchant: asyncHandler(async (req: Request, res: Response) => {
    res.json({ merchant: await merchantService.update(req.params.id, req.body) });
  }),

  removeMerchant: asyncHandler(async (req: Request, res: Response) => {
    await merchantService.remove(req.params.id);
    res.status(204).end();
  }),

  // ─── BusinessLine ──────────────────────────────────────────────────────────
  listBusinessLines: asyncHandler(async (req: Request, res: Response) => {
    const { merchantId } = req.query as { merchantId?: string };
    res.json({ businessLines: await businessLineService.list({ merchantId }) });
  }),

  getBusinessLine: asyncHandler(async (req: Request, res: Response) => {
    res.json({ businessLine: await businessLineService.getOrThrow(req.params.id) });
  }),

  createBusinessLine: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ businessLine: await businessLineService.create(req.body) });
  }),

  updateBusinessLine: asyncHandler(async (req: Request, res: Response) => {
    res.json({ businessLine: await businessLineService.update(req.params.id, req.body) });
  }),

  removeBusinessLine: asyncHandler(async (req: Request, res: Response) => {
    await businessLineService.remove(req.params.id);
    res.status(204).end();
  }),

  // ─── Advertiser ────────────────────────────────────────────────────────────
  listAdvertisers: asyncHandler(async (req: Request, res: Response) => {
    const { businessLineCode, businessLineId } = req.query as {
      businessLineCode?: string;
      businessLineId?: string;
    };
    res.json({
      advertisers: await advertiserService.list({ businessLineCode, businessLineId }),
    });
  }),

  getAdvertiser: asyncHandler(async (req: Request, res: Response) => {
    res.json({ advertiser: await advertiserService.getOrThrow(req.params.id) });
  }),

  createAdvertiser: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ advertiser: await advertiserService.create(req.body) });
  }),

  updateAdvertiser: asyncHandler(async (req: Request, res: Response) => {
    res.json({ advertiser: await advertiserService.update(req.params.id, req.body) });
  }),

  removeAdvertiser: asyncHandler(async (req: Request, res: Response) => {
    await advertiserService.remove(req.params.id);
    res.status(204).end();
  }),

  // ─── MarketingEvent（营销活动）──────────────────────────────────────────────
  listMarketingEvents: asyncHandler(async (req: Request, res: Response) => {
    const { advertiserId } = req.query as { advertiserId?: string };
    res.json({ marketingEvents: await marketingEventService.list({ advertiserId }) });
  }),

  getMarketingEvent: asyncHandler(async (req: Request, res: Response) => {
    res.json({ marketingEvent: await marketingEventService.getOrThrow(req.params.id) });
  }),

  createMarketingEvent: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ marketingEvent: await marketingEventService.create(req.body) });
  }),

  updateMarketingEvent: asyncHandler(async (req: Request, res: Response) => {
    res.json({ marketingEvent: await marketingEventService.update(req.params.id, req.body) });
  }),

  removeMarketingEvent: asyncHandler(async (req: Request, res: Response) => {
    await marketingEventService.remove(req.params.id);
    res.status(204).end();
  }),
};
