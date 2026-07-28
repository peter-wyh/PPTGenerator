/**
 * 自定义字体存储：文件落 uploads/fonts/，元数据落 uploads/fonts/fonts.json。
 * 不使用 Prisma（字体是文件资源，无需关系表）。
 *
 * 元数据结构稳定，单进程写入（dev 单实例），简单文件锁足够。
 */
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { FontFormat } from './fontParser';

/** 自定义字体元数据记录。 */
export interface FontRecord {
  /** 唯一 id（UUID）。 */
  id: string;
  /** 字体家族名（解析自 name table，用于 @font-face font-family）。 */
  name: string;
  /** 存入 FONT_OPTIONS 用的稳定 key（如 'custom-<id 短前缀>-<slug>'）。 */
  key: string;
  /** 文件相对路径（相对 uploadDir），前端访问用 /uploads/fonts/<file>。 */
  filename: string;
  /** 公开访问 URL（已含 publicBase）。 */
  url: string;
  /** CSS format() 值。 */
  format: FontFormat;
  /** 原始文件名（用户上传时的名字，用于 UI 展示）。 */
  originalName: string;
  /** 文件大小（字节）。 */
  size: number;
  /** 上传时间 ISO。 */
  uploadedAt: string;
}

/** 列表返回包装。 */
export interface FontListResponse {
  fonts: FontRecord[];
}

const META_FILENAME = 'fonts.json';

/** 拼出 slug：仅小写字母数字，连字符分隔。 */
function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || 'font'
  );
}

/** 简单的文件级互斥（并发写入保护）：进程内 Promise 队列 + 原子写。 */
let writeChain: Promise<unknown> = Promise.resolve();

/** 字体存储：管理 uploads/fonts/ 目录与 fonts.json 元数据。 */
export class FontStorage {
  private readonly dir: string;
  private readonly publicBase: string;
  private cache: FontRecord[] | null = null;

  constructor(opts: { uploadDir: string; publicBase: string }) {
    this.dir = resolve(opts.uploadDir, 'fonts');
    this.publicBase = opts.publicBase.replace(/\/$/, '');
  }

  /** 确保 fonts 目录存在。 */
  async ensureDir(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  /** 元数据文件绝对路径。 */
  private metaPath(): string {
    return resolve(this.dir, META_FILENAME);
  }

  /** 读全部元数据（带内存缓存）。 */
  async list(): Promise<FontRecord[]> {
    if (this.cache) return this.cache;
    try {
      const raw = await fs.readFile(this.metaPath(), 'utf8');
      const parsed = JSON.parse(raw) as FontRecord[];
      this.cache = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.cache = [];
    }
    return this.cache;
  }

  /** 按 id 取单条。 */
  async get(id: string): Promise<FontRecord | undefined> {
    const all = await this.list();
    return all.find((f) => f.id === id);
  }

  /** 保存一个字体文件 + 写元数据。返回新记录。 */
  async save(opts: {
    name: string;
    format: FontFormat;
    data: Buffer;
    originalName: string;
  }): Promise<FontRecord> {
    await this.ensureDir();
    const id = randomUUID();
    const key = `custom-${id.slice(0, 8)}-${slugify(opts.name)}`;
    const ext = opts.format === 'woff2' ? 'woff2' : opts.format === 'woff' ? 'woff' : opts.format === 'opentype' ? 'otf' : 'ttf';
    const filename = `${id.slice(0, 8)}-${slugify(opts.name)}.${ext}`;
    const abs = resolve(this.dir, filename);
    await fs.writeFile(abs, opts.data);

    const url = `${this.publicBase}/uploads/fonts/${filename}`;
    const record: FontRecord = {
      id,
      name: opts.name,
      key,
      filename,
      url,
      format: opts.format,
      originalName: opts.originalName,
      size: opts.data.length,
      uploadedAt: new Date().toISOString(),
    };

    // 串行化写入，避免并发覆盖。
    writeChain = writeChain.then(async () => {
      const all = await this.list();
      all.push(record);
      this.cache = all;
      await fs.writeFile(this.metaPath(), JSON.stringify(all, null, 2), 'utf8');
    });
    await writeChain;
    return record;
  }

  /** 删除一条：移除文件 + 元数据。 */
  async remove(id: string): Promise<FontRecord | null> {
    const all = await this.list();
    const idx = all.findIndex((f) => f.id === id);
    if (idx < 0) return null;
    const [removed] = all.splice(idx, 1);

    writeChain = writeChain.then(async () => {
      this.cache = all;
      await fs.writeFile(this.metaPath(), JSON.stringify(all, null, 2), 'utf8');
      // 删文件（容错：文件可能已被外部移除）。
      try {
        await fs.unlink(resolve(this.dir, removed.filename));
      } catch {
        /* ignore */
      }
    });
    await writeChain;
    return removed;
  }
}
