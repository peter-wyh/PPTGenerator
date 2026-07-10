/**
 * KpiBoard — 业绩看板（≈PRD CMP-B1）：KPI 矩阵。
 * 复用 TableData 形状（headers+rows），table 字段兼作对象列表编辑器。
 */
import type { KpiBoardData, KpiTrendDirection } from '@mediakit/shared';
import { findIcon } from '../../icons/catalog';
import { KPI_COLOR_TOKENS } from '../../kpiTokens';

/** 对比文本上色：positive=升绿/降红；inverse（CPA/CPC 等降为好）=降绿/升红。 */
function compareColor(compare: string, direction: KpiTrendDirection = 'positive'): string {
  if (!compare) return 'transparent';
  const isDown = compare.trim().startsWith('-');
  const good = direction === 'inverse' ? isDown : !isDown;
  return good ? '#22C55E' : '#EF4444';
}

export function KpiBoard({ data }: { data: KpiBoardData }) {
  const { variant = 'grid', rows = [] } = data;
  const hidden = new Set(data.hiddenIndices ?? []);
  const items = rows
    .map((r, i) => {
      const token = data.valueColors?.[i] ?? null;
      const color = token && token !== 'primary' ? KPI_COLOR_TOKENS[token].fg : undefined;
      const direction = data.trendDirections?.[i] ?? 'positive';
      return { label: r[0] ?? '', value: r[1] ?? '', compare: r[2] ?? '', color, direction };
    })
    .filter((_, i) => !hidden.has(i));

  const Card = ({
    label, value, compare, color, direction = 'positive',
  }: { label: string; value: string; compare: string; color?: string; direction?: KpiTrendDirection }) => (
    <div className="flex flex-col justify-center">
      <div className="text-[11px] text-foreground-secondary">{label}</div>
      <div
        className="font-data text-xl font-bold text-foreground-primary"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      {compare && (
        <div className="text-[11px] font-medium" style={{ color: compareColor(compare, direction) }}>
          {compare}
        </div>
      )}
    </div>
  );

  if (variant === 'compact') {
    return (
      <div className="flex h-full w-full flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-border-default bg-surface-primary p-3">
        {items.map((it, i) => (
          <div key={i} className="flex items-baseline gap-1.5">
            <span className="text-[11px] text-foreground-secondary">{it.label}</span>
            <span className="font-data text-base font-semibold text-foreground-primary">{it.value}</span>
            {it.compare && (
              <span className="text-[10px]" style={{ color: compareColor(it.compare, it.direction) }}>
                {it.compare}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'row') {
    return (
      <div className="flex h-full w-full items-stretch gap-2">
        {items.map((it, i) => (
          <div key={i} className="flex-1">
            <Card {...it} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'gradient') {
    // 渐变深色卡片：每个 KPI 用渐变背景 + 白色文字，2 列网格。
    return (
      <div className="grid h-full w-full grid-cols-2 gap-3 overflow-auto">
        {items.map((it, i) => {
          const token = data.valueColors?.[i] ?? 'primary';
          const c = KPI_COLOR_TOKENS[token];
          return (
            <div
              key={i}
              className="flex flex-col justify-center rounded-2xl p-5"
              style={{ background: `linear-gradient(135deg, ${c.fg}, ${c.fg}CC)`, color: '#fff' }}
            >
              <div className="text-xs text-white/70">{it.label}</div>
              <div className="font-data text-2xl font-bold text-white">{it.value}</div>
              {it.compare && (
                <div className="text-[11px] font-medium text-white/80">{it.compare}</div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (variant === 'minimal') {
    // 极简线框：无背景色，顶部 2px 颜色线 + label + 大数值，等宽排列。
    return (
      <div className="grid h-full w-full grid-cols-3 gap-2 overflow-auto">
        {items.map((it, i) => {
          const token = data.valueColors?.[i] ?? null;
          const color = token && token !== 'primary' ? KPI_COLOR_TOKENS[token].fg : '#9CA3AF';
          return (
            <div key={i} className="flex flex-col justify-center" style={{ borderTop: `2px solid ${color}` }}>
              <div className="mt-2 text-[11px] text-foreground-secondary">{it.label}</div>
              <div className="font-data text-xl font-bold text-foreground-primary">{it.value}</div>
              {it.compare && (
                <div className="text-[11px] font-medium" style={{ color: compareColor(it.compare, it.direction) }}>
                  {it.compare}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (variant === 'flat') {
    // 平铺指标条（参考图风格）：单行等宽卡 —— 标题 + 大数值（按类型染色）+ 环比 + 对比基准锚点。
    const compareLabel = data.compareLabel?.trim() ? data.compareLabel : 'vs 上期';
    return (
      <div className="flex h-full w-full items-stretch gap-2 overflow-auto">
        {items.map((it, i) => (
          <div
            key={i}
            className="flex flex-1 flex-col justify-center rounded-xl border border-border-subtle bg-surface-primary px-3.5 py-2.5"
          >
            <div className="text-[10px] uppercase tracking-wide text-foreground-muted">{it.label}</div>
            <div
              className="font-data text-2xl font-bold leading-tight"
              style={it.color ? { color: it.color } : undefined}
            >
              {it.value}
            </div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              {it.compare && (
                <span className="text-[11px] font-semibold" style={{ color: compareColor(it.compare, it.direction) }}>
                  {it.compare}
                </span>
              )}
              <span className="text-[10px] text-foreground-muted">{compareLabel}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div
        className="grid h-full w-full gap-3 overflow-auto p-1"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
      >
        {items.map((it, i) => {
          const token = data.valueColors?.[i] ?? null;
          const isPrimary = !token || token === 'primary';
          const c = KPI_COLOR_TOKENS[token ?? 'primary'];
          const Icon = findIcon(data.icons?.[i] ?? undefined)?.Comp;
          const weight = data.iconWeight ?? 'regular';
          return (
            <div
              key={i}
              className="flex items-center justify-between rounded-2xl bg-surface-primary p-5 shadow-sm"
            >
              <div className="flex flex-col gap-1">
                <div className="text-xs text-foreground-secondary">{it.label}</div>
                <div
                  className="font-data text-2xl font-bold text-foreground-primary"
                  style={isPrimary ? undefined : { color: c.fg }}
                >
                  {it.value}
                </div>
                {it.compare && (
                  <div className="text-xs font-medium" style={{ color: compareColor(it.compare, it.direction) }}>
                    {it.compare}
                  </div>
                )}
              </div>
              {Icon && (
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: c.softBg }}
                >
                  <Icon size={22} weight={weight} color={isPrimary ? undefined : c.fg} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // grid（默认 3 列）：指标格无 gap，彼此紧贴并贴区块边缘（默认尺寸不留 padding）。
  return (
    <div className="grid h-full w-full grid-cols-3 overflow-auto">
      {items.map((it, i) => (
        <Card key={i} {...it} />
      ))}
    </div>
  );
}
