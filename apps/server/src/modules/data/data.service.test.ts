import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  dataRecord: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock('../../prisma', () => ({ prisma: prismaMock }));

import { dataService, kindToDb } from './data.service';

const validCampaign = {
  id: 'camp-x',
  name: 'Campaign X',
  advertiser: 'GlowLab',
  businessLine: 'FT',
  platform: 'TikTok',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  budget: '$100K',
};
function makeRecord(over: Record<string, unknown> = {}) {
  return {
    id: 'camp-x',
    kind: 'CAMPAIGN',
    ownerId: 'u1',
    data: validCampaign,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...over,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('dataService · list', () => {
  it('按 kind 查询,createdAt desc', async () => {
    prismaMock.dataRecord.findMany.mockResolvedValue([makeRecord()]);
    const r = await dataService.list('campaign');
    expect(r).toHaveLength(1);
    expect(prismaMock.dataRecord.findMany).toHaveBeenCalledWith({
      where: { kind: 'CAMPAIGN' },
      orderBy: { createdAt: 'desc' },
    });
  });
});

describe('dataService · getOrThrow', () => {
  it('不存在 → 404', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(null);
    await expect(dataService.getOrThrow('nope')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('dataService · create', () => {
  it('合法 data → 创建,kind 大写、data 透传', async () => {
    prismaMock.dataRecord.create.mockImplementation(({ data }) => Promise.resolve(makeRecord({ data: data.data })));
    await dataService.create('u1', 'campaign', validCampaign);
    const { data } = prismaMock.dataRecord.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.kind).toBe('CAMPAIGN');
    expect(data.ownerId).toBe('u1');
    expect((data.data as { id: string }).id).toBe('camp-x');
  });
  it('非法 data(缺 name)→ 400', async () => {
    const { name, ...bad } = validCampaign;
    await expect(dataService.create('u1', 'campaign', bad)).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.dataRecord.create).not.toHaveBeenCalled();
  });
});

describe('dataService · importMany', () => {
  it('新 id → created;已存在 → updated;非法 → skipped', async () => {
    prismaMock.dataRecord.findUnique
      .mockResolvedValueOnce(null) // camp-x 不存在 → create
      .mockResolvedValueOnce(makeRecord()); // camp-y 存在 → update
    const r = await dataService.importMany('u1', 'campaign', [
      validCampaign, // valid, new
      { ...validCampaign, id: 'camp-y' }, // valid, exists
      { id: 'camp-bad' }, // invalid (缺 name) → skipped
    ]);
    expect(r).toEqual({ created: 1, updated: 1, skipped: 1 });
    expect(prismaMock.dataRecord.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.dataRecord.update).toHaveBeenCalledTimes(1);
  });
  it('id 缺失 → skipped', async () => {
    const r = await dataService.importMany('u1', 'campaign', [{ name: 'no id' }]);
    expect(r.skipped).toBe(1);
  });
  it('重复导入同 id 幂等:第二次走 update', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(makeRecord());
    const r = await dataService.importMany('u1', 'campaign', [validCampaign]);
    expect(r).toEqual({ created: 0, updated: 1, skipped: 0 });
  });
  it('DB 错误(create 抛异常)→ 该行 skipped,批次继续', async () => {
    prismaMock.dataRecord.findUnique
      .mockResolvedValueOnce(null) // item 1: new → create succeeds
      .mockResolvedValueOnce(null); // item 2: new → create throws
    prismaMock.dataRecord.create
      .mockResolvedValueOnce(makeRecord({ id: 'camp-a' })) // item 1 ok
      .mockRejectedValueOnce(new Error('unique constraint')); // item 2 DB error
    const r = await dataService.importMany('u1', 'campaign', [
      { ...validCampaign, id: 'camp-a' },
      { ...validCampaign, id: 'camp-b' },
    ]);
    expect(r).toEqual({ created: 1, updated: 0, skipped: 1 });
  });
});

describe('dataService · update', () => {
  it('记录不存在 → 404', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(null);
    await expect(dataService.update('nope', validCampaign)).rejects.toMatchObject({ statusCode: 404 });
  });
  it('按记录既有 kind 校验 data 后更新', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(makeRecord());
    prismaMock.dataRecord.update.mockResolvedValue(makeRecord({ data: { ...validCampaign, name: '改名' } }));
    await dataService.update('camp-x', { ...validCampaign, name: '改名' });
    const arg = prismaMock.dataRecord.update.mock.calls[0][0] as { where: { id: string }; data: { data: { name: string } } };
    expect(arg.where.id).toBe('camp-x');
    expect(arg.data.data.name).toBe('改名');
  });
  it('data 与记录 kind 不符(creator 数据塞 campaign 记录)→ 400', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(makeRecord()); // kind CAMPAIGN
    await expect(dataService.update('camp-x', { id: 'x', name: 'Mia', handle: '@m', platform: 'TikTok', tier: 'mega', followers: '1M', engagement: '8%', category: 'Beauty', region: 'US', metrics: [] })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('dataService · remove / clear', () => {
  it('remove: 不存在 → 404', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(null);
    await expect(dataService.remove('nope')).rejects.toMatchObject({ statusCode: 404 });
  });
  it('remove: 存在 → delete', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(makeRecord());
    prismaMock.dataRecord.delete.mockResolvedValue(makeRecord());
    await dataService.remove('camp-x');
    expect(prismaMock.dataRecord.delete).toHaveBeenCalledWith({ where: { id: 'camp-x' } });
  });
  it('clear: deleteMany by kind,返回 count', async () => {
    prismaMock.dataRecord.deleteMany.mockResolvedValue({ count: 5 });
    const r = await dataService.clear('campaign');
    expect(prismaMock.dataRecord.deleteMany).toHaveBeenCalledWith({ where: { kind: 'CAMPAIGN' } });
    expect(r).toEqual({ deleted: 5 });
  });
});

describe('kindToDb', () => {
  it('三种 kind 映射到 Prisma 大写枚举', () => {
    expect(kindToDb('campaign')).toBe('CAMPAIGN');
    expect(kindToDb('creator')).toBe('CREATOR');
    expect(kindToDb('collaboration')).toBe('COLLABORATION');
  });
});
