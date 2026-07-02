import { useEffect } from 'react';

export interface MenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface Props {
  x: number;
  y: number;
  items: (MenuItem | 'separator')[];
  onClose: () => void;
}

/** 右键菜单：定位在 clientX/clientY，外部点击 / Esc 关闭。 */
export function ContextMenu({ x, y, items, onClose }: Props) {
  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // 延迟一帧绑定，避免触发菜单的同一次 mousedown 立即关闭。
    const id = setTimeout(() => {
      window.addEventListener('mousedown', close);
      window.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      clearTimeout(id);
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed z-50 min-w-[140px] rounded-lg border border-border-default bg-surface-primary py-1 text-sm shadow-lg"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items.map((item, i) =>
        item === 'separator' ? (
          <div key={i} className="my-1 h-px bg-border-subtle" />
        ) : (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className={`block w-full px-3 py-1.5 text-left hover:bg-surface-hover disabled:opacity-40 ${
              item.danger ? 'text-red' : 'text-foreground-primary'
            }`}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
