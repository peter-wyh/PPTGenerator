import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportPreviewModal } from '@/editor/components/ImportPreviewModal';
import type { PreviewItem } from '@/editor/dataImport';

const items: PreviewItem[] = [
  { data: { id: 'c1', name: 'C1', advertiser: 'A', businessLine: 'FT', platform: 'TikTok', startDate: '2026-01-01', endDate: '2026-01-31', budget: '$100K' }, valid: true },
  { data: { id: 'c2', name: 'C2' }, valid: false, error: '缺字段: advertiser, businessLine, ...' },
];

describe('ImportPreviewModal', () => {
  it('展示行数与有效数;有效行可确认', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ImportPreviewModal kind="campaign" items={items} onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText(/共 2 行/)).toBeInTheDocument();
    expect(screen.getByText(/有效 1/)).toBeInTheDocument();
    expect(screen.getByText('C1')).toBeInTheDocument();
    await userEvent.click(screen.getByText(/确认导入/));
    expect(onConfirm).toHaveBeenCalledWith([items[0].data]);
  });
  it('点击遮罩 → onCancel', async () => {
    const onCancel = vi.fn();
    const { container } = render(<ImportPreviewModal kind="campaign" items={items} onConfirm={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(container.firstChild as Element);
    expect(onCancel).toHaveBeenCalled();
  });
  it('全无效时确认按钮 disabled', () => {
    render(<ImportPreviewModal kind="campaign" items={[items[1]]} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/确认导入/)).toBeDisabled();
  });
});
