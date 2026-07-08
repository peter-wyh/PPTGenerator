import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportCampaignModal } from '@/editor/components/ImportCampaignModal';
import type { Campaign, CampaignMetric } from '@mediakit/shared';

/* 本组件无图表，按测试约定断言 shell 文本。
   listCampaigns 默认带 300ms setTimeout；用 findBy* 异步等待。
   这里所有用例都注入 fetchCampaigns 为同步 Promise.resolve，避免 setTimeout。 */

const metrics: CampaignMetric[] = [
  { label: '花费', value: '¥128,000', compare: '+15%' },
  { label: '展示', value: '1,240,000', compare: '+8%' },
];

const withMetrics: Campaign = {
  id: 'c1',
  name: 'Campaign A',
  advertiser: 'A',
  businessLine: 'FT',
  platform: 'TikTok',
  startDate: '2026-01-01',
  endDate: '2026-02-01',
  budget: '¥100K',
  metrics,
};

describe('ImportCampaignModal', () => {
  it('加载后默认选中第一个 campaign，预览其指标', async () => {
    render(
      <ImportCampaignModal
        fetchCampaigns={() => Promise.resolve([withMetrics])}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(await screen.findByText('花费')).toBeInTheDocument();
    expect(screen.getByText('展示')).toBeInTheDocument();
  });

  it('切换 campaign 更新预览', async () => {
    const c2: Campaign = { ...withMetrics, id: 'c2', name: 'Campaign B', metrics: [{ label: '点击', value: '9,000', compare: '+3%' }] };
    render(
      <ImportCampaignModal
        fetchCampaigns={() => Promise.resolve([withMetrics, c2])}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    await screen.findByText('花费');
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    await userEvent.selectOptions(select, 'c2');
    expect(screen.getByText('点击')).toBeInTheDocument();
  });

  it('选中无指标的 campaign → 显示空态、确认禁用', async () => {
    const noMetrics: Campaign = { ...withMetrics, metrics: undefined };
    render(
      <ImportCampaignModal
        fetchCampaigns={() => Promise.resolve([noMetrics])}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(await screen.findByText('该 Campaign 暂无可导入的指标')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确认导入' })).toBeDisabled();
  });

  it('确认时回传当前 campaign 的 metrics', async () => {
    const onConfirm = vi.fn();
    render(
      <ImportCampaignModal
        fetchCampaigns={() => Promise.resolve([withMetrics])}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    await screen.findByText('花费');
    await userEvent.click(screen.getByRole('button', { name: '确认导入' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toEqual(metrics);
  });

  it('取消按钮触发 onCancel', async () => {
    const onCancel = vi.fn();
    render(
      <ImportCampaignModal
        fetchCampaigns={() => Promise.resolve([withMetrics])}
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );
    await screen.findByText('花费');
    await userEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('加载失败 → 显示错误态、确认禁用', async () => {
    render(
      <ImportCampaignModal
        fetchCampaigns={() => Promise.reject(new Error('boom'))}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(await screen.findByText('加载 Campaign 失败，请重试。')).toBeInTheDocument();
    // 加载失败时未渲染确认按钮（确认按钮仅在 campaigns 加载完成后出现）
    expect(screen.queryByRole('button', { name: '确认导入' })).not.toBeInTheDocument();
  });
});
