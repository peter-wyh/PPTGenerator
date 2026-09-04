import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { guideService } from './guide.service';
import { validateHtml, lintChecks } from './html-validator';
import type { GuideCheck } from './html-validator';

export const guideController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { businessLineId } = req.query as { businessLineId?: string };
    res.json({ guides: await guideService.list({ businessLineId }) });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ guide: await guideService.create(req.body) });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    res.json({ guide: await guideService.update(req.params.id, req.body) });
  }),

  /* ═══ S1 版本管理 ═══ */

  listRevisions: asyncHandler(async (req: Request, res: Response) => {
    res.json({ revisions: await guideService.listRevisions(req.params.id) });
  }),

  getRevision: asyncHandler(async (req: Request, res: Response) => {
    const rev = await guideService.getRevision(req.params.id, Number(req.params.version));
    res.json({ revision: rev });
  }),

  saveRevision: asyncHandler(async (req: Request, res: Response) => {
    const createdBy = (req as unknown as { user?: { email?: string; id?: string } }).user?.email
      ?? (req as unknown as { user?: { id?: string } }).user?.id
      ?? 'unknown';
    const out = await guideService.saveRevision(req.params.id, { ...req.body, createdBy });
    res.status(out.deduped ? 200 : 201).json(out);
  }),

  activateRevision: asyncHandler(async (req: Request, res: Response) => {
    const rev = await guideService.activateRevision(req.params.id, req.body.version);
    res.json({ revision: rev });
  }),

  /* ═══ S2 干跑校验 ═══ */

  /**
   * 对 checks 做静态 lint + 对 html(传入)或最近一次生成(缺省)执行断言。
   * 保存前干跑:业务改错当场暴露,不等到生成。
   */
  dryRunChecks: asyncHandler(async (req: Request, res: Response) => {
    const { checks, html } = req.body as { checks: GuideCheck[]; html?: string };
    const lintErrors = lintChecks(checks ?? []);
    let targetHtml = html;
    if (!targetHtml) {
      // 缺省:取该业务线最近一次生成的 htmlContent(无则仅 lint)
      const guide = await guideService.getOrThrow(req.params.id);
      const recent = await guideService.listRecentGeneratedHtml(guide.businessLineId);
      targetHtml = recent ?? undefined;
    }
    const report = targetHtml ? validateHtml(targetHtml, checks ?? []) : null;
    res.json({ lintErrors, report, hasTarget: Boolean(targetHtml) });
  }),
};
