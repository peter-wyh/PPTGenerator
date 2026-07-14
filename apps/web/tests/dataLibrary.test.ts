import { describe, it, expect, vi, beforeEach } from 'vitest';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/api/client', () => ({ api: apiMock }));

import { dataApi } from '@/api/dataLibrary';

beforeEach(() => vi.clearAllMocks());

describe('dataApi · list', () => {
  it('GET /data?kind=campaign → 返回 records[]', async () => {
    apiMock.get.mockResolvedValue({ data: { records: [{ id: 'c1', kind: 'campaign', ownerId: 'u', data: { id: 'c1', name: 'C' }, createdAt: '', updatedAt: '' }] } });
    const r = await dataApi.list('campaign');
    expect(apiMock.get).toHaveBeenCalledWith('/data', { params: { kind: 'campaign' } });
    expect(r).toHaveLength(1);
    expect(r[0].data.id).toBe('c1');
  });
});

describe('dataApi · create / importMany / update / remove / clear', () => {
  it('create → POST /data { kind, data }', async () => {
    apiMock.post.mockResolvedValue({ data: { record: { id: 'c1' } } });
    const r = await dataApi.create('campaign', { id: 'c1', name: 'C' });
    expect(apiMock.post).toHaveBeenCalledWith('/data', { kind: 'campaign', data: { id: 'c1', name: 'C' } });
    expect(r.id).toBe('c1');
  });
  it('importMany → POST /data/import,返回 {created,updated,skipped}', async () => {
    apiMock.post.mockResolvedValue({ data: { created: 1, updated: 2, skipped: 3 } });
    const r = await dataApi.importMany('creator', [{ id: 'x' }]);
    expect(apiMock.post).toHaveBeenCalledWith('/data/import', { kind: 'creator', items: [{ id: 'x' }] });
    expect(r).toEqual({ created: 1, updated: 2, skipped: 3 });
  });
  it('update → PATCH /data/:id { data }', async () => {
    apiMock.patch.mockResolvedValue({ data: { record: { id: 'c1' } } });
    await dataApi.update('c1', { name: '新' });
    expect(apiMock.patch).toHaveBeenCalledWith('/data/c1', { data: { name: '新' } });
  });
  it('remove → DELETE /data/:id(无 body)', async () => {
    apiMock.delete.mockResolvedValue({ data: undefined });
    await dataApi.remove('c1');
    expect(apiMock.delete).toHaveBeenCalledWith('/data/c1');
  });
  it('clear → DELETE /data?kind=...,返回 {deleted}', async () => {
    apiMock.delete.mockResolvedValue({ data: { deleted: 5 } });
    const r = await dataApi.clear('campaign');
    expect(apiMock.delete).toHaveBeenCalledWith('/data', { params: { kind: 'campaign' } });
    expect(r).toEqual({ deleted: 5 });
  });
});
