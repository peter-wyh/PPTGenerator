import type { EditorComponent, WorkMetricsData } from '@mediakit/shared';
import { useEditorStore } from '../../store';
import { FieldGroup } from '../helpers';

/** 作品数据：每个指标 label + value + color + 删除，底部添加。 */
export function WorkMetricsFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const data = comp.data as WorkMetricsData;
  const metrics = data.metrics ?? [];

  const write = (next: WorkMetricsData['metrics']) => {
    updateComponentData(comp.id, { metrics: next } as Partial<WorkMetricsData>);
    commit();
  };
  const setItem = (i: number, patch: Partial<{ label: string; value: string; color: string }>) =>
    write(metrics.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const add = () => write([...metrics, { label: '新指标', value: '--', color: 'auto' }]);
  const remove = (i: number) => write(metrics.filter((_, idx) => idx !== i));

  return (
    <FieldGroup title="作品指标">
      <div className="space-y-1">
        {metrics.map((m, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              value={m.label}
              placeholder="指标"
              onChange={(e) => setItem(i, { label: e.target.value })}
              className="w-16 rounded border border-border-default px-1.5 py-0.5 text-xs text-foreground-primary"
            />
            <input
              value={m.value}
              placeholder="数值"
              onChange={(e) => setItem(i, { value: e.target.value })}
              className="w-16 rounded border border-border-default px-1.5 py-0.5 text-xs text-foreground-primary"
            />
            <input
              type="color"
              value={m.color ?? 'auto'}
              onChange={(e) => setItem(i, { color: e.target.value })}
              className="h-6 w-6 rounded border border-border-default"
            />
            <button onClick={() => remove(i)} className="text-foreground-muted hover:text-red">
              ✕
            </button>
          </div>
        ))}
      </div>
      <button onClick={add} className="text-xs text-accent-primary hover:underline">
        + 添加指标
      </button>
    </FieldGroup>
  );
}
