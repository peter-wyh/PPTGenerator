import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataConfigOverlay } from '@/editor/components/DataConfigOverlay';
import { useEditorStore } from '@/editor/store';
import type { Campaign } from '@mediakit/shared';

const FIXTURE: Campaign[] = [
  { id: 'ft-1', name: 'GlowLab Q4', advertiser: 'GlowLab', businessLine: 'FT', platform: 'TikTok', startDate: '2026-10-12', endDate: '2026-11-10', budget: '$300K' },
  { id: 'sm-1', name: 'LUMIÈRE Launch', advertiser: 'LUMIÈRE', businessLine: 'SM', platform: 'TikTok', startDate: '2026-09-01', endDate: '2026-09-30', budget: '$520K' },
];

vi.mock('@/api/campaigns', () => ({
  listCampaigns: () => Promise.resolve(FIXTURE.map((c) => ({ ...c }))),
}));
vi.mock('@/api/creators', () => ({
  listCreators: () => Promise.resolve([]),
  listCampaignCreators: () => Promise.resolve([]),
  fetchCampaignCreatorWorks: () => Promise.resolve([]),
}));

const noop = () => {};

/* store 为 zustand 单例；按用例种子 projectMeta.businessLine 与已绑定 campaign。 */
function seedStore(businessLine?: string, boundCampaignId?: string) {
  useEditorStore.setState({
    projectMeta: businessLine ? { businessLine } : null,
    reportData: boundCampaignId
      ? ({ campaign: { id: boundCampaignId, name: 'Bound', advertiser: 'X', platform: 'TikTok', startDate: '', endDate: '', budget: '' } } as never)
      : { campaign: null },
  } as never);
}

describe('DataConfigOverlay — campaign 按项目业务线过滤', () => {
  beforeEach(() => {
    seedStore();
  });

  it('项目 businessLine=FT 时,campaign 下拉只显示 FT', async () => {
    seedStore('FT');
    render(<DataConfigOverlay onClose={noop} />);
    const select = await screen.findByRole('combobox');
    expect(select.textContent).toContain('GlowLab Q4');
    expect(select.textContent).not.toContain('LUMIÈRE');
  });

  it('项目无 businessLine(存量项目)时,campaign 下拉显示全部', async () => {
    seedStore(undefined);
    render(<DataConfigOverlay onClose={noop} />);
    const select = await screen.findByRole('combobox');
    expect(select.textContent).toContain('GlowLab Q4');
    expect(select.textContent).toContain('LUMIÈRE');
  });

  it('已绑定 campaign 不属于当前业务线时,仍保留其 option', async () => {
    // 业务线 FT,但已绑定的是 SM 的 campaign
    seedStore('FT', 'sm-1');
    render(<DataConfigOverlay onClose={noop} />);
    const select = (await screen.findByRole('combobox')) as HTMLSelectElement;
    expect(select.textContent).toContain('GlowLab Q4'); // FT(过滤内)
    expect(select.textContent).toContain('LUMIÈRE');   // 已绑定,保留显示
    expect(select.value).toBe('sm-1');
  });
});
