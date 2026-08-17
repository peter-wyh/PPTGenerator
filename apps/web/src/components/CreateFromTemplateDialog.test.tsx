import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Campaign, TemplateSummary } from '@mediaket/shared';

const aiHtmlTpl = {
  id: 't1',
  name: 'AI 报告',
  status: 'PUBLISHED',
  meta: { styleType: 'ai-html', campaignId: 'c1', businessLine: 'BL', scenario: 's1', isDefault: false },
} as unknown as TemplateSummary;

// endDate 取 2020-12-31（早于任何运行时今天），保证 max=endDate 确定性。
const campaign = { id: 'c1', startDate: '2020-01-01', endDate: '2020-12-31' } as unknown as Campaign;

// 工厂内不引用顶层常量(vi.mock 会提升到其声明之前)且值会被 clearAllMocks 清掉,
// 故只建空 mock,默认返回值统一在 beforeEach 播种。
vi.mock('@/api/templates', () => ({
  templatesApi: { list: vi.fn() },
}));
vi.mock('@/api/campaigns', () => ({
  getCampaign: vi.fn(),
}));

import { CreateFromTemplateDialog } from './CreateFromTemplateDialog';
import { templatesApi } from '@/api/templates';
import { getCampaign } from '@/api/campaigns';

// vi.clearAllMocks 会清掉 vi.mock 工厂里设置的 mockResolvedValue，故此处重新播种默认值。
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(templatesApi.list).mockResolvedValue([aiHtmlTpl]);
  vi.mocked(getCampaign).mockResolvedValue(campaign);
});

describe('CreateFromTemplateDialog', () => {
  it('ai-html 模板: 拉 Campaign 显示投放区间,默认填最近30天,提交带 reportPeriod', async () => {
    const onSubmit = vi.fn();
    render(<CreateFromTemplateDialog open onSubmit={onSubmit} onCancel={() => {}} />);

    await waitFor(() => expect(screen.getByText(/投放区间/)).toBeTruthy());
    expect(screen.getByText(/投放区间/).textContent).toContain('2020-01-01');
    expect(screen.getByText(/投放区间/).textContent).toContain('2020-12-31');

    fireEvent.click(screen.getByRole('button', { name: /创建报告/ }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].reportPeriod).toEqual({ startDate: '2020-12-02', endDate: '2020-12-31' });
  });

  it('getCampaign 失败 → 降级,不显示投放区间提示', async () => {
    (getCampaign as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    render(<CreateFromTemplateDialog open onSubmit={() => {}} onCancel={() => {}} />);
    await waitFor(() => expect(getCampaign).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(/投放区间/)).toBeNull());
  });
});
