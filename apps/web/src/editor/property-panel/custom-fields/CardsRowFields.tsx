import { useEditorStore } from '../../store';
import type { EditorComponent, CardsRowData, CardsRowItem } from '@mediakit/shared';

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
      {items.map((item, i) => (
        <div key={i} className="space-y-1.5 rounded-lg border border-border-default p-2.5">
          <div className="flex items-center gap-1.5">
            <span className="flex-none text-[11px] font-bold text-foreground-muted">#{i + 1}</span>
            <input
              type="text"
              value={item.icon ?? ''}
              placeholder="图标 emoji"
              onChange={(e) => updateItem(i, { icon: e.target.value })}
              className="w-14 rounded border border-border-default px-1.5 py-0.5 text-xs"
            />
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
      ))}
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
    </div>
  );
}
