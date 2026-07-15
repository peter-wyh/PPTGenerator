/**
 * StrategyBlockComponent — 策略块：default / labeled / bulleted。
 * 品牌色、高亮色、图标颜色全部取全局配色（--color-primary / --color-secondary）。
 */
import type { StrategyBlockData } from '@mediakit/shared';
import { findIcon } from '../../icons/catalog';
import { sanitizeRichText } from '../../richText';

export function StrategyBlockComponent({ data }: { data: StrategyBlockData }) {
  const { variant = 'default' } = data;
  if (variant === 'labeled') return <StrategyLabeled data={data} />;
  if (variant === 'bulleted') return <StrategyBulleted data={data} />;
  if (variant === 'cards') return <StrategyCards data={data} />;
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
              {Icon && <Icon size={16} className="text-primary" />}
              <span className="text-xs font-semibold uppercase tracking-wide text-foreground-primary">
                {title}
              </span>
            </div>
            <div
              className="text-sm leading-relaxed text-foreground-secondary [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:my-0.5 [&_b]:font-semibold [&_strong]:font-semibold [&_p]:mb-2.5 [&_p:last-child]:mb-0"
              dangerouslySetInnerHTML={{ __html: sanitizeRichText(content) }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** labeled（卡片标签）：大标题 + 主题色标签 + 块间发丝分隔。
 *  标题用品牌主色装饰条 + 大字，标签用品牌辅色。 */
function StrategyLabeled({ data }: { data: StrategyBlockData }) {
  const rows = data.rows ?? [];
  const title = data.title?.trim();
  return (
    <div className="flex h-full w-full flex-col skin-card skin-pad-md">
      {title && (
        <div className="mb-4 flex items-center gap-2.5">
          <span className="h-8 w-1.5 flex-none rounded-full bg-primary" />
          <span
            className="font-headings text-2xl font-extrabold leading-tight text-foreground-primary"
            style={{ letterSpacing: '-0.01em' }}
          >
            {title}
          </span>
        </div>
      )}
      <div className="flex flex-1 flex-col">
        {rows.map((r, i) => {
          const iconKey = r[0] ?? '';
          const rowTitle = r[1] ?? '';
          const content = r[2] ?? '';
          const Icon = findIcon(iconKey)?.Comp;
          return (
            <div key={i} className={`flex flex-col gap-1.5 ${i > 0 ? 'mt-4 border-t border-border-subtle pt-4' : ''}`}>
              <div className="flex items-center gap-1.5">
                {Icon && <Icon size={16} className="text-primary" />}
                <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                  {rowTitle}
                </span>
              </div>
              <div
                className="text-sm leading-relaxed text-foreground-secondary [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:my-0.5 [&_b]:font-semibold [&_strong]:font-semibold [&_p]:mb-2.5 [&_p:last-child]:mb-0"
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(content) }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** bulleted（卡片列表）：每行 = 一张独立卡片（图标+标题+正文），grid-cols-2 网格。 */
function StrategyBulleted({ data }: { data: StrategyBlockData }) {
  const rows = data.rows ?? [];
  if (rows.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center skin-card skin-pad-md text-xs text-foreground-muted">
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
          <div key={i} className="flex flex-col gap-1 skin-card skin-pad-sm">
            <div className="flex items-center gap-1.5">
              {Icon && <Icon size={16} className="text-primary" />}
              <span className="text-sm font-bold uppercase tracking-wide text-foreground-primary">{title}</span>
            </div>
            <div
              className="text-sm leading-relaxed text-foreground-secondary [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:my-0.5 [&_b]:font-semibold [&_strong]:font-semibold [&_p]:mb-2.5 [&_p:last-child]:mb-0"
              dangerouslySetInnerHTML={{ __html: sanitizeRichText(content) }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** cards（单列卡片堆叠）：每条 = 一张独立卡片，品牌色圆形徽章图标 + 大写标题 + 正文。对标参考图。 */
function StrategyCards({ data }: { data: StrategyBlockData }) {
  const rows = data.rows ?? [];
  if (rows.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center skin-card skin-pad-md text-xs text-foreground-muted">
        Strategy
      </div>
    );
  }
  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-auto">
      {rows.map((r, i) => {
        const iconKey = r[0] ?? '';
        const title = r[1] ?? '';
        const content = r[2] ?? '';
        const Icon = findIcon(iconKey)?.Comp;
        return (
          <div key={i} className="flex flex-1 items-start gap-2.5 rounded-lg bg-surface-secondary p-3">
            {Icon && (
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary">
                <Icon size={16} className="text-white" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold uppercase tracking-wider text-foreground-primary">{title}</div>
              <div
                className="mt-1 text-sm leading-relaxed text-foreground-secondary [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:my-0.5 [&_b]:font-semibold [&_strong]:font-semibold [&_p]:mb-2.5 [&_p:last-child]:mb-0"
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(content) }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}