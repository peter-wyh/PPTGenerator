/**
 * StructurePanel — Recipe 结构层(manifest 覆盖)。
 * 6 个组件(header/kpi/trend/publishers/insights/actionable):
 *  - 勾选 = 显示(默认全显);取消 = 加入 hidden
 *  - ↑/↓ 按钮调整 order
 *
 * v1 注意:隐藏 trend/insights(图表组件)时,模板里的 Chart.js 初始化可能因
 * canvas 缺失而在 console 报错——不影响其余部分渲染。下方有提示文案。
 */
import type { ManifestOverrides } from '@/api/htmlTemplates';

const ALL_COMPONENTS = ['header', 'kpi', 'trend', 'publishers', 'insights', 'actionable'] as const;
const LABELS: Record<(typeof ALL_COMPONENTS)[number], string> = {
  header: '页眉',
  kpi: 'KPI',
  trend: '趋势',
  publishers: '发布方',
  insights: '洞察',
  actionable: '行动建议',
};

interface Props {
  manifest: ManifestOverrides;
  onChange: (m: ManifestOverrides) => void;
}

export function StructurePanel({ manifest, onChange }: Props) {
  const order = manifest.order?.length ? manifest.order : [...ALL_COMPONENTS];
  const hidden = new Set(manifest.hidden ?? []);

  const toggleHidden = (id: string) => {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...manifest, hidden: [...next] });
  };

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange({ ...manifest, order: next });
  };

  return (
    <fieldset className="rounded-lg border border-border-default p-3">
      <legend className="px-1 text-xs font-medium text-foreground-secondary">🧱 结构</legend>
      <ul className="space-y-1">
        {order.map((id, idx) => {
          const label = LABELS[id as (typeof ALL_COMPONENTS)[number]] ?? id;
          const isHidden = hidden.has(id);
          return (
            <li key={id} className="flex items-center gap-2 text-[11px]">
              <label className="flex flex-1 items-center gap-1.5 text-foreground-secondary">
                <input
                  type="checkbox"
                  checked={!isHidden}
                  onChange={() => toggleHidden(id)}
                  aria-label={`显示 ${label}`}
                />
                <span>{label}</span>
              </label>
              <button
                type="button"
                onClick={() => move(idx, -1)}
                disabled={idx === 0}
                aria-label={`上移 ${label}`}
                className="rounded px-1 text-[10px] text-foreground-muted hover:bg-surface-hover disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(idx, 1)}
                disabled={idx === order.length - 1}
                aria-label={`下移 ${label}`}
                className="rounded px-1 text-[10px] text-foreground-muted hover:bg-surface-hover disabled:opacity-30"
              >
                ↓
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[10px] leading-relaxed text-amber-500">
        ⓘ 隐藏图表组件可能导致其 JS 初始化报错(不影响其余部分)
      </p>
    </fieldset>
  );
}
