/**
 * StrategyBlockComponent — 策略块：default / labeled / bulleted。
 */
import type { StrategyBlockData } from '@mediakit/shared';
import { findIcon } from '../../icons/catalog';
import { renderHtmlWithHighlights } from '../../richText';

export function StrategyBlockComponent({ data }: { data: StrategyBlockData }) {
  const { variant = 'default' } = data;
  if (variant === 'labeled') return <StrategyLabeled data={data} />;
  if (variant === 'bulleted') return <StrategyBulleted data={data} />;
  return <StrategyDefault data={data} />;
}

/** default：平铺，图标 + 深色大写标题 + 高亮正文。 */
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
              dangerouslySetInnerHTML={{ __html: renderHtmlWithHighlights(content, data.highlights) }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** labeled（参考#4）：卡片 + 主题色大写标签标题 + 高亮正文 + 块间发丝分隔。 */
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
              dangerouslySetInnerHTML={{ __html: renderHtmlWithHighlights(content, data.highlights) }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** bulleted（参考#5）：卡片 + 首行作小标题（图标+标题、下方分隔）+ 其余行 • 项目符号列表（两两成对，1 卡含 2 个策略块配置）。 */
function StrategyBulleted({ data }: { data: StrategyBlockData }) {
  const rows = data.rows ?? [];
  if (rows.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl border border-border-default bg-surface-primary p-4 shadow-sm text-xs text-foreground-muted">
        策略块
      </div>
    );
  }
  const [headerRow, ...bodyRows] = rows;
  const HeaderIcon = findIcon(headerRow[0] ?? '')?.Comp;
  const hTitle = headerRow[1] ?? '';
  return (
    <div className="flex h-full w-full flex-col rounded-xl border border-border-default bg-surface-primary p-4 shadow-sm">
      <div className="flex items-center gap-1.5">
        {HeaderIcon && <HeaderIcon size={16} className="text-secondary" />}
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground-primary">
          {hTitle}
        </span>
      </div>
      {bodyRows.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-0.5 border-t border-border-subtle pt-3">
          {bodyRows.map((r, i) => {
            const content = r[2] || r[1] || '';
            return (
              <div key={i} className="flex gap-2 py-0.5 text-sm text-foreground-secondary">
                <span className="flex-none text-secondary">•</span>
                <div
                  className="min-w-0 flex-1 [&_ul]:my-0.5 [&_ul]:list-disc [&_ul]:pl-4"
                  dangerouslySetInnerHTML={{ __html: renderHtmlWithHighlights(content, data.highlights) }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
