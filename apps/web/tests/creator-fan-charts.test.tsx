import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// recharts 在 jsdom 下依赖 ResizeObserver/尺寸，整体桩成轻量 div（与 components.test.tsx 同模式）。
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: () => null,
  Cell: () => null,
  Tooltip: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  LabelList: () => null,
}));

import { CreatorFanGender, CreatorFanCity, CreatorFanAge, CreatorFanInterest } from '@/editor/components/CreatorComponents';

describe('creator fan gender (donut)', () => {
  it('renders title, subtitle, slices and center text', () => {
    render(
      <CreatorFanGender
        data={{
          title: '性别占比',
          subtitle: '女性主导',
          center: '女性 62%',
          slices: [
            { label: '女', value: 62, color: '#FF5C00' },
            { label: '男', value: 36, color: '#3B82F6' },
          ],
        }}
      />,
    );
    expect(screen.getByText('性别占比')).toBeInTheDocument();
    expect(screen.getByText('女性主导')).toBeInTheDocument();
    expect(screen.getByText('女性 62%')).toBeInTheDocument();
    expect(screen.getByText('女')).toBeInTheDocument();
    expect(screen.getByText('男')).toBeInTheDocument();
  });

  it('hides subtitle when empty, renders empty-state when no slices', () => {
    const { container } = render(<CreatorFanGender data={{ title: 'T', subtitle: '', slices: [] }} />);
    expect(screen.queryByText('T')).toBeInTheDocument();
    expect(container.textContent).not.toContain('undefined');
  });
});

describe('creator fan city (horizontal bar)', () => {
  it('renders title + subtitle', () => {
    render(
      <CreatorFanCity
        data={{
          title: '城市分布',
          subtitle: '一线占 73%',
          bars: [
            { label: '上海', value: 22, color: '#FF5C00' },
            { label: '北京', value: 14, color: '#22C55E' },
          ],
        }}
      />,
    );
    expect(screen.getByText('城市分布')).toBeInTheDocument();
    expect(screen.getByText('一线占 73%')).toBeInTheDocument();
  });

  it('renders empty-state when bars empty', () => {
    render(<CreatorFanCity data={{ title: 'T', bars: [] }} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });
});

describe('creator fan age (vertical bar)', () => {
  it('renders title + subtitle', () => {
    render(
      <CreatorFanAge
        data={{
          title: '年龄段',
          subtitle: '25-34 主力',
          bars: [
            { label: '18-24', value: 28, color: '#FF5C00' },
            { label: '25-34', value: 38, color: '#22C55E' },
          ],
        }}
      />,
    );
    expect(screen.getByText('年龄段')).toBeInTheDocument();
    expect(screen.getByText('25-34 主力')).toBeInTheDocument();
  });

  it('renders empty-state when bars empty', () => {
    render(<CreatorFanAge data={{ title: 'T', bars: [] }} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });
});

describe('creator fan interest (proportion bars)', () => {
  it('renders title + subtitle + tag labels + percent labels', () => {
    render(
      <CreatorFanInterest
        data={{
          title: '兴趣标签',
          subtitle: '美妆为主',
          tags: [
            { label: '美妆', value: 35, color: '#FF5C00' },
            { label: '美食', value: 28, color: '#3B82F6' },
          ],
        }}
      />,
    );
    expect(screen.getByText('兴趣标签')).toBeInTheDocument();
    expect(screen.getByText('美妆为主')).toBeInTheDocument();
    expect(screen.getByText('美妆')).toBeInTheDocument();
    expect(screen.getByText('美食')).toBeInTheDocument();
    // 35/(35+28)=55.6 → round 56 ; 28/63=44.4 → 44
    expect(screen.getByText('56%')).toBeInTheDocument();
    expect(screen.getByText('44%')).toBeInTheDocument();
  });

  it('hides percent labels when showPercent=false', () => {
    render(
      <CreatorFanInterest
        data={{
          title: 'T',
          tags: [{ label: '美妆', value: 35, color: '#FF5C00' }],
          showPercent: false,
        }}
      />,
    );
    expect(screen.queryByText(/%$/)).toBeNull();
  });

  it('renders empty-state when tags empty', () => {
    render(<CreatorFanInterest data={{ title: 'T', tags: [] }} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });
});

// recharts 在 jsdom 下整体 mock（Cell/Bar/Pie → null），SVG fill 无法从 DOM 断言；
// 但 CreatorFanGender 的图例圆点与 CreatorFanInterest 的占比条是真实 DOM（带 inline
// backgroundColor），可用来验证 color:'auto' 是否被解析为全局 chartPalette 颜色。
// 背景：defaults 里所有 fan 图表数据 color 均为 'auto'，未解析时 'auto' 是非法 CSS 色 →
// SVG fill 渲染为黑色、div 背景透明。DEFAULT_CHART_PALETTE = ['#FF5C00','#3B82F6',...]。
describe("auto color resolution (color:'auto' → global chartPalette)", () => {
  const coloredSpans = (c: HTMLElement) =>
    Array.from(c.querySelectorAll<HTMLElement>('span')).filter((el) => el.style.backgroundColor);
  const coloredDivs = (c: HTMLElement) =>
    Array.from(c.querySelectorAll<HTMLElement>('div')).filter((el) => el.style.backgroundColor);

  it('CreatorFanGender resolves auto slices to palette colors on legend dots', () => {
    const { container } = render(
      <CreatorFanGender
        data={{
          title: 'T',
          slices: [
            { label: 'Female', value: 62, color: 'auto' },
            { label: 'Male', value: 36, color: 'auto' },
          ],
        }}
      />,
    );
    const dots = coloredSpans(container);
    expect(dots.length).toBeGreaterThanOrEqual(2);
    expect(dots[0].style.backgroundColor).toBe('rgb(255, 92, 0)'); // #FF5C00 = palette[0]
    expect(dots[1].style.backgroundColor).toBe('rgb(59, 130, 246)'); // #3B82F6 = palette[1]
  });

  it('CreatorFanInterest resolves auto tags to palette colors on bars', () => {
    const { container } = render(
      <CreatorFanInterest
        data={{
          title: 'T',
          tags: [
            { label: 'Beauty', value: 35, color: 'auto' },
            { label: 'Food', value: 28, color: 'auto' },
          ],
        }}
      />,
    );
    const bars = coloredDivs(container);
    expect(bars.length).toBeGreaterThanOrEqual(2);
    expect(bars[0].style.backgroundColor).toBe('rgb(255, 92, 0)'); // #FF5C00
    expect(bars[1].style.backgroundColor).toBe('rgb(59, 130, 246)'); // #3B82F6
  });
});
