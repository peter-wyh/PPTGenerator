import type { Request, Response } from 'express';
import { projectsService } from '../projects/projects.service';
import { asyncHandler } from '../../utils/asyncHandler';

/**
 * 公开分享读取（无认证）。任何持有 token 的人都可只读访问。
 * token 不存在或已撤销 → service 抛 404（不泄露存在性）。
 */
export const shareController = {
  getByToken: asyncHandler(async (req: Request, res: Response) => {
    const project = await projectsService.getByShareToken(req.params.token);
    res.json({ project });
  }),
};
