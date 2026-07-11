/**
 * 业务组件（试点：公司/报价域）渲染器。
 *
 * 从原整页版式拆出的页内可复用语义块，与 CreatorComponents 同级。
 * 每个组件提供多个样式变体（data.variant）。table 字段兼作"对象列表编辑器"
 *（headers+rows，每行一个条目）。
 */
import type { BrandWallData, PackageCardData } from '@mediakit/shared';

/* -------------------------------- brand wall ------------------------------- */

export function BrandWall({ data }: { data: BrandWallData }) {
  const { variant = 'grid', rows = [] } = data;
  const logos = rows.map((r) => ({ name: r[0] ?? '', src: r[1] ?? '' }));

  const Tile = ({ name, src }: { name: string; src: string }) => (
    <div className="flex flex-col items-center justify-center gap-1 skin-card-flat px-2 py-3">
      {src ? (
        <img src={src} alt={name} className="h-8 max-w-[80%] object-contain" draggable={false} />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-sm font-semibold text-primary">
          {name?.slice(0, 1) || '?'}
        </div>
      )}
      <span className="max-w-full truncate text-[10px] text-foreground-secondary">{name}</span>
    </div>
  );

  if (variant === 'row') {
    return (
      <div className="flex h-full w-full items-center gap-2 overflow-auto skin-card skin-pad-sm">
        {logos.map((l, i) => (
          <div key={i} className="w-[120px] flex-none">
            <Tile {...l} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'marquee') {
    // 紧凑横排：仅 logo，无外框，适合页眉条带。
    return (
      <div className="flex h-full w-full flex-wrap items-center gap-x-5 gap-y-2 skin-card skin-pad-sm">
        {logos.map((l, i) =>
          l.src ? (
            <img key={i} src={l.src} alt={l.name} className="h-7 object-contain" draggable={false} />
          ) : (
            <span key={i} className="text-sm font-semibold text-foreground-secondary">
              {l.name}
            </span>
          ),
        )}
      </div>
    );
  }

  if (variant === 'circle') {
    // 圆形头像式：Logo 以圆形(56px)展示，名称在下方，网格排列 4-6 列。
    return (
      <div
        className="grid h-full w-full gap-3 overflow-auto skin-card skin-pad-sm"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}
      >
        {logos.map((l, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            {l.src ? (
              <img src={l.src} alt={l.name} className="h-14 w-14 rounded-full object-cover" draggable={false} />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                {l.name?.slice(0, 1) || '?'}
              </div>
            )}
            <span className="max-w-full truncate text-[10px] text-foreground-secondary">{l.name}</span>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'fade') {
    // 渐入：单行横排，第一个 opacity 100%，之后每项递减 5%。
    return (
      <div className="flex h-full w-full items-center justify-start gap-5 overflow-auto skin-card skin-pad-sm">
        {logos.map((l, i) => (
          <div key={i} className="flex w-[110px] flex-none flex-col items-center gap-1" style={{ opacity: Math.max(0.3, 1 - i * 0.05) }}>
            {l.src ? (
              <img src={l.src} alt={l.name} className="h-9 max-w-[80%] object-contain" draggable={false} />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded bg-primary/10 text-sm font-semibold text-primary">
                {l.name?.slice(0, 1) || '?'}
              </div>
            )}
            <span className="max-w-full truncate text-[10px] text-foreground-secondary">{l.name}</span>
          </div>
        ))}
      </div>
    );
  }

  // grid（默认）
  return (
    <div className="grid h-full w-full grid-cols-3 gap-2 overflow-auto skin-card skin-pad-sm">
      {logos.map((l, i) => (
        <Tile key={i} {...l} />
      ))}
    </div>
  );
}

/* ------------------------------- package card ------------------------------ */

export function PackageCard({ data }: { data: PackageCardData }) {
  const { variant = 'standard', name, price, rows = [], highlighted } = data;
  const features = rows.map((r) => r[0] ?? '');

  const wrap =
    variant === 'compact'
      ? 'skin-card skin-pad-sm ' +
        (highlighted ? 'border-primary ring-1 ring-primary/40' : '')
      : 'flex h-full w-full flex-col skin-card skin-pad-md ' +
        (highlighted ? 'border-primary ring-1 ring-primary/40' : '');

  if (variant === 'compact') {
    return (
      <div className={wrap}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold text-foreground-primary">{name}</span>
          <span className="flex-none font-data text-sm font-semibold text-primary">{price}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-foreground-secondary">
          {features.map((f, i) => (
            <span key={i}>{f}</span>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'table') {
    // 表格行风格：单行展示 套餐名 | 价格 | 特性列表(逗号分隔)，无卡片边框。
    return (
      <div className="flex h-full w-full items-center gap-3 px-3">
        <span className="w-28 flex-none truncate text-sm font-semibold text-foreground-primary">{name}</span>
        <span className="w-20 flex-none font-data text-sm font-semibold text-primary">{price}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-foreground-secondary">
          {features.filter(Boolean).join('、')}
        </span>
      </div>
    );
  }

  // standard / featured：标准卡片版式
  return (
    <div className={wrap}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground-primary">{name}</span>
        {highlighted && (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">推荐</span>
        )}
      </div>
      <div className="mt-1 font-data text-2xl font-bold text-primary">{price}</div>
      <ul className="mt-3 flex-1 space-y-1.5 text-xs text-foreground-secondary">
        {features.map((f, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="text-primary">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
