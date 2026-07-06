import type { BarChartData, LineChartData, PieChartData } from '@mediakit/shared';
import { DEFAULT_CHART_PALETTE } from '@mediakit/shared';
import type { ParsedSheet } from './parse';

export type ChartType = 'bar-chart' | 'line-chart' | 'pie-chart';

export interface ChartMapping {
  labelColumn: string;
  valueColumns: string[];
}

export type ChartData = BarChartData | LineChartData | PieChartData;

/**
 * 按列映射把 ParsedSheet 派生为对应图表的 data。
 * - bar：labelColumn → 标签，valueColumns[0] → 数值（前 20 行）。
 * - pie：labelColumn → 标签，valueColumns[0] → 数值。
 * - line：labelColumn 为 X 轴，valueColumns 每列一条系列（多系列）。
 * 颜色按 DEFAULT_CHART_PALETTE 轮询；非数值按 0。
 */
export function buildChartData(
  type: ChartType,
  sheet: ParsedSheet,
  mapping: ChartMapping,
  prevTitle?: string,
): ChartData {
  const title = prevTitle ?? '';
  const rows = sheet.rows;
  const palette = DEFAULT_CHART_PALETTE;
  const labelColumn = mapping.labelColumn;

  switch (type) {
    case 'bar-chart': {
      const valueColumn = mapping.valueColumns[0] ?? '';
      const bars = rows
        .map((r, i) => ({
          label: String(r[labelColumn] ?? ''),
          value: num(r[valueColumn]),
          color: palette[i % palette.length],
        }))
        .slice(0, 20);
      return { title, bars } as BarChartData;
    }
    case 'pie-chart': {
      const valueColumn = mapping.valueColumns[0] ?? '';
      const slices = rows.map((r, i) => ({
        label: String(r[labelColumn] ?? ''),
        value: num(r[valueColumn]),
        color: palette[i % palette.length],
      }));
      return { title, slices } as PieChartData;
    }
    case 'line-chart': {
      const series = mapping.valueColumns.map((vc, si) => ({
        name: vc,
        color: palette[si % palette.length],
        points: rows.map((r) => ({
          label: String(r[labelColumn] ?? ''),
          value: num(r[vc]),
        })),
      }));
      return { title, series } as LineChartData;
    }
  }
}

/** 统计某几列中非数值（含空）单元格数，供导入弹框角标提示。 */
export function countNonNumeric(sheet: ParsedSheet, columns: string[]): number {
  let n = 0;
  for (const r of sheet.rows) {
    for (const c of columns) {
      const raw = String(r[c] ?? '').replace(/[,，]/g, '');
      if (raw.trim() === '' || !Number.isFinite(Number(raw))) n++;
    }
  }
  return n;
}

function num(v: string): number {
  const n = Number(String(v).replace(/[,，]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
