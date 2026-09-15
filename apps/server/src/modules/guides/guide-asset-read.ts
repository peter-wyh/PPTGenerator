/**
 * ★ g6 参考文件回显:按 ref 读指南资产文件内容(css/tokens/checklist 均为文本)。
 * 复用 guide-css-asset 的装载防护(目录穿越拦截);仅登录可用。
 * 样张(kind:'sample', OSS URL)不走此端点——前端直接开原 URL。
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename_esm = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url);
const ASSETS_DIR = join(dirname(__filename_esm), 'assets');

const MAX_BYTES = 512 * 1024; // 512KB 上限,防超大文件拖垮响应

export function readGuideAssetText(ref: string): { content: string; truncated: boolean } | null {
  if (!ref || ref.startsWith('/') || ref.split('/').includes('..')) return null;
  for (const base of [ASSETS_DIR, join(process.cwd(), 'src/modules/guides/assets'), join(process.cwd(), 'dist/modules/guides/assets')]) {
    try {
      const buf = readFileSync(join(base, ref));
      if (buf.length > MAX_BYTES) return { content: buf.slice(0, MAX_BYTES).toString('utf-8'), truncated: true };
      return { content: buf.toString('utf-8'), truncated: false };
    } catch { /* try next */ }
  }
  return null;
}
