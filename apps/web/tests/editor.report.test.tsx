import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getDefaultData } from '@/editor/defaults';
import { REGISTRY } from '@/editor/registry';
import { TEMPLATES } from '@/editor/templates';
import { KpiBoard, TimelineCompare } from '@/editor/components/ReportComponents';

describe('report components — render', () => {
  it('kpi-board renders labels + values', () => {
    render(
      <KpiBoard
        data={{
          variant: 'grid',
          headers: ['指标', '数值', '对比'],
          rows: [
            ['Sales', '¥1.24M', '+15%'],
            ['Clicks', '120K', '-3%'],
          ],
        }}
      />,
    );
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('¥1.24M')).toBeInTheDocument();
    expect(screen.getByText('+15%')).toBeInTheDocument();
    expect(screen.getByText('-3%')).toBeInTheDocument();
  });

  it('timeline-compare renders rows + status chips', () => {
    render(
      <TimelineCompare
        data={{
          variant: 'standard',
          headers: ['指标', '本期', '上期', '状态'],
          rows: [['Total Sales', '¥1.24M', '¥1.08M', 'Exceeded']],
        }}
      />,
    );
    expect(screen.getByText('Total Sales')).toBeInTheDocument();
    expect(screen.getAllByText('¥1.24M').length).toBeGreaterThan(0);
    expect(screen.getByText('Exceeded')).toBeInTheDocument();
  });

  it('every variant renders without throwing', () => {
    for (const v of ['grid', 'row', 'compact'] as const) {
      const { unmount } = render(
        <KpiBoard data={{ variant: v, headers: ['指标', '数值', '对比'], rows: [['A', '1', '+1%']] }} />,
      );
      expect(screen.getByText('A')).toBeInTheDocument();
      unmount();
    }
    for (const v of ['standard', 'mini', 'with-bar'] as const) {
      const { unmount } = render(
        <TimelineCompare
          data={{ variant: v, headers: ['指标', '本期', '上期', '状态'], rows: [['A', '10', '8', 'Exceeded']] }}
        />,
      );
      expect(screen.getByText('A')).toBeInTheDocument();
      unmount();
    }
  });
});

describe('report components — defaults / registry', () => {
  it('getDefaultData returns table-shape + variant', () => {
    const kpi = getDefaultData('kpi-board') as { variant: string; headers: string[]; rows: string[][] };
    expect(kpi.variant).toBe('grid');
    expect(kpi.headers.length).toBe(3);
    expect(kpi.rows.length).toBeGreaterThan(0);

    const tl = getDefaultData('timeline-compare') as { variant: string; headers: string[] };
    expect(tl.variant).toBe('standard');
    expect(tl.headers.length).toBe(4);
  });

  it('REGISTRY has both with variants', () => {
    for (const t of ['kpi-board', 'timeline-compare'] as const) {
      expect(REGISTRY[t].variants?.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('campaign report page templates', () => {
  const find = (id: string) => TEMPLATES.find((t) => t.id === id)!;
  const types = (id: string) => find(id).components().map((c) => c.type);

  it('report-weekly-overview = title + kpi-board + plan text', () => {
    const t = types('report-weekly-overview');
    expect(t).toContain('kpi-board');
    expect(t.filter((x) => x === 'text').length).toBeGreaterThanOrEqual(1);
  });

  it('report-monthly-overview = title + kpi + bar-chart + timeline + insight', () => {
    const t = types('report-monthly-overview');
    expect(t).toContain('kpi-board');
    expect(t).toContain('bar-chart');
    expect(t).toContain('timeline-compare');
  });

  it('report-channel = title + compact kpi-board + table', () => {
    const comps = find('report-channel').components();
    const kpi = comps.find((c) => c.type === 'kpi-board')!;
    expect((kpi.data as { variant: string }).variant).toBe('compact'); // 验证模板内可调变体
    expect(comps.map((c) => c.type)).toContain('table');
  });

  it('report-wrapup-review = title + kpi + timeline(with-bar) + text', () => {
    const comps = find('report-wrapup-review').components();
    const tl = comps.find((c) => c.type === 'timeline-compare')!;
    expect((tl.data as { variant: string }).variant).toBe('with-bar');
    expect(comps.map((c) => c.type)).toContain('kpi-board');
  });
});
