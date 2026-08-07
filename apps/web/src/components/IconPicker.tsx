/**
 * IconPicker — 图标选择器面板。
 * 选中 <i class="fa-*"> 元素时在右侧面板出现。
 * 提供常用图标网格、分类切换、搜索、手动输入 class。
 */
import { useState, useMemo } from 'react';

// ── 常用 Font Awesome 6 图标库 ──
// 格式: class 字符串（不含 <i> 标签）
const ICON_DB: Record<string, string[]> = {
  '社交媒体': [
    'fa-brands fa-instagram', 'fa-brands fa-facebook', 'fa-brands fa-twitter',
    'fa-brands fa-youtube', 'fa-brands fa-tiktok', 'fa-brands fa-linkedin',
    'fa-brands fa-whatsapp', 'fa-brands fa-weixin', 'fa-brands fa-telegram',
    'fa-brands fa-discord', 'fa-brands fa-reddit', 'fa-brands fa-pinterest',
    'fa-brands fa-github', 'fa-brands fa-spotify', 'fa-brands fa-x-twitter',
  ],
  '通用': [
    'fa-solid fa-chart-bar', 'fa-solid fa-chart-line', 'fa-solid fa-chart-pie',
    'fa-solid fa-users', 'fa-solid fa-user', 'fa-solid fa-gear',
    'fa-solid fa-star', 'fa-solid fa-heart', 'fa-solid fa-check',
    'fa-solid fa-xmark', 'fa-solid fa-arrow-up', 'fa-solid fa-arrow-down',
    'fa-solid fa-arrow-right', 'fa-solid fa-arrow-left', 'fa-solid fa-plus',
    'fa-solid fa-magnifying-glass', 'fa-solid fa-bell', 'fa-solid fa-clock',
  ],
  '商业': [
    'fa-solid fa-dollar-sign', 'fa-solid fa-coins', 'fa-solid fa-cart-shopping',
    'fa-solid fa-bag-shopping', 'fa-solid fa-store', 'fa-solid fa-credit-card',
    'fa-solid fa-piggy-bank', 'fa-solid fa-money-bill', 'fa-solid fa-receipt',
    'fa-solid fa-file-invoice', 'fa-solid fa-calculator', 'fa-solid fa-briefcase',
    'fa-solid fa-building', 'fa-solid fa-handshake', 'fa-solid fa-gift',
  ],
  '数据/技术': [
    'fa-solid fa-database', 'fa-solid fa-server', 'fa-solid fa-cloud',
    'fa-solid fa-code', 'fa-solid fa-microchip', 'fa-solid fa-desktop',
    'fa-solid fa-mobile-screen', 'fa-solid fa-globe', 'fa-solid fa-wifi',
    'fa-solid fa-shield-halved', 'fa-solid fa-lock', 'fa-solid fa-key',
  ],
  '通信': [
    'fa-solid fa-envelope', 'fa-solid fa-phone', 'fa-solid fa-message',
    'fa-solid fa-comment', 'fa-solid fa-paper-plane', 'fa-solid fa-inbox',
    'fa-solid fa-at', 'fa-solid fa-link', 'fa-solid fa-share',
  ],
  '其他': [
    'fa-solid fa-fire', 'fa-solid fa-bolt', 'fa-solid fa-rocket',
    'fa-solid fa-trophy', 'fa-solid fa-medal', 'fa-solid fa-crown',
    'fa-solid fa-bookmark', 'fa-solid fa-flag', 'fa-solid fa-map',
    'fa-solid fa-location-dot', 'fa-solid fa-calendar', 'fa-solid fa-camera',
    'fa-solid fa-video', 'fa-solid fa-music', 'fa-solid fa-headphones',
    'fa-solid fa-pen', 'fa-solid fa-eye', 'fa-solid fa-lightbulb',
  ],
};

const ALL_ICONS = Object.values(ICON_DB).flat();

interface IconPickerProps {
  currentClass: string;
  onChange: (newClass: string) => void;
}

export function IconPicker({ currentClass, onChange }: IconPickerProps) {
  const [activeCat, setActiveCat] = useState<string>('通用');
  const [search, setSearch] = useState('');

  // 保留 class 中非图标的部分（如 text-pink-500 等颜色/大小类）
  const iconPart = useMemo(() => {
    const match = currentClass.match(/\b(fa[srlbd]?-\S+|fa-\S+)/g);
    return match ? match.join(' ') : currentClass;
  }, [currentClass]);

  const extraClasses = useMemo(() => {
    return currentClass
      .replace(/\b(fa[srlbd]?-\S+|fa-\S+)\b/g, '')
      .trim();
  }, [currentClass]);

  const filteredIcons = useMemo(() => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return ALL_ICONS.filter(ic => ic.toLowerCase().includes(q));
    }
    return ICON_DB[activeCat] || [];
  }, [search, activeCat]);

  return (
    <div className="space-y-2.5 border-b border-border-default p-3 bg-surface-hover/30">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-foreground-secondary">🔀 替换图标</span>
        {/* 当前图标预览 */}
        <i className={`${iconPart} text-base`} style={{ color: '#6366f1' }} />
      </div>

      {/* 手动输入 class */}
      <div>
        <label className="mb-1 block text-[10px] font-medium text-foreground-muted">图标 class</label>
        <input
          type="text"
          value={currentClass}
          onChange={(e) => onChange(e.target.value)}
          placeholder="fa-solid fa-chart-bar"
          className="w-full rounded-md border border-border-default bg-surface-primary px-2 py-1.5 text-[11px] text-foreground-primary focus:border-accent-primary focus:outline-none"
        />
      </div>

      {/* 搜索 */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 搜索图标..."
        className="w-full rounded-md border border-border-default bg-surface-primary px-2 py-1.5 text-[11px] text-foreground-primary focus:border-accent-primary focus:outline-none"
      />

      {/* 分类标签 */}
      {!search.trim() && (
        <div className="flex flex-wrap gap-1">
          {Object.keys(ICON_DB).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              className={`rounded px-2 py-0.5 text-[10px] transition ${
                activeCat === cat
                  ? 'bg-accent-primary text-foreground-inverse'
                  : 'bg-surface-hover text-foreground-secondary hover:bg-surface-hover/70'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* 图标网格 */}
      <div className="grid max-h-[200px] grid-cols-6 gap-1 overflow-y-auto gjs-panel-scroll">
        {filteredIcons.map(ic => (
          <button
            key={ic}
            onClick={() => {
              // 替换图标部分，保留颜色/大小等额外 class
              const newClass = `${ic}${extraClasses ? ' ' + extraClasses : ''}`;
              onChange(newClass);
            }}
            className={`flex aspect-square items-center justify-center rounded text-sm transition ${
              iconPart === ic
                ? 'bg-accent-primary/20 ring-1 ring-accent-primary'
                : 'hover:bg-surface-hover text-foreground-secondary'
            }`}
            title={ic}
          >
            <i className={ic} />
          </button>
        ))}
      </div>

      {extraClasses && (
        <div className="text-[10px] text-foreground-muted">
          保留样式: <span className="font-mono">{extraClasses}</span>
        </div>
      )}
    </div>
  );
}
