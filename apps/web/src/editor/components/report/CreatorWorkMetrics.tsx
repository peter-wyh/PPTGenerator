/**
 * CreatorWorkMetrics — 单达人作品数据指标（≈PRD CMP-B18）：grid / strip / card / detailed。
 */
import type { CreatorWorkMetricsData } from '@mediakit/shared';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ImgOrPlaceholder, CAMPAIGN_COLORS } from './shared';

export function CreatorWorkMetrics({ data }: { data: CreatorWorkMetricsData }) {
  const { variant = 'grid', title, subtitle, cover, workName, metrics = [] } = data;

  if (variant === 'strip') {
    return (
      <div className="flex h-full w-full flex-col gap-1.5 skin-card skin-pad-sm">
        {(title || subtitle) && (
          <div className="flex flex-none flex-col">
            {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
            {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
          </div>
        )}
        <div className="flex flex-1 flex-wrap items-stretch">
          {metrics.map((m, i) => (
            <div
              key={i}
              className={`flex flex-1 flex-col justify-center px-3 ${i > 0 ? 'border-l border-border-subtle' : ''}`}
            >
              <div className="text-[10px] text-foreground-muted">{m.label}</div>
              <div
                className="font-data text-lg font-bold"
                style={{ color: m.color ?? 'var(--color-foreground-primary, #1A1A1A)' }}
              >
                {m.value}
              </div>
              {m.sub && (
                <div className="text-[10px] font-medium" style={{ color: m.color ?? 'var(--green)' }}>{m.sub}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className="flex h-full w-full flex-col gap-2 skin-card skin-pad-sm">
        {(title || subtitle) && (
          <div className="flex flex-none flex-col">
            {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
            {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
          </div>
        )}
        <div className="flex flex-1 gap-3">
          {(cover || workName) && (
            <div className="flex flex-none flex-col items-center justify-center gap-1.5" style={{ width: 96 }}>
              <ImgOrPlaceholder url={cover ?? ''} label={workName ?? ''} cls="h-20 w-20" />
              {workName && (
                <div className="line-clamp-2 text-center text-[11px] font-medium text-foreground-primary">{workName}</div>
              )}
            </div>
          )}
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
            {metrics.map((m, i) => (
              <div key={i} className="flex flex-col justify-center">
                <div className="text-[10px] text-foreground-muted">{m.label}</div>
                <div
                  className="font-data text-base font-bold"
                  style={{ color: m.color ?? 'var(--color-foreground-primary, #1A1A1A)' }}
                >
                  {m.value}
                </div>
                {m.sub && (
                  <div className="text-[10px] font-medium" style={{ color: m.color ?? 'var(--green)' }}>{m.sub}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'detailed') {
    // 详细：每个指标卡片带彩色左边框强调。
    return (
      <div className="flex h-full w-full flex-col gap-1.5 skin-card skin-pad-sm">
        {(title || subtitle) && (
          <div className="flex flex-none flex-col">
            {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
            {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
          </div>
        )}
        <div className="grid flex-1 grid-cols-3 gap-2">
          {metrics.map((m, i) => {
            const color = m.color ?? CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length];
            return (
              <div
                key={i}
                className="flex flex-col justify-center rounded-lg bg-surface-secondary p-2.5"
                style={{ borderLeft: `3px solid ${color}` }}
              >
                <div className="text-[10px] text-foreground-muted">{m.label}</div>
                <div className="font-data text-lg font-bold" style={{ color }}>{m.value}</div>
                {m.sub && <div className="text-[10px] font-medium" style={{ color: m.sub.startsWith('-') ? 'var(--red)' : 'var(--green)' }}>{m.sub}</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (variant === 'audience') {
    // 受众画像：顶部作品信息 + 性别水平堆叠条 + 年龄段迷你条。
    const ins = data.audience;
    return (
      <div className="flex h-full w-full flex-col gap-2 skin-card skin-pad-sm">
        {(title || subtitle) && (
          <div className="flex flex-none flex-col">
            {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
            {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
          </div>
        )}
        {ins ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
            {/* 性别分布：水平堆叠条 */}
            {ins.genderSplit && ins.genderSplit.length > 0 && (
              <div className="flex flex-col gap-1">
                <div className="text-[10px] font-medium text-foreground-secondary">Gender Distribution</div>
                <div className="flex h-5 w-full overflow-hidden rounded-full bg-surface-hover">
                  {ins.genderSplit.map((g, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-center text-[10px] font-medium text-white"
                      style={{
                        width: `${Math.max(g.value, 4)}%`,
                        backgroundColor: g.color ?? (g.label.match(/^(f|female|女)/i) ? 'var(--purple)' : 'var(--blue)'),
                      }}
                    >
                      {g.value >= 12 ? `${g.label} ${g.value}%` : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* 年龄段：迷你水平占比条 */}
            {ins.ageRange && ins.ageRange.length > 0 && (
              <div className="flex flex-col gap-1">
                <div className="text-[10px] font-medium text-foreground-secondary">Age Distribution</div>
                {ins.ageRange.map((a, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="w-12 flex-none text-[10px] text-foreground-secondary">{a.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-hover">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, a.value)}%`, backgroundColor: a.color ?? 'auto' }}
                      />
                    </div>
                    <span className="w-8 flex-none text-right text-[10px] font-data text-foreground-primary">{a.value}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-[11px] text-foreground-muted">
            暂无画像数据
          </div>
        )}
      </div>
    );
  }

  if (variant === 'city') {
    // 城市分布：Top 城市水平进度条。
    const ins = data.audience;
    const cities = ins?.topCities ?? [];
    return (
      <div className="flex h-full w-full flex-col gap-2 skin-card skin-pad-sm">
        {(title || subtitle) && (
          <div className="flex flex-none flex-col">
            {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
            {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
          </div>
        )}
        {cities.length > 0 ? (
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 overflow-auto">
            {cities.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-16 flex-none truncate text-[11px] text-foreground-secondary">{c.label}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-hover">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, c.value)}%`, backgroundColor: c.color ?? CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length] }}
                  />
                </div>
                <span className="w-9 flex-none text-right text-[10px] font-data text-foreground-primary">{c.value}%</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-[11px] text-foreground-muted">
            No city data
          </div>
        )}
      </div>
    );
  }

  if (variant === 'trend') {
    // 趋势：mini 折线图（播放/互动等随时间）。
    const ins = data.audience;
    const trend = ins?.trend ?? [];
    const trendLabel = ins?.trendLabel ?? 'Data Trend';
    return (
      <div className="flex h-full w-full flex-col gap-2 skin-card skin-pad-sm">
        {(title || subtitle) && (
          <div className="flex flex-none flex-col">
            {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
            {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
          </div>
        )}
        {trend.length > 0 ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-1 text-[10px] text-foreground-muted">{trendLabel}</div>
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle, #F3F4F6)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 6 }}
                    labelStyle={{ fontSize: 11 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-[11px] text-foreground-muted">
            No trend data
          </div>
        )}
      </div>
    );
  }

  // grid（默认）：3 列指标网格，label 小号灰 / value 大号粗（按 color 染色）/ sub 小号绿红。
  return (
    <div className="flex h-full w-full flex-col gap-1.5 skin-card skin-pad-sm">
      {(title || subtitle) && (
        <div className="flex flex-none flex-col">
          {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
          {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
        </div>
      )}
      <div className="grid flex-1 grid-cols-3 gap-2">
        {metrics.map((m, i) => (
          <div key={i} className="flex flex-col justify-center">
            <div className="text-[10px] text-foreground-muted">{m.label}</div>
            <div
              className="font-data text-lg font-bold"
              style={{ color: m.color ?? 'var(--color-foreground-primary, #1A1A1A)' }}
            >
              {m.value}
            </div>
            {m.sub && (
              <div className="text-[10px] font-medium" style={{ color: m.sub.startsWith('-') ? 'var(--red)' : 'var(--green)' }}>
                {m.sub}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
