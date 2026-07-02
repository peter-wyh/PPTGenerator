import { useEditorStore } from './store';
import { BusinessLibrary } from './components/BusinessLibrary';
import { DatasourceMenu } from './components/DatasourceMenu';

const TOOLS: { type: 'text' | 'image' | 'bar-chart' | 'line-chart' | 'pie-chart' | 'indicator-card' | 'table'; label: string }[] = [
  { type: 'text', label: '文本' },
  { type: 'image', label: '图片' },
  { type: 'bar-chart', label: '柱状图' },
  { type: 'line-chart', label: '折线图' },
  { type: 'pie-chart', label: '饼图' },
  { type: 'indicator-card', label: '指标卡' },
  { type: 'table', label: '表格' },
];

export function Toolbar() {
  const addComponent = useEditorStore((s) => s.addComponent);
  return (
    <div className="flex h-11 items-center gap-1 border-b border-border-default bg-surface-primary px-3">
      <BusinessLibrary />
      <span className="mx-1 h-4 w-px bg-border-default" />
      {TOOLS.map((t) => (
        <button
          key={t.type}
          onClick={() => addComponent(t.type)}
          className="rounded-lg px-3 py-1.5 text-sm text-foreground-secondary transition hover:bg-surface-hover hover:text-foreground-primary"
        >
          {t.label}
        </button>
      ))}
      <span className="mx-1 h-4 w-px bg-border-default" />
      <DatasourceMenu />
    </div>
  );
}
