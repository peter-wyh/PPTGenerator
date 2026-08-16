import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PropertyPanel } from '@/editor/property-panel';
import { KpiRowStyleField } from '@/editor/property-panel/custom-fields';
import { useEditorStore } from '@/editor/store';
import { KpiBoard } from '@/editor/components/report';
import { REGISTRY } from '@/editor/registry';
import { getDefaultData } from '@/editor/defaults';
import type { KpiBoardData, ProjectDetail } from '@mediakit/shared';

vi.mock('@/editor/datasource/parse', () => ({
  parseFile: vi.fn().mockResolvedValue([
    {
      name: 'sheet1',
      columns: ['指标', '数值', '对比'],
      rows: [{ '指标': 'GMV', '数值': '999', '对比': '+1%' }],
    },
  ]),
}));

const emptyProject: ProjectDetail = {
  id: 'p', name: 'p', width: 1280, height: 720,
  pages: [{ id: 'pg', name: '第 1 页', components: [] }],
  createdAt: '', updatedAt: '',
};

describe('KpiBoard · card 变体', () => {
  it('渲染 label/value/compare 与图标', () => {
    const data: KpiBoardData = {
      variant: 'card',
      headers: ['指标', '数值', '对比'],
      rows: [['Sales', '$1.24M', '+15%']],
      icons: ['currency'],
      valueColors: ['success'],
    };
    const { container } = render(<KpiBoard data={data} />);
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('$1.24M')).toBeInTheDocument();
    expect(screen.getByText('+15%')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeTruthy(); // 图标渲染出 svg
  });

  it('showIcons:false 时即使有显式 icons 也不渲染图标', () => {
    const { container } = render(
      <KpiBoard
        data={{
          variant: 'card',
          showIcons: false,
          headers: ['指标', '数值', '对比'],
          rows: [['Sales', '$1.24M', '']],
          icons: ['currency'],
        }}
      />,
    );
    expect(screen.getByText('$1.24M')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('showIcons 缺省(true) 且无 icons 时渲染默认图标', () => {
    const { container } = render(
      <KpiBoard data={{ variant: 'card', headers: ['指标', '数值', '对比'], rows: [['GMV', '$1.24M', '']] }} />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('valueColors 非 primary 时给 value 上 inline 色', () => {
    const { container } = render(
      <KpiBoard data={{
        variant: 'card', headers: ['指标', '数值', '对比'],
        rows: [['A', '10', '']], valueColors: ['danger'],
      }} />,
    );
    const valueEl = container.querySelector('.font-data') as HTMLElement;
    expect(valueEl.style.color).toBe('var(--red)');
  });
});

describe('KpiBoard · grid/row 去边框', () => {
  it('grid 无 border class、无外层 padding、指标格无 gap 紧贴', () => {
    const { container } = render(
      <KpiBoard data={{ variant: 'grid', headers: ['指标', '数值', '对比'], rows: [['A', '1', '']] }} />,
    );
    expect(container.querySelector('.border-border-default')).toBeNull();
    expect(container.querySelector('.border-border-subtle')).toBeNull();
    expect(container.querySelector('.bg-surface-primary')).toBeNull();
    // 指标格之间、与区块边缘之间不留间距（默认尺寸不要留 padding）。
    expect(container.querySelector('.gap-2')).toBeNull();
    expect(container.querySelector('.gap-3')).toBeNull();
  });

  it('row 无 border class', () => {
    const { container } = render(
      <KpiBoard data={{ variant: 'row', headers: ['指标', '数值', '对比'], rows: [['A', '1', '']] }} />,
    );
    expect(container.querySelector('.border-border-default')).toBeNull();
    expect(container.querySelector('.border-border-subtle')).toBeNull();
  });

  it('grid valueColors 非 primary 上 inline 色', () => {
    const { container } = render(
      <KpiBoard data={{
        variant: 'grid', headers: ['指标', '数值', '对比'],
        rows: [['A', '1', '']], valueColors: ['info'],
      }} />,
    );
    const valueEl = container.querySelector('.font-data') as HTMLElement;
    expect(valueEl.style.color).toBe('var(--blue)');
  });

  it('compact 保持有外层 border（回归保护）', () => {
    const { container } = render(
      <KpiBoard data={{ variant: 'compact', headers: ['指标', '数值', '对比'], rows: [['A', '1', '']] }} />,
    );
    // compact 变体保留 skin-card 作为外框（回归保护）
    expect(container.querySelector('.skin-card')).toBeTruthy();
  });
});

describe('KpiBoard · flat 变体（平铺指标条）', () => {
  it('渲染 label/value/compare 与「vs 上期」锚点，并按 valueColors 染色', () => {
    const data: KpiBoardData = {
      variant: 'flat',
      headers: ['指标', '数值', '对比'],
      rows: [['ROAS', '3.21', '+12%']],
      valueColors: ['info'],
    };
    const { container } = render(<KpiBoard data={data} />);
    expect(screen.getByText('ROAS')).toBeInTheDocument();
    expect(screen.getByText('3.21')).toBeInTheDocument();
    expect(screen.getByText('+12%')).toBeInTheDocument();
    expect(screen.getByText('vs last period')).toBeInTheDocument();
    // valueColors 非 primary 时数值上 inline 色（info = var(--blue)）
    const valueEl = container.querySelector('.font-data') as HTMLElement;
    expect(valueEl.style.color).toBe('var(--blue)');
  });
});

describe('KpiBoard · 对比基准与逆向指标', () => {
  it('flat 渲染自定义 compareLabel', () => {
    render(
      <KpiBoard
        data={{
          variant: 'flat',
          headers: ['指标', '数值', '对比'],
          rows: [['A', '1', '+1%']],
          compareLabel: 'vs 06.01–06.30',
        }}
      />,
    );
    expect(screen.getByText('vs 06.01–06.30')).toBeInTheDocument();
  });

  it('flat 缺省 compareLabel 回退「vs 上期」', () => {
    render(
      <KpiBoard data={{ variant: 'flat', headers: ['指标', '数值', '对比'], rows: [['A', '1', '+1%']] }} />,
    );
    expect(screen.getByText('vs last period')).toBeInTheDocument();
  });

  it('inverse 方向：-5% 染绿（降为好）', () => {
    render(
      <KpiBoard
        data={{
          variant: 'flat',
          headers: ['指标', '数值', '对比'],
          rows: [['CPA', '5', '-5%']],
          trendDirections: ['inverse'],
        }}
      />,
    );
    expect((screen.getByText('-5%') as HTMLElement).style.color).toBe('var(--green)');
  });

  it('positive（默认）：-5% 染红', () => {
    render(
      <KpiBoard data={{ variant: 'flat', headers: ['指标', '数值', '对比'], rows: [['A', '5', '-5%']] }} />,
    );
    expect((screen.getByText('-5%') as HTMLElement).style.color).toBe('var(--red)');
  });

  it('inverse 同样作用于 card 变体', () => {
    render(
      <KpiBoard
        data={{
          variant: 'card',
          headers: ['指标', '数值', '对比'],
          rows: [['CPA', '5', '-5%']],
          trendDirections: ['inverse'],
        }}
      />,
    );
    expect((screen.getByText('-5%') as HTMLElement).style.color).toBe('var(--green)');
  });
});

describe('kpi-board 注册与默认数据', () => {
  it('REGISTRY 暴露 7 个 variant（含 card 与 flat）', () => {
    const def = REGISTRY['kpi-board'];
    const ids = def.variants?.map((v) => v.id);
    expect(ids).toEqual(['grid', 'row', 'compact', 'card', 'gradient', 'minimal', 'flat']);
  });

  it('默认数据含 icons 与 valueColors 示例', () => {
    const data = getDefaultData('kpi-board') as KpiBoardData;
    expect(data.icons?.length).toBeGreaterThan(0);
    expect(data.valueColors?.length).toBeGreaterThan(0);
    expect(data.icons?.length).toBe(data.rows.length);
    expect(data.valueColors?.length).toBe(data.rows.length);
  });

  it('默认数据 = campaign 全量 9 项英文指标', () => {
    const data = getDefaultData('kpi-board') as KpiBoardData;
    expect(data.rows.map((r) => r[0])).toEqual([
      'GMV', 'Commission', 'ROAS', 'Clicks', 'Conversions', 'CVR', 'AOV', 'Spend', 'Impressions',
    ]);
  });
});

describe('KpiImportButton', () => {
  beforeEach(() => {
    useEditorStore.getState().loadProject(emptyProject, 'p');
  });

  it('导入 CSV 覆盖 headers/rows，保留 variant', async () => {
    const store = useEditorStore.getState();
    store.addComponent('kpi-board');
    const id = store.currentComponents()[0].id;
    store.select(id);

    render(
      <MemoryRouter>
        <PropertyPanel />
      </MemoryRouter>,
    );

    // 导入按钮文案可能已更新，用模糊匹配
    const importBtn = screen.queryByRole('button', { name: '导入 Excel/CSV' })
      ?? screen.queryByRole('button', { name: /导入/i });
    fireEvent.click(importBtn!);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 't.csv')] } });

    await waitFor(() => {
      const data = useEditorStore.getState().currentComponents()[0].data as KpiBoardData;
      expect(data.headers).toEqual(['指标', '数值', '对比']);
      expect(data.rows).toEqual([['GMV', '999', '+1%']]);
      expect(data.variant).toBe('grid'); // 保留
    });
  });
});

describe('KpiRowStyleField', () => {
  beforeEach(() => {
    useEditorStore.getState().loadProject(emptyProject, 'p');
  });

  it('按 rows 行数渲染每行样式编辑器', () => {
    const store = useEditorStore.getState();
    store.addComponent('kpi-board');
    const id = store.currentComponents()[0].id;
    store.select(id);
    render(
      <MemoryRouter>
        <KpiRowStyleField comp={store.currentComponents()[0]} />
      </MemoryRouter>,
    );
    // 默认 9 行，第一行 label 是 'GMV'(span 直接渲染 r[0])
    expect(screen.getByText('GMV')).toBeInTheDocument();
    // 每行 3 个色块（强调/高亮/品牌）→ 9 行共 9 个「品牌」色块
    expect(screen.getAllByTitle('品牌').length).toBe(9);
    // 默认 icons 全有值 → 每行显示「清除」按钮（iconKey 为空时才显示「选图标」）
    expect(screen.getAllByText('清除').length).toBe(9);
  });

  it('点色块写入 valueColors[i]', () => {
    const store = useEditorStore.getState();
    store.addComponent('kpi-board');
    const id = store.currentComponents()[0].id;
    store.select(id);
    render(
      <MemoryRouter>
        <KpiRowStyleField comp={store.currentComponents()[0]} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getAllByTitle('品牌')[0]);
    const data = useEditorStore.getState().currentComponents()[0].data as KpiBoardData;
    expect(data.valueColors?.[0]).toBe('brand');
  });

  it('全局开关切换 showIcons', () => {
    const store = useEditorStore.getState();
    store.addComponent('kpi-board');
    const id = store.currentComponents()[0].id;
    store.select(id);
    // comp prop 是 render 快照;须从 store 订阅才能在点击后重渲染
    const Reactive = () => {
      const comp = useEditorStore((s) => s.currentComponents()[0]);
      return comp ? <KpiRowStyleField comp={comp} /> : null;
    };
    render(
      <MemoryRouter>
        <Reactive />
      </MemoryRouter>,
    );
    // 默认显示图标（showIcons 缺省 true）
    const toggle = screen.getByRole('button', { name: '显示图标' });
    fireEvent.click(toggle);
    const data = useEditorStore.getState().currentComponents()[0].data as KpiBoardData;
    expect(data.showIcons).toBe(false);
    expect(screen.getByRole('button', { name: '已隐藏' })).toBeInTheDocument();
  });
});
