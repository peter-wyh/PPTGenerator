import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PropertyPanel } from '@/editor/PropertyPanel';
import { useEditorStore } from '@/editor/store';
import { KpiBoard } from '@/editor/components/ReportComponents';
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
      rows: [['Sales', '¥1.24M', '+15%']],
      icons: ['currency'],
      valueColors: ['success'],
    };
    const { container } = render(<KpiBoard data={data} />);
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('¥1.24M')).toBeInTheDocument();
    expect(screen.getByText('+15%')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeTruthy(); // 图标渲染出 svg
  });

  it('无图标时不渲染图标块（无 svg）', () => {
    const { container } = render(
      <KpiBoard data={{ variant: 'card', headers: ['指标', '数值', '对比'], rows: [['Sales', '¥1.24M', '']] }} />,
    );
    expect(screen.getByText('¥1.24M')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('valueColors 非 primary 时给 value 上 inline 色', () => {
    const { container } = render(
      <KpiBoard data={{
        variant: 'card', headers: ['指标', '数值', '对比'],
        rows: [['A', '10', '']], valueColors: ['danger'],
      }} />,
    );
    const valueEl = container.querySelector('.font-data') as HTMLElement;
    expect(valueEl.style.color).toBe('rgb(239, 68, 68)'); // #EF4444
  });
});

describe('KpiBoard · grid/row 去边框', () => {
  it('grid 无 border class、无外层 padding', () => {
    const { container } = render(
      <KpiBoard data={{ variant: 'grid', headers: ['指标', '数值', '对比'], rows: [['A', '1', '']] }} />,
    );
    expect(container.querySelector('.border-border-default')).toBeNull();
    expect(container.querySelector('.border-border-subtle')).toBeNull();
    expect(container.querySelector('.bg-surface-primary')).toBeNull();
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
    expect(valueEl.style.color).toBe('rgb(59, 130, 246)'); // #3B82F6
  });

  it('compact 保持有外层 border（回归保护）', () => {
    const { container } = render(
      <KpiBoard data={{ variant: 'compact', headers: ['指标', '数值', '对比'], rows: [['A', '1', '']] }} />,
    );
    expect(container.querySelector('.border-border-default')).toBeTruthy();
  });
});

describe('kpi-board 注册与默认数据', () => {
  it('REGISTRY 暴露 4 个 variant（含 card）', () => {
    const def = REGISTRY['kpi-board'];
    const ids = def.variants?.map((v) => v.id);
    expect(ids).toEqual(['grid', 'row', 'compact', 'card']);
  });

  it('默认数据含 icons 与 valueColors 示例', () => {
    const data = getDefaultData('kpi-board') as KpiBoardData;
    expect(data.icons?.length).toBeGreaterThan(0);
    expect(data.valueColors?.length).toBeGreaterThan(0);
    expect(data.icons?.length).toBe(data.rows.length);
    expect(data.valueColors?.length).toBe(data.rows.length);
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

    fireEvent.click(screen.getByRole('button', { name: '导入 Excel/CSV' }));
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
