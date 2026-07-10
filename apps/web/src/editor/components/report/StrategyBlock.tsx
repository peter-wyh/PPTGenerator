/**
 * StrategyBlockComponent — 策略块：default / labeled / bulleted。
 */
import type { StrategyBlockData } from '@mediakit/shared';
import { findIcon } from '../../icons/catalog';
import { sanitizeRichText } from '../../richText';

export function StrategyBlockComponent({ data }: { data: StrategyBlockData }) {
  const { variant = 'default' } = data;
  if (variant === 'labeled') return <StrategyLabeled data={data} />;
  if (variant === 'bulleted') return <StrategyBulleted data={data} />;
  return <StrategyDefault data={data} />;
}

/** default：平铺，图标 + 深色大写标题 + 正文（<mark> 由全局 CSS 染色）。 */
function StrategyDefault({ data }: { data: StrategyBlockData }) {
  const rows = data.rows ?? [];
  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-auto">
      {rows.map((r, i) => {
        const iconKey = r[0] ?? '';
        const title = r[1] ?? '';
        const content = r[2] ?? '';
        const Icon = findIcon(iconKey)?.Comp;
        return (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              {Icon && <Icon size={16} className="text-secondary" />}
              <span className="text-xs font-semibold uppercase tracking-wide text-foreground-primary">
                {title}
              </span>
            </div>
            <div
              className="text-sm text-foreground-secondary [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:my-0.5 [&_b]:font-semibold [&_strong]:font-semibold"
              dangerouslySetInnerHTML={{ __html: sanitizeRichText(content) }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** labeled（参考#4）：卡片 + 主题色大写标签标题 + 正文 + 块间发丝分隔。 */
function StrategyLabeled({ data }: { data: StrategyBlockData }) {
  const rows = data.rows ?? [];
  return (
    <div className="flex h-full w-full flex-col rounded-xl border border-border-default bg-surface-primary p-4 shadow-sm">
      {rows.map((r, i) => {
        const iconKey = r[0] ?? '';
        const title = r[1] ?? '';
        const content = r[2] ?? '';
        const Icon = findIcon(iconKey)?.Comp;
        return (
          <div key={i} className={`flex flex-col gap-1 ${i > 0 ? 'mt-3 border-t border-border-subtle pt-3' : ''}`}>
            <div className="flex items-center gap-1.5">
              {Icon && <Icon size={16} className="text-secondary" />}
              <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
                {title}
              </span>
            </div>
            <div
              className="text-sm text-foreground-secondary [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:my-0.5 [&_b]:font-semibold [&_strong]:font-semibold"
              dangerouslySetInnerHTML={{ __html: sanitizeRichText(content) }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** bulleted（卡片列表）：每行 = 一张独立卡片（图标+标题+正文），grid-cols-2 网格。 */
function StrategyBulleted({ data }: { data: StrategyBlockData }) {
  const rows = data.rows ?? [];
  if (rows.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl border border-border-default bg-surface-primary p-4 shadow-sm text-xs text-foreground-muted">
        Strategy
      </div>
    );
  }
  return (
    <div className={`grid h-full w-full gap-3 overflow-auto ${rows.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
      {rows.map((r, i) => {
        const iconKey = r[0] ?? '';
        const title = r[1] ?? '';
        const content = r[2] ?? '';
        const Icon = findIcon(iconKey)?.Comp;
        return (
          <div key={i} className="flex flex-col gap-1 rounded-xl border border-border-default bg-surface-primary p-3 shadow-sm">
            <div className="flex items-center gap-1.5">
              {Icon && <Icon size={16} className="text-secondary" />}
              <span className="text-xs font-semibold uppercase tracking-wide text-foreground-primary">
                {title}
              </span>
            </div>
            <div
              className="text-sm text-foreground-secondary [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:my-0.5 [&_b]:font-semibold [&_strong]:font-semibold"
              dangerouslySetInnerHTML={{ __html: sanitizeRichText(content) }}
            />
          </div>
        );
      })}
    </div>
  );
}
