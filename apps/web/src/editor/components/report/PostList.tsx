/**
 * PostList — 帖子列表（≈PRD CMP-B16）。
 * 列顺序 [截图URL, 标题, ID, 链接, 数据]。
 */
import type { PostListData } from '@mediakit/shared';
import { ImgOrPlaceholder } from './shared';

export function PostList({ data }: { data: PostListData }) {
  const { variant = 'cards', headers = [], rows = [] } = data;
  const items = rows.map((r) => ({ img: r[0] ?? '', title: r[1] ?? '', id: r[2] ?? '', link: r[3] ?? '', metric: r[4] ?? '' }));
  const idLabel = headers[2] ?? 'ID';

  if (variant === 'compact') {
    return (
      <div className="flex h-full w-full flex-col gap-1 overflow-auto skin-card skin-pad-sm">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border-subtle py-1.5 last:border-b-0">
            <span className="min-w-0 flex-1 truncate text-sm text-foreground-primary">{it.title}</span>
            <span className="flex-none text-[11px] text-foreground-muted">{idLabel} {it.id}</span>
            <span className="flex-none text-[11px] text-foreground-secondary">{it.metric}</span>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'row') {
    return (
      <div className="flex h-full w-full flex-col gap-1 overflow-auto skin-card p-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-surface-hover">
            <ImgOrPlaceholder url={it.img} label={it.title} cls="h-10 w-10 flex-none" />
            <div className="min-w-0 flex-1 truncate text-sm text-foreground-primary">{it.title}</div>
            <span className="flex-none text-[11px] text-foreground-muted">{it.id}</span>
            <span className="flex-none text-[11px] text-foreground-secondary">{it.metric}</span>
          </div>
        ))}
      </div>
    );
  }

  // cards
  return (
    <div className="grid h-full w-full grid-cols-3 gap-2 overflow-auto skin-card p-2">
      {items.map((it, i) => (
        <div key={i} className="flex flex-col gap-1 rounded-lg border border-border-subtle p-2">
          <ImgOrPlaceholder url={it.img} label={it.title} cls="h-16 w-full" />
          <div className="line-clamp-1 text-xs font-medium text-foreground-primary">{it.title}</div>
          <div className="flex items-center justify-between text-[10px] text-foreground-secondary">
            <span>{it.id}</span>
            <span>{it.metric}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
