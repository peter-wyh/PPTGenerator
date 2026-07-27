import { api } from './client';
import type { CustomFontMeta } from '@mediakit/shared';

/** 字体列表 / 上传 / 删除响应类型。 */
interface FontListResponse {
  fonts: CustomFontMeta[];
}
interface FontUploadResponse {
  fonts: CustomFontMeta[];
}

/** 列出所有已上传的自定义字体。 */
export async function listFonts(): Promise<CustomFontMeta[]> {
  const res = await api.get<FontListResponse>('/fonts');
  return res.data.fonts;
}

/** 上传字体文件（TTF/OTF/WOFF/WOFF2 单文件，或 ZIP 包）。返回新增字体列表（ZIP 可能多条）。 */
export async function uploadFont(file: File): Promise<CustomFontMeta[]> {
  const form = new FormData();
  form.append('file', file);
  // 不手动设 Content-Type：浏览器需自带 multipart boundary。
  const res = await api.post<FontUploadResponse>('/fonts/upload', form);
  return res.data.fonts;
}

/** 删除一个自定义字体。 */
export async function deleteFont(id: string): Promise<void> {
  await api.delete(`/fonts/${id}`);
}
