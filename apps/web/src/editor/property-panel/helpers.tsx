import type { ComponentData, EditorComponent } from '@mediakit/shared';
import { useRef } from 'react';
import { useEditorStore } from '../store';
import type { PropertyField, VariantOption } from '../registry';

export function readValue(comp: EditorComponent, field: PropertyField): unknown {
  if (field.inData === false) {
    return (comp as unknown as Record<string, unknown>)[field.key];
  }
  return (comp.data as unknown as Record<string, unknown>)[field.key];
}

/**
 * useDataUpdate：返回一个 (key, value) 更新函数。
 *
 * store 更新（updateComponent，仅标脏、不落 history）立即执行 → 实时预览无延迟。
 * 但 commit()（落 undo history）被 debounce 500ms → 连续按键只产生一条 undo 记录，
 * 避免瞬间打满 50 步 undo 栈。组件卸载时若有 pending commit 会 flush。
 */
export function useDataUpdate(comp: EditorComponent) {
  const updateComponent = useEditorStore((s) => s.updateComponent);
  const commit = useEditorStore((s) => s.commit);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      commit();
    }
  };

  // 复用闭包：组件卸载时 flush 最后一次 pending commit，避免漏落 history。
  const flushRef = useRef(flush);
  flushRef.current = flush;

  return (key: string, value: unknown) => {
    // 1. 立即更新 store（标脏、刷新预览），但不落 history
    updateComponent(comp.id, {
      data: { ...(comp.data as object), [key]: value } as unknown as ComponentData,
    });
    // 2. debounce commit：500ms 内连续调用合并为一条 undo 记录
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      commit();
    }, 500);
  };
}

export function VariantSelector({ comp, variants }: { comp: EditorComponent; variants: VariantOption[] }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const current = (comp.data as { variant?: string }).variant ?? variants[0]?.id ?? '';
  return (
    <div className="flex flex-wrap gap-1">
      {variants.map((v) => (
        <button
          key={v.id}
          onClick={() => updateComponentData(comp.id, { variant: v.id })}
          className={`rounded border px-2 py-1 text-xs ${
            current === v.id
              ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
              : 'border-border-default text-foreground-secondary hover:bg-surface-hover'
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------- 达人链接解析 ---------------------------- */


export function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}



/** 不可变写入：返回新数组，index i 置为 v。 */
export function withAt<T>(arr: T[], i: number, v: T): T[] {
  const next = [...arr];
  next[i] = v;
  return next;
}
