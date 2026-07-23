import type { Request, Response } from 'express';
import { exportService } from './export.service';
import { asyncHandler } from '../../utils/asyncHandler';
import type { AuthPayload } from '../../types/express';

function owner(req: Request): string {
  return (req.user as AuthPayload).id;
}

export const exportController = {
  /** POST /projects/:id/export?format=pdf|images → 返回文件下载。 */
  exportProject: asyncHandler(async (req: Request, res: Response) => {
    const format = (req.query.format as string | undefined) ?? 'pdf';

    if (format === 'pdf') {
      const { buffer, filename } = await exportService.exportProjectPdf(owner(req), req.params.id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.send(buffer);
      return;
    }

    if (format === 'images') {
      const { stream, filename, pageCount } = await exportService.exportProjectImages(owner(req), req.params.id);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      // 提示文件包含多少张图片
      res.setHeader('X-Image-Count', String(pageCount));
      stream.pipe(res);
      return;
    }

    res.status(400).json({ message: 'Unsupported export format. Supported: "pdf", "images".' });
  }),
};
