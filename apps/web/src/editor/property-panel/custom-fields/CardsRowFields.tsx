import { useState } from 'react';
import { useEditorStore } from '../../store';
import type { EditorComponent, CardsRowData, CardsRowItem, IconWeight } from '@mediakit/shared';
import { IconKit } from '../../icons/IconKit';
import { IconPickerOverlay } from '../../icons/IconPickerOverlay';

interface Props {
  comp: EditorComponent;
}

function updateComp(compId: string, updater: (data: CardsRowData) => void) {
  const state = useEditorStore.getState();
  const { pages, currentPageId } = state;
  if (!currentPageId) return;
  const page = pages.find((p) => p.id === currentPageId);
  if (!page) return;
  const target = page.components.find((c) => c.id === compId);
  if (!target) return;
  const data = { ...(target.data as CardsRowData) };
  if (!data.items) data.items = [];
  updater(data);
  state.updateComponent(compId, { data });
}

export function CardsRowFields({ comp }: Props) {
  const data = comp.data as CardsRowData;
  const items = data.items ?? [];
  const [pickerFor, setPickerFor] = useState<number | null>(null);

  const updateItem = (idx: number, patch: Partial<CardsRowItem>) => {
    updateComp(comp.id, (d) => {
      d.items = d.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    });
  };

  const addCard = () => {
    updateComp(comp.id, (d) => {
      d.items = [...d.items, { title: '新卡片', body: '', icon: '', footer: '' }];
    });
  };

  const removeCard = (idx: number) => {
    updateComp(comp.id, (d) => {
      d.items = d.items.filter((_, i) => i !== idx);
    });
  };

  const moveCard = (idx: number, dir: -1 | 1) => {
    updateComp(comp.id, (d) => {
      const ni = idx + dir;
      if (ni < 0 || ni >= d.items.length) return;
      const arr = [...d.items];
      [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
      d.items = arr;
    });
  };

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-foreground-secondary">卡片列表（{items.length}）</div>
      {items.map((item, i) => {
        const iconType = item.iconType ?? (item.icon && item.icon.length <= 2 ? 'emoji' : 'emoji');
        return (
        <div key={i} className="space-y-1.5 rounded-lg border border-border-default p-2.5">
          <div className="flex items-center gap-1.5">
            <span className="flex-none text-[11px] font-bold text-foreground-muted">#{i + 1}</span>
            {/* 图标输入区：emoji 模式=文本输入，kit 模式=选择器按钮 */}
            {iconType === 'kit' ? (
              <button
                onClick={() => setPickerFor(i)}
                className="flex h-7 w-9 flex-none items-center justify-center rounded border border-border-default hover:bg-surface-hover"
                title="点击选择图标"
              >
                {item.icon ? (
                  <IconKit name={item.icon} weight={item.iconWeight ?? 'regular'} size={18} color="var(--foreground-primary)" />
                ) : (
                  <span className="text-xs text-foreground-muted">⊕</span>
                )}
              </button>
            ) : (
              <input
                type="text"
                value={item.icon ?? ''}
                placeholder="Emoji"
                onChange={(e) => updateItem(i, { icon: e.target.value })}
                className="w-10 flex-none rounded border border-border-default px-1 py-0.5 text-center text-xs"
              />
            )}
            {/* 图标类型切换 */}
            <button
              onClick={() => updateItem(i, { iconType: iconType === 'kit' ? 'emoji' : 'kit', icon: iconType === 'kit' ? '' : (item.icon ?? '') })}
              className="flex-none rounded px-1 py-0.5 text-[9px] text-foreground-muted hover:bg-surface-hover"
              title={iconType === 'kit' ? '切换为 Emoji' : '切换为图标库'}
            >
              {iconType === 'kit' ? '✎' : '⚡'}
            </button>
            <input
              type="text"
              value={item.title}
              placeholder="卡片标题"
              onChange={(e) => updateItem(i, { title: e.target.value })}
              className="min-w-0 flex-1 rounded border border-border-default px-2 py-0.5 text-xs"
            />
            <button
              onClick={() => moveCard(i, -1)}
              disabled={i === 0}
              className="rounded px-1 py-0.5 text-xs text-foreground-secondary hover:bg-surface-hover disabled:opacity-30"
              title="上移"
            >↑</button>
            <button
              onClick={() => moveCard(i, 1)}
              disabled={i === items.length - 1}
              className="rounded px-1 py-0.5 text-xs text-foreground-secondary hover:bg-surface-hover disabled:opacity-30"
              title="下移"
            >↓</button>
            <button
              onClick={() => removeCard(i)}
              className="rounded px-1 py-0.5 text-xs text-red hover:bg-red/10"
              title="删除卡片"
            >✕</button>
          </div>
          {/* kit 模式下显示 weight 选择 */}
          {iconType === 'kit' && item.icon && (
            <div className="flex items-center gap-1 pl-7">
              <span className="text-[9px] text-foreground-muted">风格</span>
              {(['thin', 'light', 'regular', 'bold', 'fill', 'duotone'] as IconWeight[]).map((w) => (
                <button
                  key={w}
                  onClick={() => updateItem(i, { iconWeight: w })}
                  className={`rounded px-1 py-0.5 text-[9px] ${(item.iconWeight ?? 'regular') === w ? 'bg-accent-primary/10 text-accent-primary' : 'text-foreground-muted hover:bg-surface-hover'}`}
                >{w}</button>
              ))}
            </div>
          )}
          <textarea
            value={item.body ?? ''}
            placeholder="卡片正文"
            onChange={(e) => updateItem(i, { body: e.target.value })}
            rows={2}
            className="w-full resize-none rounded border border-border-default px-2 py-1 text-xs"
          />
          <input
            type="text"
            value={item.footer ?? ''}
            placeholder="底部备注（可选）"
            onChange={(e) => updateItem(i, { footer: e.target.value })}
            className="w-full rounded border border-border-default px-2 py-0.5 text-xs"
          />
        </div>
        );
      })}
      <button
        onClick={addCard}
        className="w-full rounded-lg border border-dashed border-border-default px-3 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover"
      >
        + 添加卡片
      </button>
      <div className="mt-2 flex items-center gap-2">
        <label className="text-xs text-foreground-secondary">卡片间距</label>
        <input
          type="number"
          value={data.gap ?? 16}
          onChange={(e) => updateComp(comp.id, (d) => { d.gap = Number(e.target.value); })}
          className="w-16 rounded border border-border-default px-2 py-0.5 text-xs"
        />
        <span className="text-xs text-foreground-muted">px</span>
      </div>

      {/* Icon picker overlay */}
      {pickerFor !== null && (
        <IconPickerOverlay
          value={items[pickerFor]?.icon}
          weight={items[pickerFor]?.iconWeight ?? 'regular'}
          onPick={(key) => {
            updateItem(pickerFor, { icon: key, iconType: 'kit' });
            setPickerFor(null);
          }}
          onClear={() => {
            updateItem(pickerFor, { icon: '' });
            setPickerFor(null);
          }}
          onClose={() => setPickerFor(null)}
        />
      )}
    </div>
  );
}
