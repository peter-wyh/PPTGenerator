import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LEN = 64;
const SALT_LEN = 16;
const PREFIX = 'scrypt';

/** 用 scrypt 哈希密码（无原生依赖）。存储格式：scrypt:<saltHex>:<hashHex> */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(password, salt, KEY_LEN);
  return `${PREFIX}:${salt.toString('hex')}:${hash.toString('hex')}`;
}

/** 常量时间比较校验密码。 */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== PREFIX) return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const hash = scryptSync(password, salt, KEY_LEN);
  if (hash.length !== expected.length) return false;
  return timingSafeEqual(hash, expected);
}
