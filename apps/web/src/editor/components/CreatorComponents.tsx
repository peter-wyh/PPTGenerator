/**
 * 业务组件（试点：达人领域）渲染器。
 *
 * 三层组件模型校准：这三个是"页内可复用、绑定达人领域实体"的真业务组件，
 * 与 BasicComponents 同级（一级 ComponentType），由 REGISTRY 分发。
 * 每个组件提供多个样式变体（data.variant），对应 PRD 组件三层定义中的
 * "样式变体（选版式）"。风格对齐 BasicComponents.tsx；占位态参考 ImageComponent。
 */
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type {
  CreatorAvatarCardData,
  CreatorPlatform,
  CreatorStatsStripData,
  CreatorTier,
  CreatorWorksListData,
} from '@mediakit/shared';

const PLATFORM_LABEL: Record<CreatorPlatform, string> = {
  xiaohongshu: '小红书',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  weibo: '微博',
};

const TIER_LABEL: Record<CreatorTier, string> = {
  mega: 'Mega 头部',
  macro: 'Macro 中腰',
  micro: 'Micro 微',
};

/* --------------------------- creator avatar card -------------------------- */

export function CreatorAvatarCard({ data }: { data: CreatorAvatarCardData }) {
  const { variant = 'horizontal' } = data;
  if (variant === 'vertical') return <AvatarVertical data={data} />;
  if (variant === 'compact') return <AvatarCompact data={data} />;
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
      className="flex flex-none items-center justify-center rounded-full bg-accent-primary/10 text-accent-primary"
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

function AvatarHorizontal({ data }: { data: CreatorAvatarCardData }) {
  return (
    <div className="flex h-full w-full items-center gap-3 rounded-xl border border-border-default bg-surface-primary p-3">
      <Avatar data={data} size={72} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-foreground-primary">{data.name}</span>
          <span className="flex-none rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-secondary">
            {PLATFORM_LABEL[data.platform] ?? data.platform}
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-accent-primary">{TIER_LABEL[data.tier] ?? data.tier}</div>
        {data.intro && <div className="mt-1 line-clamp-2 text-xs text-foreground-secondary">{data.intro}</div>}
        <StatsLine data={data} />
      </div>
    </div>
  );
}

function AvatarVertical({ data }: { data: CreatorAvatarCardData }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl border border-border-default bg-surface-primary p-3 text-center">
      <Avatar data={data} size={80} />
      <div className="flex items-center gap-2">
        <span className="truncate font-semibold text-foreground-primary">{data.name}</span>
        <span className="flex-none rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-secondary">
          {PLATFORM_LABEL[data.platform] ?? data.platform}
        </span>
      </div>
      <div className="text-[11px] text-accent-primary">{TIER_LABEL[data.tier] ?? data.tier}</div>
      {data.intro && <div className="line-clamp-2 text-xs text-foreground-secondary">{data.intro}</div>}
      <StatsLine data={data} />
    </div>
  );
}

