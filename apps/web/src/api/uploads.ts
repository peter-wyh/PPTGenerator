import { api } from './client';

/**
 * 上传图片（裁剪后的 blob）→ 返回可访问 URL（本地 /uploads 或 OSS）。
 *
 * ★ 不再静默回退 base64 data URL：
 *   旧逻辑接口失败时回退 base64 填入表单——预览看似有图，但
 *   a) base64 动辄上万字符，超出 zod logo.max(2048) → 保存必 400；
 *   b) 图片从未真正落库/落盘，刷新即丢。
 *   这正是「上传了但不确定成功」的元凶。现在失败显式抛错，由调用方提示用户重试。
 */
export async function uploadImage(file: Blob): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  // 不要手动设 Content-Type：FormData 必须由浏览器带上 boundary，
  // 否则 multer 解析不出 multipart 边界 → req.file 为空 → 上传 400。
  const res = await api.post<{ url: string }>('/uploads', form);
  return res.data.url;
}
