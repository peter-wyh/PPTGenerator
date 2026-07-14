import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecordFormModal } from '@/editor/components/RecordFormModal';
import type { DataRecordDTO } from '@/api/dataLibrary';

const updateMock = vi.fn<(id: string, data: unknown) => Promise<unknown>>(() => Promise.resolve({}));
vi.mock('@/api/dataLibrary', () => ({
  dataApi: {
    update: (id: string, data: unknown) => updateMock(id, data),
    create: vi.fn(),
    list: vi.fn(),
  },
}));
vi.mock('@/api/creators', () => ({ listCreators: () => Promise.resolve([]) }));

const fullCampaign = {
  id: 'camp-x', name: 'Campaign X', advertiser: 'GlowLab', businessLine: 'FT', platform: 'TikTok',
  startDate: '2026-01-01', endDate: '2026-01-31', budget: '$100K', status: 'Active', owner: 'alex',
  platforms: [{ platform: 'TikTok', collaborationType: 'Content' }],
  metrics: [{ label: 'GMV', value: '$1', compare: '+1%' }],
  creatorIds: ['cre-mia'],
};
const record: DataRecordDTO = { id: 'camp-x', kind: 'CAMPAIGN', ownerId: 'u', data: fullCampaign, createdAt: '', updatedAt: '' };

describe('RecordFormModal · edit preserves non-form fields', () => {
  it('编辑后 platforms/metrics 仍保留(只覆盖表单字段)', async () => {
    render(<RecordFormModal kind="campaign" record={record} onSaved={() => {}} onCancel={() => {}} />);
    // 改名称
    const nameInput = screen.getByLabelText(/名称/);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, '改名后');
    await userEvent.click(screen.getByText('保存'));
    await waitFor(() => expect(updateMock).toHaveBeenCalled());
    const [, payload] = updateMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.name).toBe('改名后');
    expect(payload.platforms).toEqual(fullCampaign.platforms);
    expect(payload.metrics).toEqual(fullCampaign.metrics);
    expect(payload.creatorIds).toEqual(['cre-mia']);
  });
});
