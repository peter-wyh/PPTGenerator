import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatasourceMenu } from '@/editor/components/DatasourceMenu';
import { PropertyPanel } from '@/editor/PropertyPanel';
import { useEditorStore } from '@/editor/store';
import type { Datasource, ProjectDetail } from '@mediakit/shared';

const detail: ProjectDetail = {
  id: 'p',
  name: 'p',
  width: 1280,
  height: 720,
  pages: [{ id: 'pg', name: 'pg', components: [] }],
  createdAt: '',
  updatedAt: '',
};

const ds: Datasource = {
  id: 'ds1',
  name: '销售',
  columns: ['月份', 'GMV'],
  rows: [{ 月份: '1月', GMV: '120' }],
};

describe('DatasourceMenu', () => {
  beforeEach(() => useEditorStore.getState().loadProject(detail, 'p'));

  it('shows empty hint when no datasources', async () => {
    const user = userEvent.setup();
    render(<DatasourceMenu />);
    await user.click(screen.getByText('数据源 ▾'));
    expect(screen.getByText(/尚无数据源/)).toBeInTheDocument();
  });

  it('lists a datasource after adding', async () => {
    const user = userEvent.setup();
    useEditorStore.getState().addDatasource(ds);
    render(<DatasourceMenu />);
    await user.click(screen.getByText('数据源 ▾'));
    expect(screen.getByText('销售')).toBeInTheDocument();
    expect(screen.getByText(/2 列 · 1 行/)).toBeInTheDocument();
  });

  it('removes a datasource', async () => {
    const user = userEvent.setup();
    useEditorStore.getState().addDatasource(ds);
    render(<DatasourceMenu />);
    await user.click(screen.getByText('数据源 ▾'));
    await user.click(screen.getAllByText('✕')[0]);
    expect(useEditorStore.getState().datasources).toHaveLength(0);
  });
});

describe('BindingEditor', () => {
  beforeEach(() => {
    useEditorStore.getState().loadProject(detail, 'p');
    useEditorStore.getState().addDatasource(ds);
  });

  it('binds a bar-chart to the datasource via the property panel', async () => {
    const user = userEvent.setup();
    useEditorStore.getState().addComponent('bar-chart');
    const id = useEditorStore.getState().currentComponents()[0].id;
    useEditorStore.getState().select(id);
    render(<PropertyPanel />);

    // 数据源 select：选 销售选项（value=ds1）
    const select = screen.getByDisplayValue('（未绑定）');
    await user.selectOptions(select, 'ds1');
    const c = useEditorStore.getState().currentComponents()[0];
    expect(c.binding).toBeDefined();
    expect(c.binding?.datasourceId).toBe('ds1');
    expect(c.binding?.labelColumn).toBe('月份');
    expect(c.binding?.valueColumn).toBe('GMV');
  });
});
