import { describe, it, expect } from 'vitest';
import { metricsToRows } from '@/editor/campaignMetrics';
import type { CampaignMetric } from '@mediakit/shared';

describe('metricsToRows', () => {
  const metrics: CampaignMetric[] = [
    { label: '花费', value: '$128,000', compare: '+15%' },
    { label: '点击', value: '38,500', compare: '-2%' },
  ];

  it('headers 固定为 [指标, 数值, 对比]', () => {
    expect(metricsToRows(metrics).headers).toEqual(['指标', '数值', '对比']);
  });

  it('每条 metric 映射为一行 [label, value, compare]', () => {
    expect(metricsToRows(metrics).rows).toEqual([
      ['花费', '$128,000', '+15%'],
      ['点击', '38,500', '-2%'],
    ]);
  });

  it('icons / valueColors 长度 = rows 长度，且全为 null', () => {
    const { icons, valueColors, rows } = metricsToRows(metrics);
    expect(icons).toHaveLength(rows.length);
    expect(valueColors).toHaveLength(rows.length);
    expect(icons.every((x) => x === null)).toBe(true);
    expect(valueColors.every((x) => x === null)).toBe(true);
  });

  it('空 metrics → 空 rows / 空 icons / 空 valueColors，headers 仍固定', () => {
    const r = metricsToRows([]);
    expect(r.rows).toEqual([]);
    expect(r.icons).toEqual([]);
    expect(r.valueColors).toEqual([]);
    expect(r.headers).toEqual(['指标', '数值', '对比']);
  });
});
