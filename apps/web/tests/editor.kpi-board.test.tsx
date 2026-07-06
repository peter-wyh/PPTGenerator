import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiBoard } from '@/editor/components/ReportComponents';
import type { KpiBoardData } from '@mediakit/shared';

describe('KpiBoard · card 变体', () => {
  it('渲染 label/value/compare 与图标', () => {
    const data: KpiBoardData = {
      variant: 'card',
      headers: ['指标', '数值', '对比'],
      rows: [['Sales', '¥1.24M', '+15%']],
      icons: ['currency'],
      valueColors: ['success'],
    };
    const { container } = render(<KpiBoard data={data} />);
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('¥1.24M')).toBeInTheDocument();
    expect(screen.getByText('+15%')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeTruthy(); // 图标渲染出 svg
  });

  it('无图标时不渲染图标块（无 svg）', () => {
    const { container } = render(
      <KpiBoard data={{ variant: 'card', headers: ['指标', '数值', '对比'], rows: [['Sales', '¥1.24M', '']] }} />,
    );
    expect(screen.getByText('¥1.24M')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('valueColors 非 primary 时给 value 上 inline 色', () => {
    const { container } = render(
      <KpiBoard data={{
        variant: 'card', headers: ['指标', '数值', '对比'],
        rows: [['A', '10', '']], valueColors: ['danger'],
      }} />,
    );
    const valueEl = container.querySelector('.font-data') as HTMLElement;
    expect(valueEl.style.color).toBe('rgb(239, 68, 68)'); // #EF4444
  });
});
