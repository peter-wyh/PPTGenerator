import type { CreatorStatItem, CreatorStatsStripData, EditorComponent } from '@mediakit/shared';
import { CREATOR_METRIC_CATALOG } from '@mediakit/shared';
import { useEditorStore } from '../../store';
import { FieldGroup } from '../helpers';

/** 达人数据条：指标库勾选筛选 + 已选指标文案编辑。 */
export function CreatorStatsFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const data = comp.data as CreatorStatsStripData;
  const stats = data.stats ?? [];

  const write = (next: CreatorStatItem[]) => {
    updateComponentData(comp.id, { stats: next } as Partial<CreatorStatsStripData>);
    commit();
  };

  // 命中指标库：存在同 key 且 selected !== false 视为启用。
  const isEnabled = (key: string) => stats.some((s) => s.key === key && s.selected !== false);

  const toggle = (key: string) => {
    const meta = CREATOR_METRIC_CATALOG.find((m) => m.key === key)!;
    const existing = stats.find((s) => s.key === key);
    if (existing) {
      // 切换 selected（保留文案）。
      write(stats.map((s) => (s.key === key ? { ...s, selected: s.selected === false } : s)));
    } else {
      // 首次启用：用指标库默认 label/color，value 留空待用户填。
      write([...stats, { key, label: meta.label, value: '', color: meta.color, selected: true }]);
    }
  };

  const setItem = (i: number, patch: Partial<CreatorStatItem>) =>
    write(stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const visible = stats.filter((s) => s.selected !== false);

  return (
    <FieldGroup title="达人数据">
      <div className="text-xs text-foreground-secondary">
        <div className="mb-1">筛选指标</div>
        <div className="grid grid-cols-2 gap-1">
          {CREATOR_METRIC_CATALOG.map((m) => (
            <label key={m.key} className="flex items-center gap-1">
              <input type="checkbox" checked={isEnabled(m.key)} onChange={() => toggle(m.key)} className="h-3 w-3" />
              <span>{m.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="text-xs text-foreground-secondary">
        <div className="mb-1">文案修改</div>
        {visible.length === 0 && <p className="text-foreground-muted">请先勾选要展示的指标。</p>}
        <div className="space-y-1">
          {visible.map((s) => {
            const idx = stats.indexOf(s);
            return (
              <div key={s.key ?? idx} className="flex items-center gap-1">
                <input
                  value={s.label}
                  onChange={(e) => setItem(idx, { label: e.target.value })}
                  className="w-16 rounded border border-border-default px-1 py-0.5"
                />
                <input
                  value={s.value}
                  placeholder={CREATOR_METRIC_CATALOG.find((m) => m.key === s.key)?.placeholder ?? ''}
                  onChange={(e) => setItem(idx, { value: e.target.value })}
                  className="w-16 rounded border border-border-default px-1 py-0.5"
                />
                <input
                  type="color"
                  value={s.color}
                  onChange={(e) => setItem(idx, { color: e.target.value })}
                  className="h-6 w-6 rounded border border-border-default"
                />
              </div>
            );
          })}
        </div>
      </div>
    </FieldGroup>
  );
}
