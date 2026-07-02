import type { Datasource, EditorComponent } from '@mediakit/shared';
import type { BarChartData, LineChartData, PieChartData, TableData } from '@mediakit/shared';

/**
 * 若组件绑定了数据源，按列派生 chart/table 的 data；否则返回原 data。
 * - bar/pie：labelColumn → 标签，valueColumn → 数值。
 * - line：labelColumn 为 X 轴，valueColumn 单系列。
 * - table：整张表（所有列/行）。
 */
export function resolveData(
  comp: EditorComponent,
  datasources: Datasource[],
): EditorComponent['data'] {
  const b = comp.binding;
  if (!b) return comp.data;

  const ds = datasources.find((d) => d.id === b.datasourceId);
  if (!ds) return comp.data;

  switch (comp.type) {
    case 'bar-chart': {
      const bars = ds.rows
        .map((r) => ({ label: String(r[b.labelColumn ?? ''] ?? ''), value: num(r[b.valueColumn ?? '']), color: pickColor(0) }))
        .filter((_, i) => i < 20);
      // 多色
      const palette = ['#FF5C00', '#3B82F6', '#22C55E', '#8B5CF6', '#F59E0B'];
      bars.forEach((bar, i) => (bar.color = palette[i % palette.length]));
      return { title: (comp.data as BarChartData).title ?? '', bars } as BarChartData;
    }
    case 'pie-chart': {
      const palette = ['#FF5C00', '#3B82F6', '#22C55E', '#8B5CF6', '#F59E0B'];
      const slices = ds.rows.map((r) => ({
        label: String(r[b.labelColumn ?? ''] ?? ''),
        value: num(r[b.valueColumn ?? '']),
        color: palette[0],
      }));
      slices.forEach((s, i) => (s.color = palette[i % palette.length]));
      return { title: (comp.data as PieChartData).title ?? '', slices } as PieChartData;
    }
    case 'line-chart': {
      const points = ds.rows.map((r) => ({
        label: String(r[b.labelColumn ?? ''] ?? ''),
        value: num(r[b.valueColumn ?? '']),
      }));
      return {
        title: (comp.data as LineChartData).title ?? '',
        series: [{ name: b.valueColumn ?? '系列', color: '#FF5C00', points }],
      } as LineChartData;
    }
    case 'table': {
      const headers = ds.columns;
      const rows = ds.rows.map((r) => headers.map((h) => String(r[h] ?? '')));
      return { headers, rows } as TableData;
    }
    default:
      return comp.data;
  }
}

function num(v: string): number {
  const n = Number(String(v).replace(/[,，]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function pickColor(i: number): string {
  return ['#FF5C00', '#3B82F6', '#22C55E', '#8B5CF6', '#F59E0B'][i % 5];
}
