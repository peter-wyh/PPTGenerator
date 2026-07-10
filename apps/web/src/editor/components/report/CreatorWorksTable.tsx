/**
 * CreatorWorksTable — 达人作品列表（≈PRD CMP-B19）：list / cards / compact。
 * 列顺序 [封面URL, 作品名, 播放, 点赞, 评论, 转发, 完播率]。
 */
import type { CreatorWorksTableData, WorkAudienceInsight } from '@mediakit/shared';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { ImgOrPlaceholder } from './shared';

export function CreatorWorksTable({ data }: { data: CreatorWorksTableData }) {
  const { variant = 'list', title, subtitle, headers = [], rows = [], insights } = data;
  const items = rows.map((r) => ({
    cover: r[0] ?? '',
    name: r[1] ?? '',
    play: r[2] ?? '',
    like: r[3] ?? '',
    comment: r[4] ?? '',
    share: r[5] ?? '',
    completion: r[6] ?? '',
  }));

  if (variant === 'compact') {
    // 纯文本紧凑行，无图片。
    return (
      <div className="flex h-full w-full flex-col gap-1 rounded-xl border border-border-default bg-surface-primary p-3">
        {(title || subtitle) && (
          <div className="flex flex-none flex-col">
            {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
            {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
          </div>
        )}
        <div className="flex flex-1 flex-col overflow-auto">
          <div className="flex border-b border-border-default pb-1 text-[10px] font-medium text-foreground-muted">
            <span className="min-w-0 flex-1 truncate">{headers[1] ?? '作品'}</span>
            <span className="w-14 flex-none text-right">{headers[2] ?? '播放'}</span>
            <span className="w-14 flex-none text-right">{headers[3] ?? '点赞'}</span>
            <span className="w-14 flex-none text-right">{headers[6] ?? '完播'}</span>
          </div>
          {items.map((it, i) => (
            <div key={i} className="flex items-center border-b border-border-subtle py-1 last:border-b-0">
              <span className="min-w-0 flex-1 truncate text-xs text-foreground-primary">{it.name}</span>
              <span className="w-14 flex-none text-right font-data text-xs text-foreground-secondary">{it.play}</span>
              <span className="w-14 flex-none text-right font-data text-xs text-foreground-secondary">{it.like}</span>
              <span className="w-14 flex-none text-right font-data text-xs text-foreground-secondary">{it.completion}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'cards') {
    // 横向卡片网格：每张卡含封面 + 作品名 + 关键指标。
    return (
      <div className="flex h-full w-full flex-col gap-1.5 rounded-xl border border-border-default bg-surface-primary p-3">
        {(title || subtitle) && (
          <div className="flex flex-none flex-col">
            {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
            {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
          </div>
        )}
        <div className="grid flex-1 grid-cols-2 gap-2 overflow-auto">
          {items.map((it, i) => (
            <div key={i} className="flex flex-col gap-1 rounded-lg border border-border-subtle p-2">
              <ImgOrPlaceholder url={it.cover} label={it.name} cls="h-14 w-full" />
              <div className="line-clamp-1 text-xs font-medium text-foreground-primary">{it.name}</div>
              <div className="flex justify-between text-[10px] text-foreground-secondary">
                <span>{headers[2] ?? '播放'} {it.play}</span>
                <span>{headers[3] ?? '点赞'} {it.like}</span>
              </div>
              <div className="flex justify-between text-[10px] text-foreground-muted">
                <span>{it.comment} 评论</span>
                <span>{it.completion}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'insight') {
    // 列表 + 每行展开受众画像（性别条 + Top3 城市 + 趋势 sparkline）。
    const numHeaders = headers.slice(2);
    return (
      <div className="flex h-full w-full flex-col gap-1 rounded-xl border border-border-default bg-surface-primary p-3">
        {(title || subtitle) && (
          <div className="flex flex-none flex-col">
            {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
            {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
          </div>
        )}
        <div className="flex flex-1 flex-col gap-1 overflow-auto">
          <div className="flex items-center gap-2 border-b border-border-default pb-1.5">
            <span className="w-10 flex-none" />
            <span className="min-w-0 flex-1 text-[10px] font-medium uppercase tracking-wide text-foreground-muted">
              {headers[1] ?? '作品'}
            </span>
            {numHeaders.map((h, i) => (
              <span key={i} className="w-14 flex-none text-right text-[10px] font-medium uppercase tracking-wide text-foreground-muted">
                {h}
              </span>
            ))}
          </div>
          {items.map((it, i) => {
            const ins: WorkAudienceInsight | undefined = insights?.[i];
            const hasInsight = ins && (ins.topCities?.length || ins.genderSplit?.length || ins.trend?.length);
            return (
              <div key={i} className="rounded-lg border border-border-subtle p-1.5">
                {/* 主行：封面 + 作品名 + 数字列 */}
                <div className="flex items-center gap-2">
                  <ImgOrPlaceholder url={it.cover} label={it.name} cls="h-9 w-9 flex-none" />
                  <div className="min-w-0 flex-1 truncate text-xs font-medium text-foreground-primary">{it.name}</div>
                  <span className="w-14 flex-none text-right font-data text-xs font-semibold text-foreground-primary">{it.play}</span>
                  <span className="w-14 flex-none text-right font-data text-xs text-foreground-secondary">{it.like}</span>
                  <span className="w-14 flex-none text-right font-data text-xs text-foreground-secondary">{it.completion}</span>
                </div>
                {/* 展开行：性别条 + Top3 城市 + sparkline */}
                {hasInsight && (
                  <div className="mt-1.5 grid grid-cols-3 gap-2 border-t border-border-subtle pt-1.5">
                    {/* 性别 */}
                    {ins.genderSplit && ins.genderSplit.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <div className="text-[9px] text-foreground-muted">性别</div>
                        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-hover">
                          {ins.genderSplit.map((g, gi) => (
                            <div
                              key={gi}
                              style={{
                                width: `${Math.max(g.value, 4)}%`,
                                backgroundColor: g.color ?? (g.label.includes('女') ? '#EC4899' : '#3B82F6'),
                              }}
                            />
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-x-2 text-[9px] text-foreground-secondary">
                          {ins.genderSplit.map((g, gi) => (
                            <span key={gi}>{g.label} {g.value}%</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Top3 城市 */}
                    {ins.topCities && ins.topCities.length > 0 && (
                      <div className="flex flex-col gap-0.5">
                        <div className="text-[9px] text-foreground-muted">城市 Top</div>
                        {ins.topCities.slice(0, 3).map((c, ci) => (
                          <div key={ci} className="flex items-center gap-1">
                            <span className="w-10 flex-none truncate text-[9px] text-foreground-secondary">{c.label}</span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${Math.min(100, c.value)}%`, backgroundColor: c.color ?? '#FF5C00' }}
                              />
                            </div>
                            <span className="w-6 flex-none text-right text-[9px] font-data text-foreground-primary">{c.value}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Sparkline 趋势 */}
                    {ins.trend && ins.trend.length > 1 && (
                      <div className="flex flex-col gap-0.5">
                        <div className="text-[9px] text-foreground-muted">{ins.trendLabel ?? '趋势'}</div>
                        <div className="h-8">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={ins.trend} margin={{ top: 1, right: 1, bottom: 1, left: 1 }}>
                              <Line
                                type="monotone"
                                dataKey="value"
                                stroke="var(--color-primary, #FF5C00)"
                                strokeWidth={1.5}
                                dot={false}
                              />
                              <Tooltip
                                contentStyle={{ fontSize: 9, padding: '2px 4px', borderRadius: 4 }}
                                labelStyle={{ fontSize: 9 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // list（默认）：表头 + 行，含封面缩略图，数字列右对齐。
  const numHeaders = headers.slice(2);
  return (
    <div className="flex h-full w-full flex-col gap-1 rounded-xl border border-border-default bg-surface-primary p-3">
      {(title || subtitle) && (
        <div className="flex flex-none flex-col">
          {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
          {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
        </div>
      )}
      <div className="flex flex-1 flex-col overflow-auto">
        <div className="flex items-center gap-2 border-b border-border-default pb-1.5">
          <span className="w-10 flex-none" />
          <span className="min-w-0 flex-1 text-[10px] font-medium uppercase tracking-wide text-foreground-muted">
            {headers[1] ?? '作品'}
          </span>
          {numHeaders.map((h, i) => (
            <span key={i} className="w-14 flex-none text-right text-[10px] font-medium uppercase tracking-wide text-foreground-muted">
              {h}
            </span>
          ))}
        </div>
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2 border-b border-border-subtle py-1.5 last:border-b-0">
            <ImgOrPlaceholder url={it.cover} label={it.name} cls="h-10 w-10 flex-none" />
            <div className="min-w-0 flex-1 truncate text-xs text-foreground-primary">{it.name}</div>
            <span className="w-14 flex-none text-right font-data text-xs font-semibold text-foreground-primary">{it.play}</span>
            <span className="w-14 flex-none text-right font-data text-xs text-foreground-secondary">{it.like}</span>
            <span className="w-14 flex-none text-right font-data text-xs text-foreground-secondary">{it.comment}</span>
            <span className="w-14 flex-none text-right font-data text-xs text-foreground-secondary">{it.share}</span>
            <span className="w-14 flex-none text-right font-data text-xs text-foreground-secondary">{it.completion}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