function AvatarCompact({ data }: { data: CreatorAvatarCardData }) {
  return (
    <div className="flex h-full w-full items-center gap-2 rounded-xl border border-border-default bg-surface-primary px-3">
      <Avatar data={data} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground-primary">{data.name}</span>
          <span className="truncate text-[11px] text-accent-primary">{TIER_LABEL[data.tier] ?? data.tier}</span>
        </div>
        <div className="truncate text-[11px] text-foreground-secondary">
          {PLATFORM_LABEL[data.platform] ?? data.platform}
        </div>
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
  return <StatsCards stats={visible} />;
}

function StatsCards({ stats }: { stats: CreatorStatsStripData['stats'] }) {
  return (
    <div className="flex h-full w-full items-stretch gap-2 rounded-xl border border-border-default bg-surface-primary p-2">
      {stats.map((s, i) => (
        <div
          key={i}
          className="flex flex-1 flex-col justify-center rounded-lg px-3 py-1"
          style={{ backgroundColor: `${s.color}14` }}
        >
          <div className="text-[11px] text-foreground-secondary">{s.label}</div>
          <div className="font-data text-lg font-semibold" style={{ color: s.color }}>
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsPlain({ stats }: { stats: CreatorStatsStripData['stats'] }) {
  return (
    <div className="flex h-full w-full items-center divide-x divide-border-subtle rounded-xl border border-border-default bg-surface-primary px-2">
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
  return (
    <div className="flex h-full w-full items-stretch gap-3 rounded-xl border border-border-default bg-surface-primary p-3">
      {stats.map((s, i) => (
        <div key={i} className="flex flex-1 flex-col justify-center" style={{ borderBottom: `2px solid ${s.color}` }}>
          <div className="font-data text-2xl font-bold" style={{ color: s.color }}>
            {s.value}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-foreground-secondary">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------- creator works list -------------------------- */

/**
 * 作品列表：复用 TableData 形状。约定列顺序
 * [封面URL, 标题, 转, 赞, 评]；列0 为图片 URL，列2-4 为互动数据。
 */
export function CreatorWorksList({ data }: { data: CreatorWorksListData }) {
  const { variant = 'cards', headers = [], rows = [] } = data;
  const metricLabels = headers.slice(2, 5);
  const items = rows.map((r) => ({ cover: r[0] ?? '', title: r[1] ?? '', metrics: r.slice(2, 5) }));

  if (variant === 'row') return <WorksRow items={items} metricLabels={metricLabels} />;
  if (variant === 'compact') return <WorksCompact items={items} metricLabels={metricLabels} />;
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
      作品封面
    </div>
  );
}

function WorksCards({
  items,
  metricLabels,
}: {
  items: { cover: string; title: string; metrics: string[] }[];
  metricLabels: string[];
}) {
  return (
    <div className="flex h-full w-full gap-2 overflow-auto rounded-xl border border-border-default bg-surface-primary p-2">
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
  items: { cover: string; title: string; metrics: string[] }[];
  metricLabels: string[];
}) {
  return (
    <div className="flex h-full w-full flex-col gap-1 overflow-auto rounded-xl border border-border-default bg-surface-primary p-2">
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
  items: { cover: string; title: string; metrics: string[] }[];
  metricLabels: string[];
}) {
  return (
    <div className="flex h-full w-full flex-col gap-1 overflow-auto rounded-xl border border-border-default bg-surface-primary p-3">
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
    <div className="flex h-full w-full flex-col rounded-xl border border-border-default bg-surface-primary p-3">
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

/** 性别占比环形图；center 为中心主项摘要。 */
export function CreatorFanGender({ data }: { data: import('@mediakit/shared').CreatorFanGenderData }) {
  const { title, subtitle, center, slices = [] } = data;
  return (
    <CreatorChartShell title={title} subtitle={subtitle}>
      {slices.length === 0 ? (
        <EmptyChart />
      ) : (
        <div className="relative h-full w-full">
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
                  <Cell key={i} fill={s.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          {center && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-xs font-semibold text-foreground-primary">
              {center}
            </div>
          )}
          {/* recharts label 在 jsdom 测试环境下因整体 mock 不会触发；保留一份 DOM 可见的图例作为兜底。 */}
          <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[10px] text-foreground-secondary">
            {slices.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
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
export function CreatorFanCity({ data }: { data: import('@mediakit/shared').CreatorFanCityData }) {
  const { title, subtitle, bars = [] } = data;
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
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
            <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
            <Tooltip cursor={{ fill: '#F9FAFB' }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {withPct.map((b, i) => (
                <Cell key={i} fill={b.color} />
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
export function CreatorFanAge({ data }: { data: import('@mediakit/shared').CreatorFanAgeData }) {
  const { title, subtitle, bars = [] } = data;
  return (
    <CreatorChartShell title={title} subtitle={subtitle}>
      {bars.length === 0 ? (
        <EmptyChart />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
            <Tooltip cursor={{ fill: '#F9FAFB' }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {bars.map((b, i) => (
                <Cell key={i} fill={b.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </CreatorChartShell>
  );
}
