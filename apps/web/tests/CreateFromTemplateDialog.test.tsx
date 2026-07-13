import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CreateFromTemplateDialog } from '@/components/CreateFromTemplateDialog';

const listMock = vi.fn();
vi.mock('@/api/templates', () => ({
  templatesApi: {
    list: (...args: unknown[]) => listMock(...(args as [object?])),
  },
}));

describe('CreateFromTemplateDialog', () => {
  it('默认模板行显示「默认」徽标', async () => {
    listMock.mockResolvedValue([
      {
        id: 't1', name: '周报', width: 1280, height: 720, pageCount: 3,
        meta: { businessLine: 'FT', scenario: 'campaign-report', templateType: 'weekly', isDefault: true },
        ownerId: 'u1', createdAt: '2026-07-01', updatedAt: '2026-07-01',
      },
    ]);
    render(<CreateFromTemplateDialog open onCancel={() => {}} onSubmit={() => {}} />);
    await waitFor(() => expect(screen.getByText('周报')).toBeInTheDocument());
    expect(screen.getByText('默认')).toBeInTheDocument();
  });

  it('打开时带业务线筛选下拉', async () => {
    listMock.mockResolvedValue([]);
    render(<CreateFromTemplateDialog open onCancel={() => {}} onSubmit={() => {}} />);
    await waitFor(() => expect(listMock).toHaveBeenCalled());
    expect(screen.getByText('业务线')).toBeInTheDocument();
    expect(screen.getByText('场景')).toBeInTheDocument();
  });
});
