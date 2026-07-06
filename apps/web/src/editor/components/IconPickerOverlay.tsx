import { useState } from 'react';
import { ICON_CATEGORIES, ICONS, type IconDef } from '../icons/catalog';

interface Props {
  /** 当前已选 icon key（高亮） */
  current?: string;
  onPick: (iconKey: string) => void;
  onClose: () => void;
}

export function IconPickerOverlay({ current, onPick, onClose }: Props) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = q
    ? ICONS.filter((i) => i.label.includes(query.trim()) || i.key.toLowerCase().includes(q))
    : ICONS;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[80vh] w-[480px] flex-col rounded-xl bg-surface-primary p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-3 font-headings text-sm font-semibold text-foreground-primary">选择图标</div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索图标..."
          className="mb-3 rounded border border-border-default px-2 py-1 text-sm"
        />
        <div className="-mr-2 flex-1 overflow-y-auto pr-2">
          {q ? (
            <div className="grid grid-cols-6 gap-2">
              {list.map((ic) => (
                <IconCell key={ic.key} ic={ic} current={current} onPick={onPick} onClose={onClose} />
              ))}
            </div>
          ) : (
            ICON_CATEGORIES.map((cat) => (
              <section key={cat.id} className="mb-3">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                  {cat.label}
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {ICONS.filter((i) => i.category === cat.id).map((ic) => (
                    <IconCell key={ic.key} ic={ic} current={current} onPick={onPick} onClose={onClose} />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
        <div className="mt-3 flex justify-end border-t border-border-subtle pt-3">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-foreground-secondary hover:bg-surface-hover"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

function IconCell({
  ic, current, onPick, onClose,
}: { ic: IconDef; current?: string; onPick: (k: string) => void; onClose: () => void }) {
  return (
    <button
      onClick={() => { onPick(ic.key); onClose(); }}
      title={ic.label}
      className={`flex flex-col items-center gap-1 rounded-lg border p-2 ${
        current === ic.key
          ? 'border-accent-primary bg-accent-primary/10'
          : 'border-border-default hover:bg-surface-hover'
      }`}
    >
      <ic.Comp size={22} />
      <span className="text-[10px] text-foreground-secondary">{ic.label}</span>
    </button>
  );
}
