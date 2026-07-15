/**
 * 业务组件（试点：达人领域）渲染器。
 *
 * 三层组件模型校准：这三个是"页内可复用、绑定达人领域实体"的真业务组件，
 * 与 BasicComponents 同级（一级 ComponentType），由 REGISTRY 分发。
 * 每个组件提供多个样式变体（data.variant），对应 PRD 组件三层定义中的
 * "样式变体（选版式）"。风格对齐 BasicComponents.tsx；占位态参考 ImageComponent。
 */
import { useEffect, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useChartStyle } from '../theme';
import { useChartColors } from './report/shared';

/** 解析数据项颜色：'auto' 或空值 → 从全局 chartPalette 按索引取色（与 BasicComponents 一致）。 */
function resolveColor(color: string | undefined, index: number, palette: string[]): string {
  if (!color || color === 'auto') return palette[index % palette.length];
  return color;
}
import type {
  CreatorAvatarCardData,
  CreatorFanAgeData,
  CreatorFanCityData,
  CreatorFanGenderData,
  CreatorFanInterestData,
  CreatorListData,
  CreatorPlatform,
  CreatorStatsStripData,
  CreatorTier,
  CreatorWorksListData,
  WorkAudienceInsight,
} from '@mediakit/shared';

const PLATFORM_LABEL: Record<CreatorPlatform, string> = {
  xiaohongshu: 'Xiaohongshu',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  weibo: 'Weibo',
};

const TIER_LABEL: Record<CreatorTier, string> = {
  mega: 'Mega',
  macro: 'Macro',
  micro: 'Micro',
};

/* --------------------------- creator avatar card -------------------------- */

export function CreatorAvatarCard({ data }: { data: CreatorAvatarCardData }) {
  const { variant = 'horizontal' } = data;
  if (variant === 'vertical') return <AvatarVertical data={data} />;
  if (variant === 'compact') return <AvatarCompact data={data} />;
  if (variant === 'badge') return <AvatarBadge data={data} />;
  if (variant === 'banner') return <AvatarBanner data={data} />;
  if (variant === 'glass') return <AvatarGlass data={data} />;
  if (variant === 'hero') return <AvatarHero data={data} />;
  if (variant === 'minimal') return <AvatarMinimal data={data} />;
  return <AvatarHorizontal data={data} />;
}

function Avatar({ data, size }: { data: CreatorAvatarCardData; size: number }) {
  if (data.avatar) {
    return (
      <img
        src={data.avatar}
        alt={data.name}
        style={{ width: size, height: size }}
        className="flex-none rounded-full object-cover"
        draggable={false}
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className="flex flex-none items-center justify-center rounded-full bg-primary/10 text-primary"
    >
      {data.name?.slice(0, 1) || '?'}
    </div>
  );
}

/** Followers / Likes / Engagement Rate KPI 单行；无任何字段时不渲染。 */
function StatsLine({ data }: { data: CreatorAvatarCardData }) {
  const parts: string[] = [];
  if (data.followers) parts.push(`Followers ${data.followers}`);
  if (data.likes) parts.push(`Likes ${data.likes}`);
  if (data.engagement) parts.push(`Engagement Rate ${data.engagement}`);
  if (parts.length === 0) return null;
  return <div className="mt-1 text-[11px] text-foreground-secondary">{parts.join(' · ')}</div>;
}

/* ---- 平台多标识：把 platform + platforms 合并为去重列表 ---- */
function resolvePlatforms(data: CreatorAvatarCardData): CreatorPlatform[] {
  const extra: CreatorPlatform[] = [];
  const raw: unknown = data.platforms;
  if (Array.isArray(raw)) {
    for (const p of raw) extra.push(p as CreatorPlatform);
  } else if (typeof raw === 'string' && raw.trim()) {
    // 文本输入兼容："tiktok, instagram" → ['tiktok','instagram']
    for (const part of raw.split(',')) {
      const p = part.trim().toLowerCase();
      if (p) extra.push(p as CreatorPlatform);
    }
  }
  const all = [...new Set([data.platform, ...extra])];
  return all.filter(Boolean);
}

/** 平台短标签（用于 badge-style 横排）。 */
function PlatformBadges({ data, className }: { data: CreatorAvatarCardData; className?: string }) {
  const platforms = resolvePlatforms(data);
  return (
    <>
      {platforms.map((p) => (
        <span key={p} className={`flex-none rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-secondary ${className ?? ''}`}>
          {PLATFORM_LABEL[p] ?? p}
        </span>
      ))}
    </>
  );
}

/** 平台小圆点行（用于 vertical / banner 等居中布局）。 */
function PlatformDots({ data }: { data: CreatorAvatarCardData }) {
  const platforms = resolvePlatforms(data);
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {platforms.map((p) => (
        <span key={p} className="rounded-full bg-surface-hover px-2 py-0.5 text-[10px] text-foreground-secondary">
          {PLATFORM_LABEL[p] ?? p}
        </span>
      ))}
    </div>
  );
}

