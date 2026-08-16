import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Campaign } from '@mediakit/shared';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';

const { listCampaignsMock, lookupApiMock } = vi.hoisted(() => ({
  listCampaignsMock: vi.fn<() => Promise<Campaign[]>>(async () => []),
  lookupApiMock: {
    listBusinessLines: vi.fn().mockResolvedValue([
      { id: 'bl-ft', code: 'FT', name: 'Fanstoshop' },
      { id: 'bl-sm', code: 'SM', name: 'SmileKOLs' },
      { id: 'bl-dg', code: 'DG', name: 'Digchic' },
    ]),
    listAdvertisers: vi.fn().mockResolvedValue([]),
    listMerchants: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('@/api/campaigns', () => ({ listCampaigns: listCampaignsMock }));
vi.mock('@/api/lookup', () => ({ lookupApi: lookupApiMock }));

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

    await user.type(screen.getByLabelText('报告名称'), 'P');
    await user.selectOptions(screen.getByLabelText('场景'), 'campaign-report');
    // 业务线决定 campaign 过滤(c1 属 FT);不碰报告类型
    await user.selectOptions(screen.getByLabelText('业务线'), 'FT');
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

describe('CreateProjectDialog — campaign 按业务线过滤', () => {
  // 跨业务线 fixture:FT 两条、SM 一条
  const FIXTURE: Campaign[] = [
    { id: 'ft-1', name: 'GlowLab Q4', advertiser: 'GlowLab', businessLine: 'FT', platform: 'TikTok', startDate: '2026-10-12', endDate: '2026-11-10', budget: '$300K' },
    { id: 'ft-2', name: 'GlowLab Summer', advertiser: 'GlowLab', businessLine: 'FT', platform: 'TikTok', startDate: '2026-06-01', endDate: '2026-07-01', budget: '$120K' },
    { id: 'sm-1', name: 'LUMIÈRE Launch', advertiser: 'LUMIÈRE', businessLine: 'SM', platform: 'TikTok', startDate: '2026-09-01', endDate: '2026-09-30', budget: '$520K' },
  ];

  beforeEach(() => {
    listCampaignsMock.mockResolvedValue(FIXTURE);
  });

  it('选业务线 FT 后,campaign 下拉只显示 FT 的 campaign', async () => {
    const user = userEvent.setup();
    render(<CreateProjectDialog open onSubmit={() => {}} onCancel={() => {}} />);
    // 业务线选项异步加载(数据库唯一来源),先等加载完成
    await screen.findByText(/FT · Fanstoshop/);
    await user.selectOptions(screen.getByLabelText('业务线'), 'FT');
    await user.selectOptions(screen.getByLabelText('场景'), 'campaign-report');
    await screen.findByText(/GlowLab Q4/);
    expect(screen.getByText(/GlowLab Summer/)).toBeInTheDocument();
    expect(screen.queryByText(/LUMIÈRE/)).not.toBeInTheDocument();
  });

  it('切业务线后已选 campaign 被清空', async () => {
    const user = userEvent.setup();
    render(<CreateProjectDialog open onSubmit={() => {}} onCancel={() => {}} />);
    await screen.findByText(/FT · Fanstoshop/);
    await user.selectOptions(screen.getByLabelText('业务线'), 'FT');
    await user.selectOptions(screen.getByLabelText('场景'), 'campaign-report');
    await screen.findByText(/GlowLab Q4/);
    const campaignSelect = screen.getByText('Campaign').parentElement!.querySelector('select')!;
    await user.selectOptions(campaignSelect, 'ft-1');
    expect(campaignSelect.value).toBe('ft-1');

    // 切到 SM → campaign 清空
    await user.selectOptions(screen.getByLabelText('业务线'), 'SM');
    expect((screen.getByText('Campaign').parentElement!.querySelector('select') as HTMLSelectElement).value).toBe('');
  });

  it('该业务线无 campaign 时下拉显示空态文案（可选）', async () => {
    const user = userEvent.setup();
    render(<CreateProjectDialog open onSubmit={() => {}} onCancel={() => {}} />);
    await screen.findByText(/DG · Digchic/);
    await user.selectOptions(screen.getByLabelText('业务线'), 'DG'); // fixture 中无 DG
    await user.selectOptions(screen.getByLabelText('场景'), 'campaign-report');
    await screen.findByText(/该业务线暂无可选 Campaign/);
  });

  it('campaign-report 场景不绑定 Campaign 也可提交（可选绑定）', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CreateProjectDialog open onSubmit={onSubmit} onCancel={() => {}} />);
    await user.type(screen.getByLabelText('报告名称'), 'P');
    await user.selectOptions(screen.getByLabelText('业务线'), 'FT');
    await user.selectOptions(screen.getByLabelText('场景'), 'campaign-report');
    // 不选 Campaign，直接提交
    const submitBtn = screen.getByRole('button', { name: '创建' });
    await waitFor(() => expect(submitBtn).not.toBeDisabled());
    await user.click(submitBtn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const meta = onSubmit.mock.calls[0][0].meta;
    expect(meta.scenario).toBe('campaign-report');
    // 未绑定 Campaign → meta.campaignId 不存在
    expect(meta.campaignId).toBeUndefined();
  });
});
