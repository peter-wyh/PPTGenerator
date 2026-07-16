import { describe, it, expect, beforeEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { api } from '@/api/client';
import { projectsApi } from '@/api/projects';

/**
 * PDF 导出走的是服务端 puppeteer 路由：POST /projects/:id/export?format=pdf
 * （见 apps/server export.routes.ts / export.controller.ts，两处注释均标明 POST）。
 * 前端曾误用 GET，命中 Express「方法不匹配 → 404」，导出永远失败。这里钉死方法。
 */
const mock = new MockAdapter(api);

describe('projectsApi.exportPdf — 必须用 POST', () => {
  beforeEach(() => mock.reset());

  it('对 /projects/:id/export 发起 POST（带 format=pdf、blob），返回 Blob', async () => {
    const pdfBody = '%PDF-1.4 fake pdf bytes';
    mock.onPost('/projects/p1/export').reply(200, pdfBody, {
      'content-type': 'application/pdf',
    });

    const blob = await projectsApi.exportPdf('p1');

    // 关键：必须是 POST，不是 GET。
    expect(mock.history.post).toHaveLength(1);
    expect(mock.history.get).toHaveLength(0);

    const req = mock.history.post[0];
    expect(req.url).toBe('/projects/p1/export');
    expect(req.params).toMatchObject({ format: 'pdf' });
    expect(req.responseType).toBe('blob');

    // mock-adapter 在 node 环境不真正把 body 包成 Blob（已知限制），
    // 故只验证 .then(r => r.data) 的透传，而非 instanceof Blob（那是 axios 运行时职责）。
    expect(blob).toBe(pdfBody);
  });
});
