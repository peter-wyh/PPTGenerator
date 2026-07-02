import { describe, it, expect, beforeEach } from 'vitest';
import { parseCSV } from '@/editor/datasource/parse';
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
  rows: [
    { 月份: '1月', GMV: '120' },
    { 月份: '2月', GMV: '180' },
    { 月份: '3月', GMV: '90' },
  ],
};

describe('CSV parser', () => {
  it('parses headers and rows', () => {
    const csv = '月份,GMV\n1月,120\n2月,180';
    const d = parseCSV(csv, '销售');
    expect(d.columns).toEqual(['月份', 'GMV']);
    expect(d.rows).toHaveLength(2);
    expect(d.rows[0]).toEqual({ 月份: '1月', GMV: '120' });
  });

  it('handles quoted fields with commas and escaped quotes', () => {
    const csv = 'name,note\n"a,b","say ""hi"""';
    const d = parseCSV(csv);
    expect(d.rows[0]).toEqual({ name: 'a,b', note: 'say "hi"' });
  });

  it('handles CRLF line endings', () => {
    const csv = 'a,b\r\n1,2\r\n3,4\r\n';
    const d = parseCSV(csv);
    expect(d.rows).toHaveLength(2);
    expect(d.rows[1]).toEqual({ a: '3', b: '4' });
  });
});

describe('datasource store', () => {
  beforeEach(() => useEditorStore.getState().loadProject(detail, 'p'));

  it('addDatasource / removeDatasource', () => {
    useEditorStore.getState().addDatasource(ds);
    expect(useEditorStore.getState().datasources).toHaveLength(1);
    useEditorStore.getState().removeDatasource('ds1');
    expect(useEditorStore.getState().datasources).toHaveLength(0);
  });

  it('bindComponent sets binding and commits history', () => {
    useEditorStore.getState().addComponent('bar-chart');
    const id = useEditorStore.getState().currentComponents()[0].id;
    const before = useEditorStore.getState().historyIndex;
    useEditorStore.getState().bindComponent(id, { datasourceId: 'ds1', labelColumn: '月份', valueColumn: 'GMV' });
    const c = useEditorStore.getState().currentComponents()[0];
    expect(c.binding).toEqual({ datasourceId: 'ds1', labelColumn: '月份', valueColumn: 'GMV' });
    expect(useEditorStore.getState().historyIndex).toBe(before + 1);
  });

  it('bindComponent with null clears binding', () => {
    useEditorStore.getState().addComponent('bar-chart');
    const id = useEditorStore.getState().currentComponents()[0].id;
    useEditorStore.getState().bindComponent(id, { datasourceId: 'ds1', valueColumn: 'GMV' });
    useEditorStore.getState().bindComponent(id, null);
    expect(useEditorStore.getState().currentComponents()[0].binding).toBeUndefined();
  });
});
