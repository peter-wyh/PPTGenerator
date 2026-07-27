import { api } from './client';

/**
 * 读取 File/Blob 为 base64 data URL（离线兜底）。
 * 当 /uploads 接口不可用时使用，使图片仍能内联展示。
 */
function readAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * 上传图片（裁剪后的 blob）→ 返回可访问 URL（本地 /uploads 或 OSS）。
 * 网络失败或接口不可用时，fallback 到 base64 data URL（离线兜底），
 * 保证图片仍能就地渲染。
 */
export async function uploadImage(file: Blob): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  // 不要手动设 Content-Type：FormData 必须由浏览器带上 boundary，
  // 否则 multer 解析不出 multipart 边界 → req.file 为空 → 上传 400。
  try {
    const res = await api.post<{ url: string }>('/uploads', form);
    return res.data.url;
  } catch (err) {
    // 离线 / 后端不可用：回退为 base64 data URL，保证图片仍能就地展示。
    console.warn('[uploads] /uploads 失败，回退 base64 data URL：', err);
    return readAsDataURL(file);
  }
}
