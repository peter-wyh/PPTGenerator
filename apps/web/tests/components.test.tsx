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
  Legend: () => null,
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
  TitleBlock,
} from '@/editor/components/BasicComponents';

describe('basic components render', () => {
  it('text renders content', () => {
    render(<TextComponent data={{ content: '你好世界', fontSize: 14, color: '#000' }} />);
    expect(screen.getByText('你好世界')).toBeInTheDocument();
  });

  it('indicator card renders title + value', () => {
    render(
      <IndicatorCardComponent
        data={{ title: 'GMV', value: '$1,200', colorTheme: 'orange' }}
      />,
    );
    expect(screen.getByText('GMV')).toBeInTheDocument();
    expect(screen.getByText('$1,200')).toBeInTheDocument();
  });

  it('table renders headers and cells', () => {
    render(<TableComponent data={{ headers: ['A', 'B'], rows: [['1', '2']] }} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('image shows placeholder when no src', () => {
    render(<ImageComponent data={{ src: '', fit: 'cover' }} />);
    expect(screen.getByText('Image placeholder')).toBeInTheDocument();
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
  const base = { title: 'GMV', value: '$1,200', colorTheme: 'orange' as const };

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

describe('TitleBlock underline variant (色块下划线)', () => {
  const base = { variant: 'underline' as const, text: '章节标题', subtitle: '副标题' };

  // underline 变体里只有色块条带 inline backgroundColor；借此选中它。
  const underlineBar = (container: HTMLElement) =>
    container.querySelector('[style*="background-color"]') as HTMLElement;

  it('色块条带为 20% 宽、6px 高、大圆角胶囊', () => {
    const { container } = render(<TitleBlock data={base} />);
    const bar = underlineBar(container);
    expect(bar).toBeTruthy();
    expect(bar.className).toContain('w-1/5');
    expect(bar.className).toContain('h-1.5');
    expect(bar.className).toContain('rounded-full');
  });

  it('色块条带与标题重叠且底对齐', () => {
    const { container } = render(<TitleBlock data={base} />);
    const bar = underlineBar(container);
    // 绝对定位贴标题底部 → 底对齐，并落在文字之后实现重叠
    expect(bar.className).toContain('absolute');
    expect(bar.className).toContain('bottom-0');
  });

  it('颜色缺省为品牌色', () => {
    const { container } = render(<TitleBlock data={base} />);
    expect(underlineBar(container).style.backgroundColor).toBe('var(--color-primary)');
  });

  it('underlineColor=brand 显式品牌色', () => {
    const { container } = render(<TitleBlock data={{ ...base, underlineColor: 'brand' }} />);
    expect(underlineBar(container).style.backgroundColor).toBe('var(--color-primary)');
  });

  it('underlineColor=black 渲染为纯黑', () => {
    const { container } = render(<TitleBlock data={{ ...base, underlineColor: 'black' }} />);
    expect(underlineBar(container).style.backgroundColor).toBe('rgb(0, 0, 0)');
  });
});

describe('title-block block-underline variant', () => {
  it('色块颜色跟随标题颜色（默认黑色），宽≈标题文字 60%，粗标记笔质感', () => {
    const { container } = render(
      <TitleBlock data={{ variant: 'block-underline', text: '区域销售' } as any} />,
    );
    expect(screen.getByText('区域销售')).toBeInTheDocument();
    // 色块颜色 = titleFg（默认 #000000 → rgb(0, 0, 0)）
    const bars = Array.from(container.querySelectorAll('div')).filter(
      (d) => (d as HTMLElement).style.backgroundColor === 'rgb(0, 0, 0)',
    );
    expect(bars).toHaveLength(1); // 仅一条色块
    expect(bars[0].className).toContain('w-[60%]'); // 宽≈标题文字 60%
    expect(bars[0].className).toContain('h-2'); // 粗(标记笔质感)
  });
  it('titleColor=brand 时色块也跟随品牌色', () => {
    const { container } = render(
      <TitleBlock data={{ variant: 'block-underline', text: '区域销售', titleColor: 'brand' } as any} />,
    );
    // 标题和色块都使用 var(--color-primary)
    const titleEl = screen.getByText('区域销售');
    expect((titleEl as HTMLElement).style.color).toBe('var(--color-primary)');
    const bars = Array.from(container.querySelectorAll('div')).filter(
      (d) => (d as HTMLElement).style.backgroundColor === 'var(--color-primary)',
    );
    expect(bars).toHaveLength(1);
  });
});
