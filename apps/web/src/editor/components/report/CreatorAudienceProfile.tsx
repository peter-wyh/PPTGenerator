/**
 * CreatorAudienceProfile — 达人用户画像复合容器。
 * 卡片内按 variant(grid-2 / grid-3 / stacked)排列启用的子模块:
 *   gender → 大数字+色点(对标参考图);age / city → 横条(MiniBar)。
 * 子模块增删由属性面板控制(modules[].selected),数据从绑定达人 audience 填充。
 */
import type { AudienceModule, CreatorAudienceProfileData } from '@mediakit/shared';
import { AUDIENCE_MODULE_CATALOG } from '@mediakit/shared';
import { MiniBar } from '../CreatorComponents';

const MODULE_LABEL: Record<string, string> = Object.fromEntries(
  AUDIENCE_MODULE_CATALOG.map((m) => [m.key, m.label]),
);

/** gender 大数字配色兜底(粉/蓝/紫),item 自带 color 优先。 */
const GENDER_COLORS = ['#EC4899', '#3B82F6', '#8B5CF6'];

function ModuleCard({ module }: { module: AudienceModule }) {
  const items = module.items ?? [];
  const label = MODULE_LABEL[module.key] ?? module.key;
  return (
    <div className="flex min-h-0 flex-col gap-1.5 rounded-lg bg-surface-secondary p-2">
      <div className="text-[11px] font-semibold text-foreground-secondary">{label}</div>
      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-[10px] text-foreground-muted">No data</div>
      ) : module.key === 'gender' ? (
        // 性别:大数字 + 色点 + 标签(对标参考图,替代环形)
        <div className="flex flex-col justify-center gap-1.5">
          {items.map((it, i) => {
            const c = it.color ?? GENDER_COLORS[i % GENDER_COLORS.length];
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: c }} />
                <span className="font-data text-lg font-bold leading-none" style={{ color: c }}>
                  {it.value}%
                </span>
                <span className="text-[10px] text-foreground-secondary">{it.label}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map((it, i) => (
            <MiniBar key={i} label={it.label} value={it.value} color={it.color} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CreatorAudienceProfile({ data }: { data: CreatorAudienceProfileData }) {
  const { variant = 'grid-3', title, subtitle, modules = [] } = data;
  const active = modules.filter((m) => m.selected !== false);
  const layoutCls =
    variant === 'grid-2'
      ? 'grid grid-cols-2 gap-2'
      : variant === 'stacked'
        ? 'flex flex-col gap-2'
        : 'grid grid-cols-3 gap-2';

  if (active.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl bg-surface-primary p-3 text-xs text-foreground-muted">
        No audience modules enabled
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col rounded-xl bg-surface-primary p-3">
      {(title || subtitle) && (
        <div className="mb-2 flex-none">
          {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
          {subtitle && <div className="text-[11px] text-foreground-muted">{subtitle}</div>}
        </div>
      )}
      <div className={`min-h-0 flex-1 ${layoutCls}`}>
        {active.map((m) => (
          <ModuleCard key={m.key} module={m} />
        ))}
      </div>
    </div>
  );
}
