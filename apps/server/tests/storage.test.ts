import { describe, it, expect, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { LocalStorage } from '../src/modules/upload/storage';

// 1×1 透明 PNG 头。
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

// 每个用例独立目录，跑完即清，避免互相污染。
let dir: string;
afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe('LocalStorage URL 形态', () => {
  // 回归防护：publicBase 为空（PUBLIC_BASE 未设的默认）时必须返回相对路径，
  // 否则 <img src="http://localhost:4000/..."> 会在容器/远程/部署后直连失败 → 图片不回显。
  // 详见 config.ts 的 publicBase 默认值与 vite.config.ts 的 /uploads 代理。
  it('publicBase 为空 → 返回相对 /uploads/<file>，并落盘', async () => {
    dir = join(tmpdir(), `mk_storage_${Math.random().toString(36).slice(2)}`);
    const storage = new LocalStorage(dir, '');
    const { url, key } = await storage.save(PNG, 'png');

    expect(url).toMatch(/^\/uploads\/.+\.png$/);
    expect(url.startsWith('http')).toBe(false); // 不能是绝对地址
    expect(key).toMatch(/\.png$/);
  });

  it('显式 publicBase（CDN 等）→ 返回 <base>/uploads/<file>', async () => {
    dir = join(tmpdir(), `mk_storage_${Math.random().toString(36).slice(2)}`);
    const storage = new LocalStorage(dir, 'https://cdn.example.com');
    const { url } = await storage.save(PNG, 'png');

    expect(url).toMatch(/^https:\/\/cdn\.example\.com\/uploads\/.+\.png$/);
  });

  it('publicBase 结尾斜杠会被规范化', async () => {
    dir = join(tmpdir(), `mk_storage_${Math.random().toString(36).slice(2)}`);
    const storage = new LocalStorage(dir, 'https://cdn.example.com/');
    const { url } = await storage.save(PNG, 'png');

    expect(url).not.toContain('//uploads'); // 不会出现 cdn.example.com//uploads
    expect(url).toMatch(/^https:\/\/cdn\.example\.com\/uploads\//);
  });
});
