import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Campaign, TemplateSummary } from '@mediakit/shared';
import { templatesApi } from '@/api/templates';
import { getCampaign } from '@/api/campaigns';
import { CreateFromTemplateDialog } from './CreateFromTemplateDialog';

const aiHtmlTpl = {
  id: 't1',
  name: 'AI 报告',
  status: 'PUBLISHED',
  meta: { styleType: 'ai-html', campaignId: 'c1', businessLine: 'BL', scenario: 's1', isDefault: false },
} as unknown as TemplateSummary;

const pptTpl = {
  id: 't2',
  name: 'PPT 模板',
  status: 'PUBLISHED',
  meta: { styleType: 'ppt', businessLine: 'BL', scenario: 's1', isDefault: false },
} as unknown as TemplateSummary;

// endDate 取 2020-12-31（早于任何运行时今天），保证 max=endDate 确定性。
const campaign = { id: 'c1', startDate: '2020-01-01', endDate: '2020-12-31' } as unknown as Campaign;

vi.mock('@/api/templates', () => ({ templatesApi: { list: vi.fn() } }));
vi.mock('@/api/campaigns', () => ({ getCampaign: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(templatesApi.list).mockResolvedValue([aiHtmlTpl]);
  vi.mocked(getCampaign).mockResolvedValue(campaign);
});

describe('CreateFromTemplateDialog', () => {
  it('ai-html 模板: 拉 Campaign 显示投放区间,默认填最近30天,提交带 reportPeriod', async () => {
    const onSubmit = vi.fn();
    render(<CreateFromTemplateDialog open onSubmit={onSubmit} onCancel={() => {}} />);

    // 精确匹配区间文案,避免误匹配"加载投放区间…"导致偶发失败。
    await waitFor(() => expect(screen.getByText('投放区间 2020-01-01 ~ 2020-12-31')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /创建报告/ }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].reportPeriod).toEqual({ startDate: '2020-12-02', endDate: '2020-12-31' });
  });

  it('getCampaign 失败(reject) → 降级,不显示投放区间提示', async () => {
    vi.mocked(getCampaign).mockRejectedValueOnce(new Error('boom'));
    render(<CreateFromTemplateDialog open onSubmit={() => {}} onCancel={() => {}} />);
    await waitFor(() => expect(getCampaign).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(/投放区间 \d{4}-\d{2}-\d{2}/)).toBeNull());
  });

  it('campaign 不存在(resolve undefined) → 同样降级,不显示投放区间提示', async () => {
    vi.mocked(getCampaign).mockResolvedValueOnce(undefined);
    render(<CreateFromTemplateDialog open onSubmit={() => {}} onCancel={() => {}} />);
    await waitFor(() => expect(getCampaign).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(/投放区间 \d{4}-\d{2}-\d{2}/)).toBeNull());
  });

  it('非 ai-html 模板: 无日期 UI,提交不带 reportPeriod 键', async () => {
    vi.mocked(templatesApi.list).mockResolvedValue([pptTpl]);
    const onSubmit = vi.fn();
    render(<CreateFromTemplateDialog open onSubmit={onSubmit} onCancel={() => {}} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /创建报告/ })).toBeTruthy());
    expect(screen.queryByLabelText('起始日期')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /创建报告/ }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].reportPeriod).toBeUndefined();
  });
});
