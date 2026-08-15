import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateFromTemplateDialog } from '@/components/CreateFromTemplateDialog';

const listMock = vi.fn();
vi.mock('@/api/templates', () => ({
  templatesApi: {
    list: (...args: unknown[]) => listMock(...(args as [object?])),
  },
}));

// 业务线查找表(数据库唯一来源)——mock 返回 DB 快照
vi.mock('@/api/lookup', () => ({
  lookupApi: {
    listBusinessLines: vi.fn().mockResolvedValue([
      { id: 'bl-ft', code: 'FT', name: 'Fanstoshop' },
      { id: 'bl-sm', code: 'SM', name: 'SmileKOLs' },
    ]),
    listAdvertisers: vi.fn().mockResolvedValue([]),
    listMerchants: vi.fn().mockResolvedValue([]),
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

  it('选择业务线后带参重新拉取', async () => {
    listMock.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<CreateFromTemplateDialog open onCancel={() => {}} onSubmit={() => {}} />);
    await waitFor(() => expect(listMock).toHaveBeenCalledWith({ status: 'PUBLISHED' }));
    await user.selectOptions(screen.getByLabelText('业务线'), 'FT');
    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith({ status: 'PUBLISHED', businessLine: 'FT' }));
  });

  it('切换场景清空模版类型(不带旧 templateType 重新拉取)', async () => {
    listMock.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<CreateFromTemplateDialog open onCancel={() => {}} onSubmit={() => {}} />);
    await waitFor(() => expect(listMock).toHaveBeenCalled());
    await user.selectOptions(screen.getByLabelText('场景'), 'media-kit');
    await user.selectOptions(screen.getByLabelText('模版类型'), 'brand');
    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith(expect.objectContaining({ templateType: 'brand' })));
    // 切到 campaign-report:模版类型应被清空,refetch 不带 templateType
    await user.selectOptions(screen.getByLabelText('场景'), 'campaign-report');
    await waitFor(() =>
      expect(listMock).toHaveBeenLastCalledWith(expect.not.objectContaining({ templateType: expect.anything() })),
    );
  });
});
