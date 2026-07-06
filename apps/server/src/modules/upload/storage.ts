/**
 * 文件存储适配器：本地目录 / OSS，由 STORAGE_DRIVER env 切换。
 * 上传经 memoryStorage（见 upload.routes）拿到 buffer 后由此写入。
 */
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export interface SaveResult {
  url: string;
  key: string;
}

export interface Storage {
  save(buf: Buffer, ext: string): Promise<SaveResult>;
}

/** ali-oss 客户端用到的方法（结构化类型，避免依赖其类型声明）。 */
interface OssClient {
  put(key: string, body: Buffer): Promise<unknown>;
}

/** 本地磁盘存储：写入 uploadDir，对外 url = publicBase + /uploads/<file>。 */
export class LocalStorage implements Storage {
  constructor(private readonly uploadDir: string, private readonly publicBase: string) {}

  async save(buf: Buffer, ext: string): Promise<SaveResult> {
    await fs.mkdir(this.uploadDir, { recursive: true });
    const hash = createHash('sha1').update(buf).digest('hex').slice(0, 16);
    const file = `${hash}-${randomUUID().slice(0, 8)}.${ext}`;
    const abs = resolve(this.uploadDir, file);
    await fs.writeFile(abs, buf);
    // 自行归一化尾部斜杠，避免 config 之外的调用方传入带斜杠的 base 产生 //uploads。
    const base = this.publicBase.replace(/\/$/, '');
    return { url: `${base}/uploads/${file}`, key: file };
  }
}

/** 阿里云 OSS 存储。bucket 假定公读，url = endpoint/bucket/key 形式。 */
export class OssStorage implements Storage {
  private readonly client: OssClient;
  private readonly baseUrl: string;

  constructor(opts: { region: string; bucket: string; accessKeyId: string; accessKeySecret: string; endpoint?: string }) {
    // 动态 require，避免本地驱动也加载 ali-oss。
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const OSSLib = require('ali-oss');
    const Ctor = (OSSLib.default ?? OSSLib) as new (o: typeof opts) => OssClient;
    this.client = new Ctor(opts);
    // 公网访问基址：自定义 endpoint 优先，否则 bucket.region 风格。
    this.baseUrl =
      opts.endpoint?.replace(/^https?:\/\//, `https://${opts.bucket}.`) ||
      `https://${opts.bucket}.${opts.region}.aliyuncs.com`;
  }

  async save(buf: Buffer, ext: string): Promise<SaveResult> {
    const key = `mediakit/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    await this.client.put(key, buf);
    return { url: `${this.baseUrl}/${key}`, key };
  }
}

/**
 * 按配置构造存储实现。oss 驱动需配齐 region/bucket/accessKeyId/accessKeySecret，
 * 否则降级本地（保证开发期零配置可用）。
 */
export function createStorage(cfg: {
  driver: 'local' | 'oss';
  uploadDir: string;
  publicBase: string;
  oss?: { region?: string; bucket?: string; accessKeyId?: string; accessKeySecret?: string; endpoint?: string };
}): Storage {
  if (cfg.driver === 'oss' && cfg.oss?.region && cfg.oss?.bucket && cfg.oss?.accessKeyId && cfg.oss?.accessKeySecret) {
    return new OssStorage({
      region: cfg.oss.region,
      bucket: cfg.oss.bucket,
      accessKeyId: cfg.oss.accessKeyId,
      accessKeySecret: cfg.oss.accessKeySecret,
      endpoint: cfg.oss.endpoint,
    });
  }
  return new LocalStorage(cfg.uploadDir, cfg.publicBase);
}
