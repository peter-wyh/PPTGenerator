import { describe, it, expect } from 'vitest';
import { buildChartData, countNonNumeric } from '@/editor/datasource/resolve';
import type { ParsedSheet } from '@/editor/datasource/parse';
import { DEFAULT_CHART_PALETTE } from '@mediakit/shared';

const sheet: ParsedSheet = {
  name: '销售',
  columns: ['月份', 'GMV', '成本'],
  rows: [
    { 月份: '1月', GMV: '120', 成本: '60' },
    { 月份: '2月', GMV: '1,800', 成本: 'x' },
    { 月份: 'bad', GMV: 'x', 成本: '' },
  ],
};

describe('buildChartData', () => {
  it('bar-chart: label + first value column, parses numbers, caps 20, palette colors', () => {
    const data = buildChartData('bar-chart', sheet, { labelColumn: '月份', valueColumns: ['GMV'] }, '原标题') as {
      title: string;
      bars: { label: string; value: number; color: string }[];
    };
    expect(data.title).toBe('原标题');
    expect(data.bars).toHaveLength(3);
    expect(data.bars[0]).toMatchObject({ label: '1月', value: 120 });
    expect(data.bars[1].value).toBe(1800); // 1,800 → 1800
    expect(data.bars[2].value).toBe(0); // 'x' → 0
    expect(data.bars[0].color).toBe(DEFAULT_CHART_PALETTE[0]);
  });

  it('pie-chart: label + first value column', () => {
    const data = buildChartData('pie-chart', sheet, { labelColumn: '月份', valueColumns: ['GMV'] }) as {
      slices: { label: string; value: number }[];
    };
    expect(data.slices).toHaveLength(3);
    expect(data.slices[0]).toMatchObject({ label: '1月', value: 120 });
  });

  it('line-chart: each value column becomes a series (multi-series)', () => {
    const data = buildChartData('line-chart', sheet, { labelColumn: '月份', valueColumns: ['GMV', '成本'] }) as {
      series: { name: string; color: string; points: { label: string; value: number }[] }[];
    };
    expect(data.series).toHaveLength(2);
    expect(data.series[0].name).toBe('GMV');
    expect(data.series[1].name).toBe('成本');
    expect(data.series[0].points[0]).toMatchObject({ label: '1月', value: 120 });
    expect(data.series[1].points[1].value).toBe(0); // 'x' → 0
    expect(data.series[1].color).toBe(DEFAULT_CHART_PALETTE[1]);
  });
});

describe('countNonNumeric', () => {
  it('counts empty and non-numeric cells across given columns', () => {
    // GMV: '120'(ok) '1,800'(ok) 'x'(bad) → 1
    // 成本: '60'(ok) 'x'(bad) ''(bad) → 2
    expect(countNonNumeric(sheet, ['GMV', '成本'])).toBe(3);
  });

  it('returns 0 when all numeric', () => {
    const ok: ParsedSheet = {
      name: 'x',
      columns: ['a', 'b'],
      rows: [{ a: '1', b: '2' }],
    };
    expect(countNonNumeric(ok, ['a', 'b'])).toBe(0);
  });
});
