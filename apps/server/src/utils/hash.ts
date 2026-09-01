import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const KEY_LEN = 64;
const SALT_LEN = 16;
const PREFIX = 'scrypt';

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

/** 用 scrypt 哈希密码（异步，不阻塞事件循环）。存储格式：scrypt:<saltHex>:<hashHex> */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const hash = await scryptAsync(password, salt, KEY_LEN);
  return `${PREFIX}:${salt.toString('hex')}:${hash.toString('hex')}`;
}

/** 常量时间比较校验密码（异步）。 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== PREFIX) return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const hash = await scryptAsync(password, salt, KEY_LEN);
  if (hash.length !== expected.length) return false;
  return timingSafeEqual(hash, expected);
}

/**
 * 登录侧信道防御：用户不存在/口令哈希格式非法时，登录路径仍要付出一次
 * 真实 scrypt+timingSafeEqual 的代价，使「存在用户 168ms vs 不存在 31ms」
 * 的时序差异消失（0828 审计 P0：可枚举有效邮箱）。
 * dummy 由模块加载时预计算一次，运行期恒定。
 */
const DUMMY_STORED = await hashPassword('timing-equalizer-dummy');

/** 无论用户是否存在，登录校验都走同一条 scrypt+恒定时间比较路径。
 *  返回值恒为 false，仅用于保持调用处分支形状。 */
export function fakeVerifyPassword(password: string): Promise<boolean> {
  return verifyPassword(password, DUMMY_STORED);
}
