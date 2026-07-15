import type { SwotMatrixData, SwotQuadrant } from '@mediakit/shared';

/* 四象限位置 → 色调（用 CSS 变量，跟随全局品牌色） */
const QUADRANT_STYLES = [
  /* 左上 — Opportunities */
  { icon: '✦', bg: 'color-mix(in srgb, var(--green) 8%, transparent)', border: 'var(--green)', headerColor: 'var(--green)' },
  /* 右上 — Strengths */
  { icon: '◎', bg: 'color-mix(in srgb, var(--blue) 8%, transparent)', border: 'var(--blue)', headerColor: 'var(--blue)' },
  /* 左下 — Challenges */
  { icon: '⚡', bg: 'color-mix(in srgb, var(--red) 8%, transparent)', border: 'var(--red)', headerColor: 'var(--red)' },
  /* 右下 — Threats */
  { icon: '⚑', bg: 'color-mix(in srgb, var(--yellow) 8%, transparent)', border: 'var(--yellow)', headerColor: 'var(--yellow)' },
];

function QuadrantCard({ q, style }: { q: SwotQuadrant; style: (typeof QUADRANT_STYLES)[number] }) {
  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border p-3"
      style={{ backgroundColor: style.bg, borderColor: style.border }}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-sm" style={{ color: style.headerColor }}>{style.icon}</span>
        <span className="text-xs font-semibold" style={{ color: style.headerColor }}>{q.title}</span>
      </div>
      <div className="flex-1 overflow-auto">
        {q.items.length === 0 ? (
          <div className="text-[11px] text-foreground-muted">—</div>
        ) : (
          <ul className="space-y-1">
            {q.items.map((item, i) => (
              <li key={i} className="flex gap-1 text-[11px] leading-relaxed text-foreground-secondary">
                <span className="flex-none text-foreground-muted">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full w-full items-center justify-center text-xs text-foreground-muted">
      暂无数据
    </div>
  );
}

export function SwotMatrix({ data }: { data: SwotMatrixData }) {
  const { title, quadrants = [], variant = 'grid' } = data;
  const has = quadrants.length > 0 && quadrants.some((q) => q.items.length > 0);

  if (!has) {
    return (
      <div className="flex h-full w-full flex-col rounded-xl bg-surface-primary p-3">
        {title && <div className="mb-2 text-sm font-medium text-foreground-primary">{title}</div>}
        <EmptyState />
      </div>
    );
  }

  const styledQuads = quadrants.map((q, i) => ({
    q,
    style: QUADRANT_STYLES[i % 4],
  }));

  if (variant === 'list') {
    return (
      <div className="flex h-full w-full flex-col rounded-xl bg-surface-primary p-3">
        {title && <div className="mb-3 text-sm font-medium text-foreground-primary">{title}</div>}
        <div className="flex flex-1 flex-col gap-2 overflow-auto">
          {styledQuads.map(({ q, style }, i) => (
            <div key={i} className="rounded-lg border p-2.5" style={{ backgroundColor: style.bg, borderColor: style.border }}>
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-xs" style={{ color: style.headerColor }}>{style.icon}</span>
                <span className="text-xs font-semibold" style={{ color: style.headerColor }}>{q.title}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                {q.items.map((item, j) => (
                  <span key={j} className="text-[11px] text-foreground-secondary">{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div className="flex h-full w-full flex-col rounded-xl bg-surface-primary p-3">
        {title && <div className="mb-3 text-sm font-medium text-foreground-primary">{title}</div>}
        <div className="flex flex-1 flex-col gap-2 overflow-auto">
          {styledQuads.map(({ q, style }, i) => (
            <div key={i} className="rounded-lg border p-2.5" style={{ backgroundColor: style.bg, borderColor: style.border }}>
              <div className="mb-1.5 text-xs font-semibold" style={{ color: style.headerColor }}>
                {style.icon} {q.title}
              </div>
              <ul className="space-y-0.5">
                {q.items.map((item, j) => (
                  <li key={j} className="text-[11px] leading-relaxed text-foreground-secondary">· {item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* 默认 grid 布局：2×2 四象限 */
  return (
    <div className="flex h-full w-full flex-col rounded-xl bg-surface-primary p-3">
      {title && <div className="mb-3 text-sm font-medium text-foreground-primary">{title}</div>}
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2">
        {styledQuads.map(({ q, style }, i) => (
          <QuadrantCard key={i} q={q} style={style} />
        ))}
      </div>
    </div>
  );
}
