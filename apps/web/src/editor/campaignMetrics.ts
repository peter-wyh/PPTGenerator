import type { CampaignMetric, KpiColorToken, KpiTrendDirection } from '@mediakit/shared';

/**
 * 把 Campaign 投放表现指标映射为 kpi-board 数据补丁。
 * - headers 固定 [指标, 数值, 对比]；
 * - 每条 metric → 一行 [label, value, compare]；
 * - icons / valueColors 按行数置空（干净起点；对比单元格由渲染器按 +/- 自动着色）。
 * 保留 variant / iconWeight 由调用处展开（见 ImportCampaignButton）。
 */
export interface KpiRowsPatch {
  headers: string[];
  rows: string[][];
  icons: (string | null)[];
  valueColors: (KpiColorToken | null)[];
  trendDirections: (KpiTrendDirection | null)[];
}

export function metricsToRows(metrics: CampaignMetric[]): KpiRowsPatch {
  const rows = metrics.map((mm) => [mm.label, mm.value, mm.compare]);
  return {
    headers: ['指标', '数值', '对比'],
    rows,
    icons: rows.map(() => null),
    valueColors: rows.map(() => null),
    trendDirections: rows.map(() => null),
  };
}