/** glass：毛玻璃风格 — 品牌主色渐变底 + 半透明卡片层 + 大头像 + 多平台标签。 */
function AvatarGlass({ data }: { data: CreatorAvatarCardData }) {
  return (
    <div
      className="flex h-full w-full items-center gap-3 rounded-2xl p-3"
      style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
    >
      <Avatar data={data} size={72} />
      <div className="min-w-0 flex-1 text-white">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{data.name}</span>
          <span className="flex-none rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
            {TIER_LABEL[data.tier] ?? data.tier}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          <PlatformBadges data={data} className="bg-white/20 !text-white" />
        </div>
        {data.intro && <div className="mt-1 line-clamp-2 text-xs text-white/80">{data.intro}</div>}
      </div>
    </div>
  );
}

/** hero：大卡片风格 — 顶部品牌色渐变 banner + 头像叠层 + 名字/平台/tier/统计。 */
function AvatarHero({ data }: { data: CreatorAvatarCardData }) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden skin-card-lg">
      <div
        className="h-16 w-full"
        style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
      />
      <div className="-mt-10 flex flex-col items-center gap-1 px-4 pb-3 text-center">
        <Avatar data={data} size={80} />
        <div className="mt-1 flex items-center gap-2">
          <span className="font-headings text-base font-bold text-foreground-primary">{data.name}</span>
          <span
            className="flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {TIER_LABEL[data.tier] ?? data.tier}
          </span>
        </div>
        <PlatformDots data={data} />
        <StatsLine data={data} />
      </div>
    </div>
  );
}

/** minimal：极简风格 — 无边框无背景，品牌色细线分隔 + 头像 + 名字 + 平台点阵。 */
function AvatarMinimal({ data }: { data: CreatorAvatarCardData }) {
  const platforms = resolvePlatforms(data);
  return (
    <div className="flex h-full w-full items-center gap-3">
      <div className="flex-none" style={{ borderTop: '2px solid var(--color-primary)' }}>
        <Avatar data={data} size={56} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-headings text-base font-bold text-foreground-primary">{data.name}</div>
        <div className="mt-0.5 text-[11px] font-medium" style={{ color: 'var(--color-primary)' }}>
          {TIER_LABEL[data.tier] ?? data.tier}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {platforms.map((p) => (
            <span key={p} className="rounded-full border border-border-subtle px-2 py-0.5 text-[10px] text-foreground-secondary">
              {PLATFORM_LABEL[p] ?? p}
            </span>
          ))}
        </div>
        <StatsLine data={data} />
      </div>
    </div>
  );
}

/** horizontal：横排 — 头像 + 名称 + 多平台标签。 */
function AvatarHorizontal({ data }: { data: CreatorAvatarCardData }) {
  return (
    <div className="flex h-full w-full items-center gap-3 skin-card skin-pad-sm">
      <Avatar data={data} size={72} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-foreground-primary">{data.name}</span>
          <span className="flex-none rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            {TIER_LABEL[data.tier] ?? data.tier}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-1">
          <PlatformBadges data={data} />
        </div>
        {data.intro && <div className="mt-1 line-clamp-2 text-xs text-foreground-secondary">{data.intro}</div>}
        <StatsLine data={data} />
      </div>
    </div>
  );
}

function AvatarVertical({ data }: { data: CreatorAvatarCardData }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 skin-card skin-pad-sm text-center">
      <Avatar data={data} size={80} />
      <div className="flex items-center gap-2">
        <span className="truncate font-semibold text-foreground-primary">{data.name}</span>
        <span className="flex-none rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
          {TIER_LABEL[data.tier] ?? data.tier}
        </span>
      </div>
      <PlatformDots data={data} />
      {data.intro && <div className="line-clamp-2 text-xs text-foreground-secondary">{data.intro}</div>}
      <StatsLine data={data} />
    </div>
  );
}

function AvatarCompact({ data }: { data: CreatorAvatarCardData }) {
  const platforms = resolvePlatforms(data);
  return (
    <div className="flex h-full w-full items-center gap-2 skin-card px-3">
      <Avatar data={data} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground-primary">{data.name}</span>
          <span className="truncate text-[11px] font-medium text-primary">{TIER_LABEL[data.tier] ?? data.tier}</span>
        </div>
        <div className="truncate text-[11px] text-foreground-secondary">
          {platforms.map((p) => PLATFORM_LABEL[p] ?? p).join(' · ')}
        </div>
      </div>
    </div>
  );
}

