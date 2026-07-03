import type { Request, Response } from 'express';
import { exportService } from './export.service';
import { asyncHandler } from '../../utils/asyncHandler';
import type { AuthPayload } from '../../types/express';

function owner(req: Request): string {
  return (req.user as AuthPayload).id;
}

export const exportController = {
  /** POST /projects/:id/export?format=pdf → 返回 PDF 文件下载。 */
  exportProject: asyncHandler(async (req: Request, res: Response) => {
    const format = (req.query.format as string | undefined) ?? 'pdf';
    if (format !== 'pdf') {
      res.status(400).json({ message: 'Unsupported export format. Only "pdf" is supported.' });
      return;
    }
    const { buffer, filename } = await exportService.exportProjectPdf(owner(req), req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
  }),
};
