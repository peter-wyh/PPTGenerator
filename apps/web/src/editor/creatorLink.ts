import type { CreatorAvatarCardData, CreatorPlatform } from '@mediakit/shared';

/** 平台 → 命中 host 关键词（小写）。 */
const PLATFORM_HOSTS: { platform: CreatorPlatform; hosts: string[] }[] = [
  { platform: 'tiktok', hosts: ['tiktok.com'] },
  { platform: 'instagram', hosts: ['instagram.com'] },
  { platform: 'youtube', hosts: ['youtube.com', 'youtu.be'] },
  { platform: 'weibo', hosts: ['weibo.com', 'weibo.cn'] },
];

/** 从达人链接识别平台；不支持返回 null。 */
export function detectPlatform(url: string): CreatorPlatform | null {
  const noProto = (url ?? '').toLowerCase().replace(/^https?:\/\//, '');
  const host = noProto.split('/')[0].replace(/^(www\.|m\.)/, '');
  for (const { platform, hosts } of PLATFORM_HOSTS) {
    if (hosts.some((h) => host === h || host.endsWith(`.${h}`))) return platform;
  }
  return null;
}

/* ----------------------------- 确定性 mock 数据 ----------------------------- */

const FIRST_NAMES = ['Mia', 'Sofia', 'Ava', 'Jamie', 'Leo', 'Nora', 'Tom', 'Ivy', 'Maya', 'Eli', 'Zoe', 'Kai'];
const LAST_NAMES = ['Chen', 'Lane', 'Park', 'Wu', 'Sato', 'Kim', 'Reyes', 'Li', 'Owens', 'Tan'];
const CATEGORIES = ['Beauty', 'Skincare', 'Lifestyle', 'Fashion', 'Tech', 'Food', 'Fitness', 'Travel'];
const SYLLABLES = ['mi', 'so', 'av', 'ja', 'le', 'no', 'to', 'iv', 'ma', 'el', 'zo', 'ka', 'lu', 're', 'na', 'da'];

/** FNV-1a 32 位确定性哈希。 */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

/** 数字格式化为易读量级字符串（如 1.28M / 684K）。 */
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

function makeHandle(seed: number): string {
  return (
    '@' +
    pick(SYLLABLES, seed) +
    pick(SYLLABLES, seed >> 4) +
    pick(SYLLABLES, seed >> 8)
  );
}

/**
 * 解析达人链接，返回 mock 字段。确定性：相同 URL → 相同结果。
 * 不支持的链接 reject（调用方提示「暂不支持」）。
 */
export function parseCreatorLink(
  url: string,
): Promise<Partial<CreatorAvatarCardData>> {
  const trimmed = (url ?? '').trim();
  const platform = detectPlatform(trimmed);
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!platform) {
        reject(new Error('unsupported platform'));
        return;
      }
      const seed = fnv1a(trimmed);
      const name = `${pick(FIRST_NAMES, seed)} ${pick(LAST_NAMES, seed >> 3)}`;
      const handle = makeHandle(seed);
      const category = pick(CATEGORIES, seed >> 5);
      const followerBase = 50_000 + (seed % 2_500_000);
      const followers = formatCount(followerBase);
      const likes = formatCount(followerBase * (8 + (seed % 10)));
      const engagement = `${(3 + (seed % 10)).toFixed(1)}%`;
      resolve({
        platform,
        name,
        handle,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
        followers,
        likes,
        engagement,
        intro: `${name} · ${category} Creator · ${handle}`,
        sourceUrl: trimmed,
      });
    }, 400);
  });
}
