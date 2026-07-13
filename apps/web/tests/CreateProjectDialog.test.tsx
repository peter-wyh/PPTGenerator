import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';

vi.mock('@/api/campaigns', () => ({ listCampaigns: async () => [] }));

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
});
