import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// recharts 在 jsdom 下依赖 ResizeObserver/尺寸，这里整体桩成轻量 div。
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar">{children}</div>,
  Bar: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: () => null,
}));

import {
  BarChartComponent,
  ImageComponent,
  IndicatorCardComponent,
  LineChartComponent,
  PieChartComponent,
  TableComponent,
  TextComponent,
} from '@/editor/components/BasicComponents';

describe('basic components render', () => {
  it('text renders content', () => {
    render(<TextComponent data={{ content: '你好世界', fontSize: 14, color: '#000' }} />);
    expect(screen.getByText('你好世界')).toBeInTheDocument();
  });

  it('indicator card renders title + value', () => {
    render(
      <IndicatorCardComponent
        data={{ title: 'GMV', value: '¥1,200', colorTheme: 'orange' }}
      />,
    );
    expect(screen.getByText('GMV')).toBeInTheDocument();
    expect(screen.getByText('¥1,200')).toBeInTheDocument();
  });

  it('table renders headers and cells', () => {
    render(<TableComponent data={{ headers: ['A', 'B'], rows: [['1', '2']] }} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('image shows placeholder when no src', () => {
    render(<ImageComponent data={{ src: '', fit: 'cover' }} />);
    expect(screen.getByText('图片占位')).toBeInTheDocument();
  });

  it('bar chart renders its title', () => {
    render(
      <BarChartComponent
        data={{
          title: '月度趋势',
          bars: [{ label: 'A', value: 1, color: '#FF5C00' }],
        }}
      />,
    );
    expect(screen.getByText('月度趋势')).toBeInTheDocument();
  });

  it('line chart renders without throwing', () => {
    render(
      <LineChartComponent
        data={{
          title: 'L',
          series: [{ name: 's', color: '#F00', points: [{ label: 'x', value: 1 }] }],
        }}
      />,
    );
    expect(screen.getByText('L')).toBeInTheDocument();
  });

  it('pie chart renders without throwing', () => {
    render(
      <PieChartComponent
        data={{
          title: 'P',
          slices: [{ label: 'a', value: 1, color: '#F00' }],
        }}
      />,
    );
    expect(screen.getByText('P')).toBeInTheDocument();
  });
});

describe('IndicatorCardComponent variants', () => {
  const base = { title: 'GMV', value: '¥1,200', colorTheme: 'orange' as const };

  it('plain renders no icon (backward compatible)', () => {
    const { container } = render(<IndicatorCardComponent data={{ ...base, variant: 'plain' }} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('omitting variant behaves as plain (legacy data)', () => {
    const { container } = render(<IndicatorCardComponent data={base} />);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent).toContain('GMV');
  });

  it('icon-left renders an svg (uses variant default key when data.icon absent)', () => {
    const { container } = render(
      <IndicatorCardComponent data={{ ...base, variant: 'icon-left' }} />
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('icon-top renders an svg', () => {
    const { container } = render(
      <IndicatorCardComponent data={{ ...base, variant: 'icon-top', icon: 'eye', iconWeight: 'bold' }} />
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('icon-bg renders an svg', () => {
    const { container } = render(
      <IndicatorCardComponent data={{ ...base, variant: 'icon-bg' }} />
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
