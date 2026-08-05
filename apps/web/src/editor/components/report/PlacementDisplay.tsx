/**
 * PlacementDisplay — 投放展示（≈PRD CMP-B15）。
 * 列顺序 [名称, 截图URL, 数据]。
 */
import type { PlacementData } from '@mediakit/shared';
import { ImgOrPlaceholder } from './shared';

export function PlacementDisplay({ data }: { data: PlacementData }) {
  const { variant = 'grid', highlights, learnings, rows = [] } = data;
  const items = rows.map((r) => ({ name: r[0] ?? '', img: r[1] ?? '', metric: r[2] ?? '' }));

  if (variant === 'single') {
    const it = items[0] ?? { name: '', img: '', metric: '' };
    return (
      <div className="flex h-full w-full skin-gap-md skin-card skin-pad-sm">
        <ImgOrPlaceholder url={it.img} label={it.name} cls="h-full w-1/2" />
        <div className="flex flex-1 flex-col justify-center">
          <div className="text-sm skin-fw-heading text-foreground-primary">{it.name}</div>
          <div className="mt-1 font-data text-lg font-bold text-primary">{it.metric}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col skin-gap-sm skin-card skin-pad-sm">
      <div className="grid flex-1 grid-cols-3 skin-gap-sm overflow-auto">
        {items.map((it, i) => (
          <div key={i} className="flex flex-col skin-gap-xs rounded-lg border border-border-subtle p-2">
            <ImgOrPlaceholder url={it.img} label={it.name} cls="h-16 w-full" />
            <div className="truncate text-xs skin-fw-body text-foreground-primary">{it.name}</div>
            <div className="text-[10px] text-foreground-secondary">{it.metric}</div>
          </div>
        ))}
      </div>
      {variant === 'with-text' && (highlights || learnings) && (
        <div className="grid flex-none grid-cols-2 skin-gap-sm border-t border-border-subtle pt-2">
          {highlights && (
            <div>
              <div className="text-[11px] skin-fw-heading text-primary">Highlights</div>
              <div className="text-[11px] text-foreground-secondary">{highlights}</div>
            </div>
          )}
          {learnings && (
            <div>
              <div className="text-[11px] skin-fw-heading text-foreground-primary">Learnings</div>
              <div className="text-[11px] text-foreground-secondary">{learnings}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
