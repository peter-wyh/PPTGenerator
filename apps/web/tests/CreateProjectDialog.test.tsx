import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Campaign } from '@mediakit/shared';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';

const { listCampaignsMock } = vi.hoisted(() => ({
  listCampaignsMock: vi.fn<() => Promise<Campaign[]>>(async () => []),
}));
vi.mock('@/api/campaigns', () => ({ listCampaigns: listCampaignsMock }));

beforeEach(() => {
  listCampaignsMock.mockResolvedValue([]);
});

describe('CreateProjectDialog — 业务线必填 + 模版类型', () => {
  it('业务线选择始终可见', () => {
    render(<CreateProjectDialog open onSubmit={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('业务线')).toBeInTheDocument();
  });

  it('未填业务线时不能提交', () => {
    const onSubmit = vi.fn();
    render(<CreateProjectDialog open onSubmit={onSubmit} onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: '创建' })).toBeDisabled();
  });

  it('campaign-report:报告类型取值来自模版类型(周报/月报/总结)', async () => {
    const user = userEvent.setup();
    render(<CreateProjectDialog open onSubmit={() => {}} onCancel={() => {}} />);
    await user.selectOptions(screen.getByLabelText('场景'), 'campaign-report');
    const reportSelect = screen.getByText('报告类型').parentElement!.querySelector('select')!;
    const labels = Array.from(reportSelect.querySelectorAll('option')).map((o) => o.textContent);
    expect(labels).toEqual(expect.arrayContaining(['周报', '月报', '总结']));
  });

  it('media-kit:模版类型下拉出现 品牌版/达人版/平台版(无报告类型)', async () => {
    const user = userEvent.setup();
    render(<CreateProjectDialog open onSubmit={() => {}} onCancel={() => {}} />);
    await user.selectOptions(screen.getByLabelText('场景'), 'media-kit');
    expect(screen.queryByText('报告类型')).not.toBeTruthy();
    const ttSelect = screen.getByText('模版类型').parentElement!.querySelector('select')!;
    const labels = Array.from(ttSelect.querySelectorAll('option')).map((o) => o.textContent);
    expect(labels).toEqual(expect.arrayContaining(['品牌版', '达人版', '平台版']));
  });

  it('campaign-report 未动报告类型时提交仍带 templateType=weekly(reportSub 兜底)', async () => {
    listCampaignsMock.mockResolvedValue([
      { id: 'c1', name: 'Q4 Launch', advertiser: 'GlowLab', businessLine: 'FT', platform: 'TikTok', startDate: '2026-10-12', endDate: '2026-11-10', budget: '$300K' },
    ]);
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CreateProjectDialog open onSubmit={onSubmit} onCancel={() => {}} />);

    await user.type(screen.getByLabelText('项目名称'), 'P');
    await user.selectOptions(screen.getByLabelText('场景'), 'campaign-report');
    // 选 campaign(同时回填业务线 FT);不碰报告类型
    await waitFor(() => expect(screen.getByRole('option', { name: /Q4 Launch/ })).toBeInTheDocument());
    const campaignSelect = screen.getByText('Campaign').parentElement!.querySelector('select')!;
    await user.selectOptions(campaignSelect, 'c1');
    // 不动报告类型,直接提交
    await user.click(screen.getByRole('button', { name: '创建' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const meta = onSubmit.mock.calls[0][0].meta;
    expect(meta.scenario).toBe('campaign-report');
    expect(meta.templateType).toBe('weekly'); // reportSub 兜底
    expect(meta.scenarioSub).toBe('weekly');
  });
});
