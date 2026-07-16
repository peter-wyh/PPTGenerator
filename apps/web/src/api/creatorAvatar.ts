/**
 * 达人头像 URL（demo 用确定性占位图）。
 *
 * 真实环境对接达人库/CRM 的真实头像；demo 中无真人照片，
 * 用 picsum 按 name 确定性取随机照片 —— 相同 name → 相同头像。
 */
export function creatorAvatarUrl(name: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(name)}/200/200`;
}

/**
 * 达人主页链接 URL（demo 用确定性链接）。
 * 真实环境对接达人平台 API 获取真实 profile URL。
 */
export function creatorProfileUrl(handle: string, platform: string): string {
  const h = handle.replace(/^@/, '');
  switch (platform) {
    case 'TikTok': return `https://www.tiktok.com/@${h}`;
    case 'Instagram': return `https://www.instagram.com/${h}`;
    case 'YouTube': return `https://www.youtube.com/@${h}`;
    case 'Twitter': case 'X': return `https://x.com/${h}`;
    case 'Facebook': return `https://www.facebook.com/${h}`;
    case 'Douyin': return `https://www.douyin.com/user/${h}`;
    case 'Xiaohongshu': return `https://www.xiaohongshu.com/user/profile/${h}`;
    case 'Weibo': return `https://weibo.com/${h}`;
    case 'Bilibili': return `https://space.bilibili.com/${h}`;
    default: return `https://example.com/${h}`;
  }
}

