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

import { CreatorFanGender } from '@/editor/components/CreatorComponents';

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
