import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PeriodPicker } from './PeriodPicker';

describe('PeriodPicker', () => {
  it('有 min/max 时渲染投放区间提示', () => {
    render(
      <PeriodPicker
        value={{ startDate: '2026-08-01', endDate: '2026-08-14' }}
        onChange={() => {}}
        minDate="2026-01-01"
        maxDate="2026-08-14"
        today="2026-08-14"
      />,
    );
    const hint = screen.getByText(/投放区间/);
    expect(hint.textContent).toContain('2026-01-01');
    expect(hint.textContent).toContain('2026-08-14');
  });

  it('点可用预设 → onChange 收到夹交后的区间', () => {
    const onChange = vi.fn();
    render(
      <PeriodPicker
        value={{ startDate: '2026-08-01', endDate: '2026-08-14' }}
        onChange={onChange}
        minDate="2026-01-01"
        maxDate="2026-08-14"
        today="2026-08-14"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '最近30天' }));
    expect(onChange).toHaveBeenCalledWith({ startDate: '2026-07-16', endDate: '2026-08-14' });
  });

  it('非法区间(起>止) → 行内报错 + onValidityChange(false)', () => {
    const onValidityChange = vi.fn();
    render(
      <PeriodPicker
        value={{ startDate: '2026-08-14', endDate: '2026-08-01' }}
        onChange={() => {}}
        onValidityChange={onValidityChange}
      />,
    );
    expect(screen.getByText('起始日期不能晚于结束日期')).toBeTruthy();
    expect(onValidityChange).toHaveBeenLastCalledWith(false);
  });

  it('无 min/max → 不显示投放区间提示(降级)', () => {
    render(<PeriodPicker value={{ startDate: '', endDate: '' }} onChange={() => {}} />);
    expect(screen.queryByText(/投放区间/)).toBeNull();
  });
});
