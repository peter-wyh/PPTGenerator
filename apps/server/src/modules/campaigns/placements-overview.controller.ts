/**
 * 业务线广告位截图聚合端点 —— GET /campaigns/placements/overview
 * 按业务线聚合各 campaign 的 analytics.mediaPlacements，供数据管理页集中管理。
 * 返回: { businessLine: {...}|null, campaigns: [{ id, name, status, startDate, endDate, placements: [...] }] }
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { prisma } from '../../prisma';
import type { AuthPayload } from '../../types/express';

interface PlacementEntry {
  name?: string;
  screenshotUrl?: string;
  description?: string;
  platform?: string;
  postUrl?: string;
}

export const placementsOverview = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthPayload | undefined;
  if (!user) throw ApiError.unauthorized('未登录');

  const businessLineId = String(req.query.businessLineId ?? '').trim();

  // 三态可见性与 campaigns.list 对齐: ADMIN 全局; 业务线账号看本线; 其余只看自己的
  const where: Record<string, unknown> = {};
  if (user.role !== 'ADMIN') {
    if (user.businessLineCode) {
      where.businessLine = { code: user.businessLineCode };
    } else {
      where.ownerId = user.id;
    }
  }
  if (businessLineId) where.businessLineId = businessLineId;

  const campaigns = await prisma.campaign.findMany({
    where,
    select: {
      id: true, name: true, status: true, startDate: true, endDate: true,
      businessLineId: true,
      businessLine: { select: { id: true, code: true, title: true, color: true } },
      analytics: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });

  const rows = campaigns.map((c) => {
    const analytics = (c.analytics as Record<string, unknown> | null) ?? {};
    const placements = Array.isArray(analytics.mediaPlacements)
      ? (analytics.mediaPlacements as PlacementEntry[]).map((p, idx) => ({ ...p, _idx: idx }))
      : [];
    return {
      id: c.id, name: c.name, status: c.status,
      startDate: c.startDate, endDate: c.endDate,
      businessLine: c.businessLine,
      placements,
    };
  });

  res.json({ campaigns: rows });
});
