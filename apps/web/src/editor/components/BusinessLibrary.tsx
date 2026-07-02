import { useState, useRef, useEffect } from 'react';
import { BUSINESS_GROUPS, BUSINESS_LAYOUTS } from '../business/catalog';
import { useEditorStore } from '../store';

/** 业务组件库分组浮层（port demo.renderBusinessMenu）。点击项 → addBusinessBlock。 */
export function BusinessLibrary() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const addBusinessBlock = useEditorStore((s) => s.addBusinessBlock);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`rounded-lg px-3 py-1.5 text-sm transition ${
          open ? 'bg-accent-primary/10 text-accent-primary' : 'text-foreground-secondary hover:bg-surface-hover'
        }`}
      >
        ▦ 业务组件 ▾
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 max-h-[70vh] w-[560px] overflow-auto rounded-xl border border-border-default bg-surface-primary p-2 shadow-lg">
          {BUSINESS_GROUPS.map((g, gi) => (
            <section key={g.group} className={gi === 0 ? '' : 'border-t border-border-subtle pt-2'}>
              <div className="mb-1.5 px-1 text-[11px] font-semibold text-foreground-muted">{g.group}</div>
              <div className="grid grid-cols-3 gap-1.5">
                {g.items.map((it) => {
                  const layout = BUSINESS_LAYOUTS[it.id];
                  return (
                    <button
                      key={it.id}
                      title={`添加${it.name}`}
                      onClick={() => {
                        addBusinessBlock(it.id);
                        setOpen(false);
                      }}
                      className="flex min-h-[42px] items-center gap-2 rounded-lg border border-border-default bg-surface-primary px-2 py-1.5 text-left text-xs hover:border-accent-primary hover:bg-accent-primary/5"
                    >
                      <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded bg-accent-primary/10 text-[13px] text-accent-primary">
                        {it.icon}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-foreground-primary">{it.name}</span>
                        <span className="block truncate text-[10px] text-foreground-muted">
                          {layout?.form} · {layout?.w}×{layout?.h}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
