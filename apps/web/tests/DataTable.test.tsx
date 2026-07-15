import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from '@/components/DataTable';

describe('DataTable onRowClick', () => {
  it('点数据行 → onRowClick(rowIndex)', async () => {
    const onRowClick = vi.fn();
    render(<DataTable loading={false} headers={['A', 'B']} rows={[['x', 'y'], ['z', 'w']]} onRowClick={onRowClick} />);
    const rows = screen.getAllByRole('row'); // [thead row, body row0, body row1]
    await userEvent.click(rows[2]); // 第二条数据行(index 1)
    expect(onRowClick).toHaveBeenCalledWith(1);
  });
  it('不传 onRowClick → tbody 行无 cursor-pointer', () => {
    const { container } = render(<DataTable loading={false} headers={['A']} rows={[['x']]} />);
    expect(container.querySelector('tbody tr')).not.toHaveClass('cursor-pointer');
  });
  it('传 onRowClick → tbody 行有 cursor-pointer', () => {
    const { container } = render(<DataTable loading={false} headers={['A']} rows={[['x']]} onRowClick={vi.fn()} />);
    expect(container.querySelector('tbody tr')).toHaveClass('cursor-pointer');
  });
});
