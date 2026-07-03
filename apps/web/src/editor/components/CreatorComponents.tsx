/**
 * 业务组件（试点：达人领域）渲染器。
 *
 * 三层组件模型校准：这三个是"页内可复用、绑定达人领域实体"的真业务组件，
 * 与 BasicComponents 同级（一级 ComponentType），由 REGISTRY 分发。
 * 风格对齐 BasicComponents.tsx：Tailwind + inline style，占位态参考 ImageComponent。
 */
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
  return (
    <div className="flex h-full w-full items-center gap-3 rounded-xl border border-border-default bg-surface-primary p-3">
      {data.avatar ? (
        <img
          src={data.avatar}
          alt={data.name}
          className="h-[72px] w-[72px] flex-none rounded-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="flex h-[72px] w-[72px] flex-none items-center justify-center rounded-full bg-accent-primary/10 text-2xl text-accent-primary">
          {data.name?.slice(0, 1) || '?'}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-foreground-primary">{data.name}</span>
          <span className="flex-none rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-secondary">
            {PLATFORM_LABEL[data.platform] ?? data.platform}
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-accent-primary">{TIER_LABEL[data.tier] ?? data.tier}</div>
        {data.intro && <div className="mt-1 line-clamp-2 text-xs text-foreground-secondary">{data.intro}</div>}
      </div>
    </div>
  );
}

/* ---------------------------- creator stats strip -------------------------- */

export function CreatorStatsStrip({ data }: { data: CreatorStatsStripData }) {
  const stats = data.stats ?? [];
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

/* ---------------------------- creator works list -------------------------- */

/**
 * 作品列表：复用 TableData（{headers,rows}）。约定列顺序
 * [封面URL, 标题, 转, 赞, 评]；列0为图片 URL，列2-4 为互动数据。
 */
export function CreatorWorksList({ data }: { data: CreatorWorksListData }) {
  const rows = data.rows ?? [];
  return (
    <div className="flex h-full w-full gap-2 overflow-auto rounded-xl border border-border-default bg-surface-primary p-2">
      {rows.map((row, ri) => {
        const cover = row[0];
        const title = row[1] ?? '';
        const metrics = row.slice(2, 5);
        const labels = (data.headers ?? []).slice(2, 5);
        return (
          <div key={ri} className="flex w-[200px] flex-none flex-col gap-1 rounded-lg border border-border-subtle p-2">
            {cover ? (
              <img src={cover} alt={title} className="h-[72px] w-full rounded object-cover" draggable={false} />
            ) : (
              <div className="flex h-[72px] w-full items-center justify-center rounded bg-surface-hover text-[10px] text-foreground-muted">
                作品封面
              </div>
            )}
            <div className="line-clamp-1 text-xs font-medium text-foreground-primary">{title}</div>
            <div className="flex gap-2 text-[10px] text-foreground-secondary">
              {metrics.map((m, ci) => (
                <span key={ci}>
                  {labels[ci] ? `${labels[ci]} ` : ''}
                  {m}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
