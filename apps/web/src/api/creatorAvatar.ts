/**
 * 达人头像 URL（demo 用确定性占位图）。
 *
 * 真实环境对接达人库/CRM 的真实头像；demo 中无真人照片，
 * 用 picsum 按 name 确定性取随机照片 —— 相同 name → 相同头像。
 */
export function creatorAvatarUrl(name: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(name)}/200/200`;
}

