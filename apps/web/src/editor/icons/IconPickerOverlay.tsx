import { useMemo, useState } from 'react';
import type { IconWeight } from '@mediakit/shared';
import { ICONS, ICON_CATEGORIES, ICON_WEIGHTS } from './catalog';
import { IconKit } from './IconKit';

export interface IconPickerOverlayProps {
  /** 当前选中的 catalog key（可为空）。 */
  value?: string;
  /** 当前 weight（用于网格预览）。 */
  weight: IconWeight;
  onPick: (key: string) => void;
  onClear: () => void;
  onClose: () => void;
}

const WEIGHT_LABEL: Record<IconWeight, string> = {
  thin: '细线',
  light: '浅线',
  regular: '常规',
  bold: '粗线',
  fill: '实心',
  duotone: '双色',
};

/** 供属性面板 weight 下拉复用。 */
export const ICON_WEIGHT_OPTIONS = ICON_WEIGHTS.map((w) => ({ value: w, label: WEIGHT_LABEL[w] }));

/** 图标选择器模态：按当前 weight 预览 + 分类分组 + 搜索。 */
export function IconPickerOverlay({ value, weight, onPick, onClear, onClose }: IconPickerOverlayProps) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const lower = q.trim().toLowerCase();
    if (!lower) return ICONS;
    return ICONS.filter((i) => i.key.includes(lower) || i.label.toLowerCase().includes(lower));
  }, [q]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-[520px] flex-col overflow-hidden rounded-xl bg-surface-primary shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
          <span className="font-headings text-sm font-semibold text-foreground-primary">选择图标</span>
          <div className="flex items-center gap-2">
            {value && (
              <button
                className="rounded border border-border-default px-2 py-0.5 text-xs text-foreground-secondary hover:bg-surface-hover"
                onClick={onClear}
              >
                清除
              </button>
            )}
            <button
              className="rounded border border-border-default px-2 py-0.5 text-xs text-foreground-secondary hover:bg-surface-hover"
              onClick={onClose}
            >
              关闭
            </button>
          </div>
        </div>

        <div className="border-b border-border-default px-4 py-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索图标 key / 名称"
            className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
          />
        </div>

        <div className="flex-1 overflow-auto p-3">
          {ICON_CATEGORIES.map((cat) => {
            const items = filtered.filter((i) => i.category === cat.id);
            if (items.length === 0) return null;
            return (
              <div key={cat.id} className="mb-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">{cat.label}</div>
                <div className="grid grid-cols-8 gap-2">
                  {items.map((ic) => {
                    const active = ic.key === value;
                    return (
                      <button
                        key={ic.key}
                        title={ic.label}
                        onClick={() => onPick(ic.key)}
                        className={`flex h-12 w-12 items-center justify-center rounded-lg border ${
                          active
                            ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                            : 'border-border-subtle text-foreground-secondary hover:bg-surface-hover'
                        }`}
                      >
                        <IconKit name={ic.key} weight={weight} size={22} />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-8 text-center text-xs text-foreground-muted">无匹配图标</div>
          )}
        </div>
      </div>
    </div>
  );
}