/** badge：圆角胶囊式 — 头像(40px) + 名称 + 平台徽章横排，背景渐变 + 圆角胶囊边框。 */
function AvatarBadge({ data }: { data: CreatorAvatarCardData }) {
  const platforms = resolvePlatforms(data);
  return (
    <div
      className="flex h-full w-full items-center gap-2 rounded-full border border-border-default px-2"
      style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 12%, transparent), transparent)' }}
    >
      <Avatar data={data} size={40} />
      <span className="truncate text-sm font-semibold text-foreground-primary">{data.name}</span>
      <div className="flex flex-none gap-1">
        {platforms.map((p) => (
          <span key={p} className="rounded-full bg-surface-hover px-2 py-0.5 text-[10px] text-foreground-secondary">
            {PLATFORM_LABEL[p] ?? p}
          </span>
        ))}
      </div>
    </div>
  );
}

/** banner：横幅式 — 顶部全宽背景色条 + 头像(64px, 负 margin 叠在 banner 上) + 名称 + 平台 + tier + StatsLine。 */
function AvatarBanner({ data }: { data: CreatorAvatarCardData }) {
  return (
    <div className="flex h-full w-full flex-col skin-card pb-3">
      {/* 顶部全宽背景色条 */}
      <div className="h-6 w-full rounded-t-xl" style={{ background: 'color-mix(in srgb, var(--color-primary) 16%, transparent)' }} />
      <div className="-mt-8 flex flex-col items-center gap-1 px-3 text-center">
        <Avatar data={data} size={64} />
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-foreground-primary">{data.name}</span>
          <span className="flex-none rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            {TIER_LABEL[data.tier] ?? data.tier}
          </span>
        </div>
        <PlatformDots data={data} />
        <StatsLine data={data} />
      </div>
    </div>
  );
}

/* ---------------------------- creator stats strip -------------------------- */

export function CreatorStatsStrip({ data }: { data: CreatorStatsStripData }) {
  const { variant = 'cards', stats = [] } = data;
  // selected 缺省视为 true（向后兼容）；selected:false 不渲染。
  const visible = stats.filter((s) => s.selected !== false);
  if (variant === 'plain') return <StatsPlain stats={visible} />;
  if (variant === 'metric') return <StatsMetric stats={visible} />;
  if (variant === 'progress') return <StatsProgress stats={visible} />;
  if (variant === 'ring') return <StatsRing stats={visible} />;
  if (variant === 'gradient') return <StatsGradient stats={visible} />;
  return <StatsCards stats={visible} />;
}

