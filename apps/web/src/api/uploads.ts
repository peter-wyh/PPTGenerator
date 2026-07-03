import { api } from './client';

/** 上传图片（裁剪后的 blob）→ 返回可访问 URL（本地 /uploads 或 OSS）。 */
export async function uploadImage(file: Blob): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<{ url: string }>('/uploads', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.url;
}
