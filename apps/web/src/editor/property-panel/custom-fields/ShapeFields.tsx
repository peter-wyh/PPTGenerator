import type { EditorComponent, ShapeData, ShapeKind } from '@mediakit/shared';
import { useEditorStore } from '../../store';
import { FieldGroup } from '../helpers';

const SHAPE_OPTIONS: { id: ShapeKind; label: string }[] = [
  { id: 'rectangle', label: '矩形' },
  { id: 'rounded', label: '圆角' },
  { id: 'circle', label: '圆形' },
  { id: 'line', label: '直线' },
];

export function ShapeFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const data = comp.data as ShapeData;
  const isLine = data.shape === 'line';

  function setShape(shape: ShapeKind) {
    const next: ShapeData = { ...data, shape };
    if (shape === 'line') {
      next.strokeWidth = next.strokeWidth || 1;
      next.dash = next.dash ?? false;
      delete (next as { fill?: string }).fill;
    }
    if (shape === 'rounded' && next.borderRadius == null) next.borderRadius = 12;
    updateComponentData(comp.id, next as unknown as Record<string, unknown>);
  }
  const set = (patch: Partial<ShapeData>) =>
    updateComponentData(comp.id, patch as unknown as Record<string, unknown>);

  return (
    <FieldGroup title="图形">
      <div className="flex flex-wrap gap-1">
        {SHAPE_OPTIONS.map((o) => (
          <button
            key={o.id}
            onClick={() => setShape(o.id)}
            className={`rounded border px-2 py-1 text-xs ${
              data.shape === o.id
                ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                : 'border-border-default text-foreground-secondary hover:bg-surface-hover'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {!isLine && (
        <label className="block text-xs text-foreground-secondary">
          <span className="mb-1 block">填充色</span>
          <input type="color" value={data.fill ?? '#ffffff'} onChange={(e) => set({ fill: e.target.value })} className="h-8 w-full rounded border border-border-default p-1" />
        </label>
      )}

      <label className="block text-xs text-foreground-secondary">
        <span className="mb-1 block">描边色</span>
        <input type="color" value={data.stroke ?? '#E5E7EB'} onChange={(e) => set({ stroke: e.target.value })} className="h-8 w-full rounded border border-border-default p-1" />
      </label>

      <label className="block text-xs text-foreground-secondary">
        <span className="mb-1 block">描边粗细</span>
        <input type="number" min={0} value={data.strokeWidth ?? 0} onChange={(e) => set({ strokeWidth: Number(e.target.value) })} className="w-full rounded border border-border-default px-2 py-1" />
      </label>

      <label className="block text-xs text-foreground-secondary">
        <span className="mb-1 block">透明度（0–1）</span>
        <input type="number" min={0} max={1} step={0.1} value={data.opacity ?? 1} onChange={(e) => set({ opacity: Number(e.target.value) })} className="w-full rounded border border-border-default px-2 py-1" />
      </label>

      <label className="block text-xs text-foreground-secondary">
        <span className="mb-1 block">旋转（度）</span>
        <input type="number" value={data.rotation ?? 0} onChange={(e) => set({ rotation: Number(e.target.value) })} className="w-full rounded border border-border-default px-2 py-1" />
      </label>

      {data.shape === 'rounded' && (
        <label className="block text-xs text-foreground-secondary">
          <span className="mb-1 block">圆角半径</span>
          <input type="number" min={0} value={data.borderRadius ?? 12} onChange={(e) => set({ borderRadius: Number(e.target.value) })} className="w-full rounded border border-border-default px-2 py-1" />
        </label>
      )}

      {isLine && (
        <label className="flex items-center gap-2 text-xs text-foreground-secondary">
          <input type="checkbox" checked={data.dash ?? false} onChange={(e) => set({ dash: e.target.checked })} />
          虚线
        </label>
      )}
    </FieldGroup>
  );
}
