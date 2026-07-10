/**
 * MetaStripComponent — 元信息条：inline / divider / list / cards / stat。
 */
import type { MetaStripData } from '@mediakit/shared';
import { findIcon } from '../../icons/catalog';

type MetaItem = { iconKey: string; label: string; text: string };

function MetaInline({ items }: { items: MetaItem[] }) {
  return (
    <div className="flex h-full w-full flex-wrap items-center gap-2 overflow-auto">
      {items.map((it, i) => {
        const Icon = findIcon(it.iconKey)?.Comp;
        return (
          <div key={i} className="flex items-center gap-1.5 rounded bg-surface-secondary px-2 py-1">
            {Icon && <Icon size={14} className="text-foreground-secondary" />}
            <span className="text-[11px] uppercase tracking-wide text-foreground-secondary">{it.label}</span>
            <span className="text-sm text-foreground-primary">{it.text}</span>
          </div>
        );
      })}
    </div>
  );
}

function MetaDivider({ items }: { items: MetaItem[] }) {
  return (
    <div className="flex h-full w-full flex-wrap items-center">
      {items.map((it, i) => {
        const Icon = findIcon(it.iconKey)?.Comp;
        return (
          <div
            key={i}
            className={`flex items-center gap-1.5 ${i === 0 ? 'pl-0' : 'border-l border-border-subtle pl-2'}`}
          >
            {Icon && <Icon size={13} className="text-foreground-secondary" />}
            <span className="text-[11px] uppercase tracking-wide text-foreground-muted">{it.label}</span>
            <span className="text-sm text-foreground-primary">{it.text}</span>
          </div>
        );
      })}
    </div>
  );
}

function MetaList({ items }: { items: MetaItem[] }) {
  return (
    <div className="flex h-full w-full flex-col divide-y divide-border-subtle">
      {items.map((it, i) => {
        const Icon = findIcon(it.iconKey)?.Comp;
        return (
          <div key={i} className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="flex items-center gap-1.5">
              {Icon && <Icon size={13} className="text-foreground-secondary" />}
              <span className="text-[11px] uppercase tracking-wide text-foreground-secondary">{it.label}</span>
            </span>
            <span className="text-right text-sm text-foreground-primary">{it.text}</span>
          </div>
        );
      })}
    </div>
  );
}

function MetaCards({ items }: { items: MetaItem[] }) {
  return (
    <div className="grid h-full w-full grid-cols-3 content-start gap-2 overflow-auto">
      {items.map((it, i) => {
        const Icon = findIcon(it.iconKey)?.Comp;
        return (
          <div key={i} className="flex flex-col gap-1 rounded-lg border border-border-subtle bg-surface-primary p-2">
            <span className="flex items-center gap-1.5">
              {Icon && <Icon size={14} className="text-foreground-secondary" />}
              <span className="text-[11px] uppercase tracking-wide text-foreground-secondary">{it.label}</span>
            </span>
            <span className="text-sm text-foreground-primary">{it.text}</span>
          </div>
        );
      })}
    </div>
  );
}

function MetaStat({ items }: { items: MetaItem[] }) {
  return (
    <div className="flex h-full w-full flex-wrap items-end gap-x-6 gap-y-2">
      {items.map((it, i) => {
        const Icon = findIcon(it.iconKey)?.Comp;
        return (
          <div key={i} className="flex flex-col">
            <span className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-foreground-secondary">
              {Icon && <Icon size={13} className="text-foreground-secondary" />}
              {it.label}
            </span>
            <span className="font-data text-xl font-bold text-foreground-primary">{it.text}</span>
          </div>
        );
      })}
    </div>
  );
}

export function MetaStripComponent({ data }: { data: MetaStripData }) {
  const { variant = 'inline', rows = [] } = data;
  const items: MetaItem[] = rows.map((r) => ({ iconKey: r[0] ?? '', label: r[1] ?? '', text: r[2] ?? '' }));
  if (variant === 'divider') return <MetaDivider items={items} />;
  if (variant === 'list') return <MetaList items={items} />;
  if (variant === 'cards') return <MetaCards items={items} />;
  if (variant === 'stat') return <MetaStat items={items} />;
  return <MetaInline items={items} />;
}
