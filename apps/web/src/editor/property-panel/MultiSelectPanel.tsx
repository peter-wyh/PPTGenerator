import { useEditorStore } from '../store';
import { Button } from '@/components/Button';
import { ALIGN_BUTTONS } from './constants';
import { FieldGroup } from './helpers';

export function MultiSelectPanel({ ids }: { ids: string[] }) {
  const align = useEditorStore((s) => s.alignComponents);
  const distributeH = useEditorStore((s) => s.distributeH);
  const distributeV = useEditorStore((s) => s.distributeV);
  const equalWidth = useEditorStore((s) => s.equalWidth);
  const equalHeight = useEditorStore((s) => s.equalHeight);
  const deleteSelected = useEditorStore((s) => s.deleteSelected);

  return (
    <div className="flex h-full w-[300px] flex-col gap-4 overflow-auto border-l border-border-default bg-surface-primary p-4">
      <div className="font-headings text-sm font-semibold text-foreground-primary">
        已选中 {ids.length} 个组件
      </div>

      <FieldGroup title="对齐">
        <div className="grid grid-cols-3 gap-1">
          {ALIGN_BUTTONS.map((b) => (
            <button
              key={b.alignment}
              onClick={() => align(ids, b.alignment)}
              className="rounded border border-border-default px-1 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover"
            >
              {b.label}
            </button>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup title="分布">
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => distributeH(ids)}
            className="rounded border border-border-default px-1 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            水平分布
          </button>
          <button
            onClick={() => distributeV(ids)}
            className="rounded border border-border-default px-1 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            垂直分布
          </button>
        </div>
      </FieldGroup>

      <FieldGroup title="等尺寸">
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => equalWidth(ids)}
            className="rounded border border-border-default px-1 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            等宽
          </button>
          <button
            onClick={() => equalHeight(ids)}
            className="rounded border border-border-default px-1 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            等高
          </button>
        </div>
      </FieldGroup>

      <div className="mt-auto border-t border-border-subtle pt-3">
        <Button variant="danger" className="w-full" onClick={() => deleteSelected()}>
          删除选中
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------- 字段编辑器 ------------------------------- */

