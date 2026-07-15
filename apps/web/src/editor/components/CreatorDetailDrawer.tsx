import { useEffect, useState } from 'react';
import type { Creator } from '@mediakit/shared';
import { CreatorAvatar } from '@/components/CreatorAvatar';

interface Props {
  creator: Creator;
  onClose: () => void;
}

/** 达人详情右侧滑出浮窗:头像 + 基本字段网格 + 4 频道 KPI。数据全取自 Creator 记录(无额外请求)。 */
export function CreatorDetailDrawer({ creator, onClose }: Props) {
  const [open, setOpen] = useState(false);
  // 挂载后下一帧切 translate-x-0 → 滑入动画。
  useEffect(() => {
    const r = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(r);
  }, []);
  // Esc 关闭。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const profile: [string, string][] = [
    ['Platform', creator.platform],
    ['Tier', creator.tier],
    ['Followers', creator.followers],
    ['Engagement', creator.engagement],
    ['Category', creator.category],
    ['Region', creator.region],
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <aside
        className={`fixed inset-y-0 right-0 flex h-full w-[440px] max-w-[90vw] flex-col overflow-auto bg-surface-primary shadow-xl transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={creator.name}
      >
        {/* 头部:大头像 + name + handle + 关闭 */}
        <div className="flex items-start gap-3 border-b border-border-subtle p-5">
          <CreatorAvatar name={creator.name} avatar={creator.avatar} size={64} />
          <div className="min-w-0 flex-1">
            <div className="font-headings text-lg font-semibold text-foreground-primary">{creator.name}</div>
            <div className="truncate text-sm text-foreground-secondary">{creator.handle}</div>
          </div>
          <button onClick={onClose} aria-label="关闭" className="rounded p-1 text-foreground-secondary hover:bg-surface-hover">
            ✕
          </button>
        </div>

        {/* 基本字段网格 */}
        <div className="grid grid-cols-2 gap-px bg-border-subtle">
          {profile.map(([k, v]) => (
            <div key={k} className="bg-surface-primary p-3">
              <div className="text-[11px] uppercase tracking-wide text-foreground-muted">{k}</div>
              <div className="text-sm font-medium text-foreground-primary">{v || '—'}</div>
            </div>
          ))}
        </div>

        {/* 频道 KPI(metrics 为空则隐藏) */}
        {creator.metrics.length > 0 && (
          <div className="p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">频道 KPI</div>
            <div className="grid grid-cols-2 gap-2">
              {creator.metrics.map((m) => (
                <div key={m.label} className="rounded-lg border border-border-subtle p-3">
                  <div className="text-[11px] text-foreground-muted">{m.label}</div>
                  <div className="text-base font-semibold text-foreground-primary">{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
