import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '@/api/client';

// 捕获真实 uploadImage 发出的请求配置。
const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: { url: 'http://localhost:4000/uploads/x.png' } } as never);

import { uploadImage } from '@/api/uploads';

describe('uploadImage', () => {
  beforeEach(() => postSpy.mockClear());

  it('不手动设 multipart Content-Type（boundary 须由浏览器生成）', async () => {
    const form = new FormData();
    form.append('file', new Blob(['x']), 'a.png');
    await uploadImage(form.get('file') as Blob);

    expect(postSpy).toHaveBeenCalledTimes(1);
    const cfg = postSpy.mock.calls[0][2] as { headers?: Record<string, string> } | undefined;
    const ct = cfg?.headers?.['Content-Type'];
    // 手写 'multipart/form-data'（无 boundary）会让 multer 解析失败 → 上传 400。
    expect(ct).toBeFalsy();
  });
});
