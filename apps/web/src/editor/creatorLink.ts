import type { CreatorPlatform } from '@mediakit/shared';

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
