import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecordFormModal } from '@/editor/components/RecordFormModal';
import type { DataRecordDTO } from '@/api/dataLibrary';

const updateMock = vi.fn<(id: string, data: unknown) => Promise<unknown>>(() => Promise.resolve({}));
const createMock = vi.fn<(kind: string, data: unknown) => Promise<unknown>>(() => Promise.resolve({}));
vi.mock('@/api/dataLibrary', () => ({
  dataApi: {
    update: (id: string, data: unknown) => updateMock(id, data),
    create: (kind: string, data: unknown) => createMock(kind, data),
    list: vi.fn(),
  },
}));
// 0827: Campaign CRUD 改走独立表 API（与列表读取同源）
const campaignsUpdateMock = vi.fn<(id: string, data: unknown) => Promise<unknown>>(() => Promise.resolve({}));
const campaignsCreateMock = vi.fn<(data: unknown) => Promise<unknown>>(() => Promise.resolve({}));
vi.mock('@/api/campaignsApi', () => ({
  campaignsApi: {
    update: (id: string, data: unknown) => campaignsUpdateMock(id, data),
    create: (data: unknown) => campaignsCreateMock(data),
    list: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock('@/api/lookup', () => ({
  lookupApi: {
    listBusinessLines: () => Promise.resolve([
      { id: 'bl-1', code: 'FT', name: 'FineTech', logo: '' },
    ]),
    listAdvertisers: () => Promise.resolve([
      { id: 'adv-1', name: 'GlowLab', logo: '', businessLineId: 'bl-1' },
    ]),
  },
}));

const fullCampaign = {
  id: 'camp-x', name: 'Campaign X', advertiser: 'GlowLab', businessLine: 'FT', platform: 'TikTok',
  startDate: '2026-01-01', endDate: '2026-01-31', budget: '$100K', status: 'Active', owner: 'alex',
  platforms: ['TikTok', 'Instagram'],
  metrics: [{ label: 'GMV', value: '$1', compare: '+1%' }],
  creatorIds: ['cre-mia'],
};
const record: DataRecordDTO = { id: 'camp-x', kind: 'CAMPAIGN', ownerId: 'u', data: fullCampaign, createdAt: '', updatedAt: '' };

describe('RecordFormModal · edit preserves non-form fields', () => {
  it('编辑走 campaignsApi.update(新表);payload 不含 metrics/creatorIds(PATCH 语义,DB 侧保留)', async () => {
    render(<RecordFormModal kind="campaign" record={record} onSaved={() => {}} onCancel={() => {}} />);
    // 改名称
    const nameInput = screen.getByLabelText(/名称/);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, '改名后');
    await userEvent.click(screen.getByText('保存'));
    await waitFor(() => expect(campaignsUpdateMock).toHaveBeenCalled());
    const [id, payload] = campaignsUpdateMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(id).toBe('camp-x');
    expect(payload.name).toBe('改名后');
    // PATCH 部分更新:未在表单中的字段不发送 → DB 原值保留(替代旧 dataApi 的浅合并语义)
    expect(payload.metrics).toBeUndefined();
    expect(payload.creatorIds).toBeUndefined();
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe('RecordFormModal · campaign 表单使用选择框', () => {
  it('编辑模式：业务线和广告主为 select 元素', () => {
    render(<RecordFormModal kind="campaign" record={record} onSaved={() => {}} onCancel={() => {}} />);
    expect(screen.getByLabelText(/业务线/)).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByLabelText(/广告主/)).toBeInstanceOf(HTMLSelectElement);
  });
  it('表单中不再出现合作达人选择器', () => {
    render(<RecordFormModal kind="campaign" record={record} onSaved={() => {}} onCancel={() => {}} />);
    expect(screen.queryByText(/合作达人/)).not.toBeInTheDocument();
  });
});