function StatsCards({ stats }: { stats: CreatorStatsStripData['stats'] }) {
  const palette = useChartColors();
  return (
    <div className="flex h-full w-full items-stretch gap-2 skin-card p-2">
      {stats.map((s, i) => {
        const color = resolveColor(s.color, i, palette);
        return (
          <div
            key={i}
            className="flex flex-1 flex-col justify-center rounded-lg px-3 py-1"
            style={{ backgroundColor: `${color}14` }}
          >
            <div className="text-[11px] text-foreground-secondary">{s.label}</div>
            <div className="font-data text-lg font-semibold" style={{ color }}>
              {s.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatsPlain({ stats }: { stats: CreatorStatsStripData['stats'] }) {
  return (
    <div className="flex h-full w-full items-center divide-x divide-border-subtle skin-card px-2">
      {stats.map((s, i) => (
        <div key={i} className="flex flex-1 flex-col justify-center px-3">
          <div className="text-[11px] text-foreground-secondary">{s.label}</div>
          <div className="font-data text-base font-semibold text-foreground-primary">{s.value}</div>
        </div>
      ))}
    </div>
  );
}

function StatsMetric({ stats }: { stats: CreatorStatsStripData['stats'] }) {
  const palette = useChartColors();
  return (
    <div className="flex h-full w-full items-stretch gap-3 skin-card skin-pad-sm">
      {stats.map((s, i) => {
        const color = resolveColor(s.color, i, palette);
        return (
          <div key={i} className="flex flex-1 flex-col justify-center" style={{ borderBottom: `2px solid ${color}` }}>
            <div className="font-data text-2xl font-bold" style={{ color }}>
              {s.value}
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide text-foreground-secondary">{s.label}</div>
          </div>
        );
      })}
    </div>
  );
}

/** 从 value 字段解析数字百分比："85%" → 85，"12.3K" → 12.3；无数字时默认 50。 */
function parsePercent(value: string): number {
  const m = value.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 50;
}

/** progress：每个指标用横向进度条展示 — label(上方) + value(右侧) + 进度条(底部)。 */
function StatsProgress({ stats }: { stats: CreatorStatsStripData['stats'] }) {
  const palette = useChartColors();
  return (
    <div className="flex h-full w-full flex-col justify-center gap-3 skin-card skin-pad-sm">
      {stats.map((s, i) => {
        const pct = Math.min(100, Math.max(0, parsePercent(s.value)));
        const color = resolveColor(s.color, i, palette);
        return (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-foreground-secondary">{s.label}</span>
              <span className="font-data text-sm font-semibold" style={{ color }}>
                {s.value}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** ring：用 recharts 环形进度图（innerRadius 60% outerRadius 90%），每个指标一个 mini ring(48px) + label + value 横排。 */
function StatsRing({ stats }: { stats: CreatorStatsStripData['stats'] }) {
  const palette = useChartColors();
  return (
    <div className="flex h-full w-full flex-wrap items-center gap-4 skin-card skin-pad-sm">
      {stats.map((s, i) => {
        const pct = Math.min(100, Math.max(0, parsePercent(s.value)));
        const color = resolveColor(s.color, i, palette);
        const ringData = [
          { name: 'value', value: pct },
          { name: 'rest', value: 100 - pct },
        ];
        return (
          <div key={i} className="flex items-center gap-2">
            <div className="relative h-12 w-12">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={ringData} dataKey="value" cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" startAngle={90} endAngle={-270}>
                    <Cell key="value" fill={color} />
                    <Cell key="rest" fill="var(--color-surface-hover, #F3F4F6)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-data font-semibold text-foreground-primary">
                {Math.round(pct)}%
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-foreground-secondary">{s.label}</span>
              <span className="font-data text-sm font-semibold" style={{ color }}>
                {s.value}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ stats: gradient ----------------------------- */

/**
 * gradient：品牌主色渐变实底色条 — 白字 + 白色细分割线 + 指标图标。
 * 每列纵向排列：图标(上) → 小号标签(中) → 大号数值(下)；列间用 divide-x 白色细线分隔。
 * 背景取主题 primary→secondary 渐变（与 AvatarGlass 同源），粉色主题下即还原参考稿观感。
 */
function StatsGradient({ stats }: { stats: CreatorStatsStripData['stats'] }) {
  return (
    <div
      className="flex h-full w-full items-stretch overflow-hidden rounded-2xl divide-x divide-white/35"
      style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
    >
      {stats.map((s, i) => (
        <div key={i} className="flex flex-1 flex-col items-center justify-center gap-1.5 px-4 py-3 text-center">
          <MetricIcon keyName={s.key} className="h-[18px] w-[18px] flex-none text-white/90" />
          <div className="text-[11px] font-medium uppercase leading-tight tracking-wide text-white/80">{s.label}</div>
          <div className="font-data text-2xl font-bold leading-none text-white">{s.value}</div>
        </div>
      ))}
    </div>
  );
}

/** 指标图标 SVG 属性：stroke 跟随 currentColor，统一描边粗细与圆角端点。 */
const METRIC_ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/**
 * 达人指标图标：按 metric key 选择语义图标；未知 key 回退到通用 activity 图标。
 * 与 CREATOR_METRIC_CATALOG 的 key 对齐（followers/engagement/reach/impressions/cpm/cpe/completion/growth）。
 */
function MetricIcon({ keyName, className }: { keyName?: string; className?: string }) {
  const props = { ...METRIC_ICON_PROPS, className };
  switch (keyName) {
    case 'followers':
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v-2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'engagement':
      return (
        <svg {...props}>
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
        </svg>
      );
    case 'reach':
      return (
        <svg {...props}>
          <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
          <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
          <circle cx="12" cy="12" r="2" />
          <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
          <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1" />
        </svg>
      );
    case 'impressions':
      return (
        <svg {...props}>
          <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'cpm':
    case 'cpe':
      return (
        <svg {...props}>
          <line x1="12" x2="12" y1="2" y2="22" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    case 'completion':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    case 'growth':
      return (
        <svg {...props}>
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      );
  }
}

/* ---------------------------- creator works list -------------------------- */

/**
 * 作品列表：复用 TableData 形状。约定列顺序
 * [封面URL, 标题, 转, 赞, 评]；列0 为图片 URL，列2-4 为互动数据。
 */
export function CreatorWorksList({ data }: { data: CreatorWorksListData }) {
  const { variant = 'cards', headers = [], rows = [], insights = [] } = data;
  const metricLabels = headers.slice(2, 5);
  const items = rows.map((r, i) => ({
    cover: r[0] ?? '',
    title: r[1] ?? '',
    metrics: r.slice(2, 5),
    insight: insights[i],
  }));

  if (variant === 'row') return <WorksRow items={items} metricLabels={metricLabels} />;
  if (variant === 'compact') return <WorksCompact items={items} metricLabels={metricLabels} />;
  if (variant === 'detailed') return <WorksDetailed items={items} metricLabels={metricLabels} />;
  return <WorksCards items={items} metricLabels={metricLabels} />;
}

function Cover({ url, alt, cls }: { url: string; alt: string; cls?: string }) {
  if (url) {
    return <img src={url} alt={alt} draggable={false} className={`rounded object-cover ${cls ?? ''}`} />;
  }
  return (
    <div
      className={`flex items-center justify-center rounded bg-surface-hover text-[10px] text-foreground-muted ${cls ?? ''}`}
    >
      Work cover
    </div>
  );
}

function WorksCards({
  items,
  metricLabels,
}: {
  items: WorkItem[];
  metricLabels: string[];
}) {
  return (
    <div className="flex h-full w-full gap-2 overflow-auto skin-card p-2">
      {items.map((it, ri) => (
        <div key={ri} className="flex w-[200px] flex-none flex-col gap-1 rounded-lg border border-border-subtle p-2">
          <Cover url={it.cover} alt={it.title} cls="h-[72px] w-full" />
          <div className="line-clamp-1 text-xs font-medium text-foreground-primary">{it.title}</div>
          <div className="flex gap-2 text-[10px] text-foreground-secondary">
            {it.metrics.map((m, ci) => (
              <span key={ci}>
                {metricLabels[ci] ? `${metricLabels[ci]} ` : ''}
                {m}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function WorksRow({
  items,
  metricLabels,
}: {
  items: WorkItem[];
  metricLabels: string[];
}) {
  return (
    <div className="flex h-full w-full flex-col gap-1 overflow-auto skin-card p-2">
      {items.map((it, ri) => (
        <div key={ri} className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-surface-hover">
          <Cover url={it.cover} alt={it.title} cls="h-[44px] w-[44px] flex-none" />
          <div className="min-w-0 flex-1 truncate text-sm text-foreground-primary">{it.title}</div>
          <div className="flex flex-none gap-2 text-[11px] text-foreground-secondary">
            {it.metrics.map((m, ci) => (
              <span key={ci}>
                {metricLabels[ci] ? `${metricLabels[ci]} ` : ''}
                {m}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function WorksCompact({
  items,
  metricLabels,
}: {
  items: WorkItem[];
  metricLabels: string[];
}) {
  return (
    <div className="flex h-full w-full flex-col gap-1 overflow-auto skin-card skin-pad-sm">
      {items.map((it, ri) => (
        <div key={ri} className="flex items-center gap-3 border-b border-border-subtle py-1.5 last:border-b-0">
          <div className="min-w-0 flex-1 truncate text-sm text-foreground-primary">{it.title}</div>
          <div className="flex flex-none gap-3 text-[11px] text-foreground-secondary">
            {it.metrics.map((m, ci) => (
              <span key={ci}>
                {metricLabels[ci] ? `${metricLabels[ci]} ` : ''}
                {m}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 作品条目类型：基础信息 + 可选受众洞察。 */
type WorkItem = {
  cover: string;
  title: string;
  metrics: string[];
  insight?: WorkAudienceInsight;
};

/* ----- detailed 变体：作品卡 + 受众画像（城市/性别/年龄）+ 数据趋势图 ----- */

/** 迷你水平占比条（单维度分布，如城市/年龄）。 */
export function MiniBar({ label, value, color, index = 0 }: { label: string; value: number; color?: string; index?: number }) {
  const palette = useChartColors();
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-14 flex-none truncate text-[10px] text-foreground-secondary">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, value)}%`, backgroundColor: resolveColor(color, index, palette) }}
        />
      </div>
      <span className="w-7 flex-none text-right text-[10px] font-data text-foreground-primary">{value}%</span>
    </div>
  );
}

/** 迷你趋势折线图（无坐标轴，纯趋势线）。 */
function MiniTrend({ data, label }: { data: { label: string; value: number }[]; label: string }) {
  if (!data.length) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[10px] text-foreground-muted">{label}</div>
      <div className="h-10">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--color-primary)"
              strokeWidth={1.5}
              dot={false}
            />
            <Tooltip
              contentStyle={{ fontSize: 10, padding: '2px 6px', borderRadius: 4 }}
              labelStyle={{ fontSize: 10 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** 性别环形迷你图。 */
export function MiniGenderDonut({ data }: { data: { label: string; value: number; color?: string }[] }) {
  const palette = useChartColors();
  if (!data.length) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="h-10 w-10">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius="60%" outerRadius="90%">
              {data.map((d, i) => (
                <Cell key={i} fill={resolveColor(d.color, i, palette)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col gap-0.5">
        {data.map((d, i) => (
          <span key={i} className="flex items-center gap-1 text-[10px] text-foreground-secondary">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: resolveColor(d.color, i, palette) }} />
            {d.label} {d.value}%
          </span>
        ))}
      </div>
    </div>
  );
}

function WorksDetailed({
  items,
  metricLabels,
}: {
  items: WorkItem[];
  metricLabels: string[];
}) {
  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-auto skin-card p-2">
      {items.map((it, ri) => {
        const ins = it.insight;
        const hasInsight = ins && (ins.topCities?.length || ins.genderSplit?.length || ins.ageRange?.length || ins.trend?.length);
        return (
          <div key={ri} className="rounded-lg border border-border-subtle p-2">
            {/* 头部：封面 + 标题 + 互动指标 */}
            <div className="flex items-start gap-2">
              <Cover url={it.cover} alt={it.title} cls="h-[60px] w-[60px] flex-none rounded" />
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-xs font-medium text-foreground-primary">{it.title}</div>
                <div className="mt-1 flex gap-2 text-[10px] text-foreground-secondary">
                  {it.metrics.map((m, ci) => (
                    <span key={ci}>
                      {metricLabels[ci] ? `${metricLabels[ci]} ` : ''}
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {/* 受众画像 + 趋势（如有） */}
            {hasInsight && (
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border-subtle pt-2">
                {/* 城市 Top */}
                {ins.topCities && ins.topCities.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-medium text-foreground-secondary">Top Fan Cities</div>
                    {ins.topCities.slice(0, 4).map((c, ci) => (
                      <MiniBar key={ci} label={c.label} value={c.value} color={c.color} index={ci} />
                    ))}
                  </div>
                )}
                {/* 年龄段 */}
                {ins.ageRange && ins.ageRange.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-medium text-foreground-secondary">Age Distribution</div>
                    {ins.ageRange.slice(0, 4).map((a, ci) => (
                      <MiniBar key={ci} label={a.label} value={a.value} color={a.color ?? 'auto'} index={ci} />
                    ))}
                  </div>
                )}
                {/* 性别 */}
                {ins.genderSplit && ins.genderSplit.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <div className="text-[10px] font-medium text-foreground-secondary">Gender Distribution</div>
                    <MiniGenderDonut data={ins.genderSplit} />
                  </div>
                )}
                {/* 趋势 */}
                {ins.trend && ins.trend.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <MiniTrend data={ins.trend} label={ins.trendLabel ?? 'Data Trend'} />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------- creator fan profile charts ------------------------- */

/** 图表外壳：统一卡片框 + 标题 + 副标题（空则不渲染）+ 图区。 */
function CreatorChartShell({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex h-full w-full flex-col skin-card skin-pad-sm"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
      {subtitle && <div className="mt-0.5 text-[11px] text-foreground-secondary">{subtitle}</div>}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

/** 空数据占位。 */
function EmptyChart() {
  return (
    <div className="flex h-full w-full items-center justify-center text-xs text-foreground-muted">暂无数据</div>
  );
}

/** 性别占比组件的默认设计宽度（px），文本按容器宽度相对它等比缩放。 */
const GENDER_DESIGN_W = 320;

/** 性别占比环形图；center 为中心主项摘要。组件缩小时，「性别项」文案（饼图标签 + 中心摘要 + 图例）按容器宽度等比缩小。 */
export function CreatorFanGender({ data }: { data: CreatorFanGenderData }) {
  const { title, subtitle, center, slices = [] } = data;
  const palette = useChartColors();
  // 测量渲染宽度，按相对设计宽 320 的比例缩放文案；下限 0.6 保证仍可读。
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(GENDER_DESIGN_W);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return; // jsdom 等无 RO 环境：保持设计宽，测试照常
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = Math.max(0.6, Math.min(1, width / GENDER_DESIGN_W));
  const labelFont = Math.round(12 * scale); // 饼图标签 + 中心摘要
  const legendFont = Math.round(10 * scale); // 图例

  return (
    <CreatorChartShell title={title} subtitle={subtitle}>
      {slices.length === 0 ? (
        <EmptyChart />
      ) : (
        <div ref={ref} className="flex h-full w-full flex-col">
          <div className="relative min-h-0 flex-1" style={{ fontSize: labelFont }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="80%"
                  label={(e: { label?: string }) => e.label ?? ''}
                >
                  {slices.map((s, i) => (
                    <Cell key={i} fill={resolveColor(s.color, i, palette)} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            {center && (
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center text-center font-semibold text-foreground-primary"
                style={{ fontSize: labelFont }}
              >
                {center}
              </div>
            )}
          </div>
          {/* recharts label 在 jsdom 测试环境下因整体 mock 不会触发；保留一份 DOM 可见的图例作为兜底。 */}
          <div
            className="mt-1 flex flex-none flex-wrap justify-center gap-x-3 gap-y-0.5 text-foreground-secondary"
            style={{ fontSize: legendFont }}
          >
            {slices.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: resolveColor(s.color, i, palette) }} />
                <span>{s.label}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </CreatorChartShell>
  );
}

/** 城市分布 Top N（横向条形）；按 value 降序，条尾 LabelList 标百分比。 */
export function CreatorFanCity({ data }: { data: CreatorFanCityData }) {
  const { title, subtitle, bars = [] } = data;
  const cs = useChartStyle();
  const palette = useChartColors();
  const sorted = [...bars].sort((a, b) => b.value - a.value);
  const sum = sorted.reduce((acc, b) => acc + b.value, 0) || 1;
  const withPct = sorted.map((b) => ({ ...b, pct: Math.round((b.value / sum) * 100) }));
  return (
    <CreatorChartShell title={title} subtitle={subtitle}>
      {sorted.length === 0 ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={withPct} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            {cs.showGrid && <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-subtle, #F3F4F6)" />}
            <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} hide={!cs.showAxis} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={48} hide={!cs.showAxis} />
            <Tooltip cursor={{ fill: 'var(--surface-hover, #F9FAFB)' }} />
            <Bar dataKey="value" radius={[0, cs.barRadius, cs.barRadius, 0]}>
              {withPct.map((b, i) => (
                <Cell key={i} fill={resolveColor(b.color, i, palette)} />
              ))}
              <LabelList dataKey="pct" position="right" formatter={(v: number) => `${v}%`} style={{ fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </CreatorChartShell>
  );
}

/** 年龄段分布（竖向柱状）。 */
export function CreatorFanAge({ data }: { data: CreatorFanAgeData }) {
  const { title, subtitle, bars = [] } = data;
  const cs = useChartStyle();
  const palette = useChartColors();
  return (
    <CreatorChartShell title={title} subtitle={subtitle}>
      {bars.length === 0 ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            {cs.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle, #F3F4F6)" />}
            <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} hide={!cs.showAxis} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={32} hide={!cs.showAxis} />
            <Tooltip cursor={{ fill: 'var(--surface-hover, #F9FAFB)' }} />
            <Bar dataKey="value" radius={[cs.barRadius, cs.barRadius, 0, 0]}>
              {bars.map((b, i) => (
                <Cell key={i} fill={resolveColor(b.color, i, palette)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </CreatorChartShell>
  );
}

/** 兴趣标签：纯 div 横向占比条。占比 = value / sum(values)；showPercent 缺省视为 true。 */
export function CreatorFanInterest({ data }: { data: CreatorFanInterestData }) {
  const { title, subtitle, tags = [], showPercent } = data;
  const palette = useChartColors();
  const showPct = showPercent !== false;
  const sum = tags.reduce((acc, t) => acc + t.value, 0) || 1;
  return (
    <CreatorChartShell title={title} subtitle={subtitle}>
      {tags.length === 0 ? (
        <EmptyChart />
      ) : (
        <div className="flex h-full w-full flex-col justify-center gap-2 overflow-auto">
          {tags.map((t, i) => {
            const pct = Math.round((t.value / sum) * 100);
            return (
              <div key={i} className="flex items-center gap-2">
                <div className="w-12 flex-none truncate text-[11px] text-foreground-secondary">{t.label}</div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-hover">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: resolveColor(t.color, i, palette) }} />
                </div>
                {showPct && <div className="w-9 flex-none text-right text-[11px] font-data text-foreground-primary">{pct}%</div>}
              </div>
            );
          })}
        </div>
      )}
    </CreatorChartShell>
  );
}

/* ------------------------------ creator list ------------------------------ */

const PLATFORM_LABEL_SHORT: Record<string, string> = {
  xiaohongshu: 'Xiaohongshu',
  douyin: 'Douyin',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  weibo: 'Weibo',
};

/** 达人列表：多达人汇总。 */
export function CreatorList({ data }: { data: CreatorListData }) {
  const { variant = 'table', headers = [], rows = [] } = data;
  const items = rows.map((r) => ({
    avatar: r[0] ?? '',
    name: r[1] ?? '',
    platform: r[2] ?? '',
    followers: r[3] ?? '',
    engagement: r[4] ?? '',
    category: r[5] ?? '',
  }));
  if (variant === 'cards') return <CreatorListCards items={items} />;
  if (variant === 'compact') return <CreatorListCompact items={items} headers={headers} />;
  return <CreatorListTable items={items} headers={headers} />;
}

function ListAvatar({ url, name, size }: { url: string; name: string; size: number }) {
  if (url) return <img src={url} alt={name} className="flex-none rounded-full object-cover" style={{ width: size, height: size }} draggable={false} />;
  return (
    <div className="flex flex-none items-center justify-center rounded-full bg-primary/10 text-primary" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name?.slice(0, 1) || '?'}
    </div>
  );
}

type CreatorListRow = { avatar: string; name: string; platform: string; followers: string; engagement: string; category: string };

/** 表格变体：标准表格，列 = [头像+名称, 平台, 粉丝数, 互动率, 分类]。 */
function CreatorListTable({ items, headers }: { items: CreatorListRow[]; headers: string[] }) {
  return (
    <div className="flex h-full w-full flex-col overflow-auto skin-card">
      {/* 表头 */}
      <div className="flex items-center border-b border-border-default bg-surface-subtle px-3 py-2 text-[11px] font-medium text-foreground-secondary">
        <div className="min-w-0 flex-1">{headers[1] ?? 'Creator'}</div>
        <div className="w-20 flex-none text-center">{headers[2] ?? 'Platform'}</div>
        <div className="w-20 flex-none text-right">{headers[3] ?? 'Followers'}</div>
        <div className="w-16 flex-none text-right">{headers[4] ?? 'Engagement'}</div>
        <div className="w-16 flex-none text-right">{headers[5] ?? 'Category'}</div>
      </div>
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2 border-b border-border-subtle px-3 py-2 last:border-b-0 hover:bg-surface-hover">
          <ListAvatar url={it.avatar} name={it.name} size={32} />
          <div className="min-w-0 flex-1 truncate text-sm font-medium text-foreground-primary">{it.name}</div>
          <div className="w-20 flex-none text-center text-[11px] text-foreground-secondary">{PLATFORM_LABEL_SHORT[it.platform] ?? it.platform}</div>
          <div className="w-20 flex-none text-right font-data text-sm text-foreground-primary">{it.followers}</div>
          <div className="w-16 flex-none text-right font-data text-sm text-primary">{it.engagement}</div>
          <div className="w-16 flex-none truncate text-right text-[11px] text-foreground-secondary">{it.category}</div>
        </div>
      ))}
    </div>
  );
}

/** 卡片变体：每人一张卡片，网格排列。 */
function CreatorListCards({ items }: { items: CreatorListRow[] }) {
  return (
    <div className="flex h-full w-full flex-wrap gap-2 overflow-auto skin-card p-2">
      {items.map((it, i) => (
        <div key={i} className="flex w-[140px] flex-none flex-col items-center gap-1 rounded-lg border border-border-subtle p-2 text-center">
          <ListAvatar url={it.avatar} name={it.name} size={48} />
          <div className="truncate text-xs font-medium text-foreground-primary">{it.name}</div>
          <div className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-secondary">{PLATFORM_LABEL_SHORT[it.platform] ?? it.platform}</div>
          <div className="font-data text-sm font-semibold text-foreground-primary">{it.followers}</div>
          <div className="text-[10px] text-foreground-muted">Engagement {it.engagement}</div>
          {it.category && <div className="text-[10px] text-foreground-secondary">{it.category}</div>}
        </div>
      ))}
    </div>
  );
}

/** 紧凑变体：纯文字横排列表。 */
function CreatorListCompact({ items }: { items: CreatorListRow[]; headers: string[] }) {
  return (
    <div className="flex h-full w-full flex-col gap-1 overflow-auto skin-card p-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-surface-hover">
          <span className="w-5 flex-none text-center text-[10px] text-foreground-muted">{i + 1}</span>
          <div className="min-w-0 flex-1 truncate text-sm text-foreground-primary">{it.name}</div>
          <span className="w-16 flex-none truncate text-[11px] text-foreground-secondary">{PLATFORM_LABEL_SHORT[it.platform] ?? it.platform}</span>
          <span className="w-20 flex-none text-right font-data text-sm text-foreground-primary">{it.followers}</span>
          <span className="w-14 flex-none text-right text-[11px] text-primary">{it.engagement}</span>
        </div>
      ))}
    </div>
  );
}
