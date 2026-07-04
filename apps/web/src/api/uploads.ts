import { api } from './client';

/** 上传图片（裁剪后的 blob）→ 返回可访问 URL（本地 /uploads 或 OSS）。 */
export async function uploadImage(file: Blob): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  // 不要手动设 Content-Type：FormData 必须由浏览器带上 boundary，
  // 否则 multer 解析不出 multipart 边界 → req.file 为空 → 上传 400。
  const res = await api.post<{ url: string }>('/uploads', form);
  return res.data.url;
}
