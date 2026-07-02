import { describe, it, expect } from 'vitest';
import { resolveData } from '@/editor/datasource/resolve';
import type { Datasource, EditorComponent } from '@mediakit/shared';

const ds: Datasource = {
  id: 'ds1',
  name: '销售',
  columns: ['月份', 'GMV'],
  rows: [
    { 月份: '1月', GMV: '120' },
    { 月份: '2月', GMV: '1,800' },
    { 月份: 'bad', GMV: 'x' },
  ],
};

function comp(type: EditorComponent['type'], binding?: EditorComponent['binding']): EditorComponent {
  return {
    id: 'c',
    type,
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    data: { title: '原标题', bars: [], slices: [], series: [], headers: [], rows: [] } as never,
    binding,
  };
}

describe('resolveData', () => {
  it('returns original data when no binding', () => {
    const c = comp('bar-chart');
    expect(resolveData(c, [ds])).toBe(c.data);
  });

  it('returns original data when datasource missing', () => {
    const c = comp('bar-chart', { datasourceId: 'nope', valueColumn: 'GMV' });
    expect(resolveData(c, [ds])).toBe(c.data);
  });

  it('bar-chart: derives bars from label/value columns (parses numbers, strips commas)', () => {
    const c = comp('bar-chart', { datasourceId: 'ds1', labelColumn: '月份', valueColumn: 'GMV' });
    const data = resolveData(c, [ds]) as { bars: { label: string; value: number }[] };
    expect(data.bars).toHaveLength(3);
    expect(data.bars[0]).toMatchObject({ label: '1月', value: 120 });
    expect(data.bars[1].value).toBe(1800); // 1,800 → 1800
    expect(data.bars[2].value).toBe(0); // 'x' → 0
  });

  it('line-chart: derives a single series of points', () => {
    const c = comp('line-chart', { datasourceId: 'ds1', labelColumn: '月份', valueColumn: 'GMV' });
    const data = resolveData(c, [ds]) as { series: { points: { label: string; value: number }[] }[] };
    expect(data.series[0].points).toHaveLength(3);
    expect(data.series[0].points[0]).toMatchObject({ label: '1月', value: 120 });
  });

  it('pie-chart: derives slices', () => {
    const c = comp('pie-chart', { datasourceId: 'ds1', labelColumn: '月份', valueColumn: 'GMV' });
    const data = resolveData(c, [ds]) as { slices: { label: string }[] };
    expect(data.slices).toHaveLength(3);
    expect(data.slices[0].label).toBe('1月');
  });

  it('table: renders the full datasource table', () => {
    const c = comp('table', { datasourceId: 'ds1' });
    const data = resolveData(c, [ds]) as { headers: string[]; rows: string[][] };
    expect(data.headers).toEqual(['月份', 'GMV']);
    expect(data.rows[1]).toEqual(['2月', '1,800']);
  });
});
