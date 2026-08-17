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
import { assertBusinessLine } from '../../utils/business-line';

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

beforeEach(() => {
  vi.clearAllMocks();
  // campaign 自增:nextCampaignId 默认无已有记录 → '1'。
  prismaMock.dataRecord.findMany.mockResolvedValue([]);
});

const adminViewer = { id: 'u-admin', role: 'ADMIN' as const, businessLineCode: null };
const blViewer = { id: 'u-bl', role: 'USER' as const, businessLineCode: 'DG' };

describe('dataService · list（业务线隔离）', () => {
  it('ADMIN: 按 kind 查询无 owner 过滤,createdAt desc', async () => {
    prismaMock.dataRecord.findMany.mockResolvedValue([makeRecord()]);
    const r = await dataService.list('campaign', adminViewer);
    expect(r).toHaveLength(1);
    expect(prismaMock.dataRecord.findMany).toHaveBeenCalledWith({
      where: { kind: 'CAMPAIGN' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('USER: 非 CREATOR kind 强制加 ownerId 过滤', async () => {
    prismaMock.dataRecord.findMany.mockResolvedValue([]);
    await dataService.list('campaign', blViewer);
    expect(prismaMock.dataRecord.findMany).toHaveBeenCalledWith({
      where: { kind: 'CAMPAIGN', ownerId: 'u-bl' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('USER + CREATOR: 共享字典,不加 owner 过滤', async () => {
    prismaMock.dataRecord.findMany.mockResolvedValue([]);
    await dataService.list('creator', blViewer);
    expect(prismaMock.dataRecord.findMany).toHaveBeenCalledWith({
      where: { kind: 'CREATOR' },
      orderBy: { createdAt: 'desc' },
    });
  });
});

describe('dataService · get（业务线隔离）', () => {
  it('USER 读他人 CAMPAIGN 记录 → 404', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(makeRecord({ ownerId: 'u-admin' }));
    await expect(dataService.get('camp-x', blViewer)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('USER 读他人 CREATOR 记录 → 放行（共享字典）', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(
      makeRecord({ id: 'cre-x', kind: 'CREATOR', ownerId: 'u-admin' }),
    );
    await expect(dataService.get('cre-x', blViewer)).resolves.toBeTruthy();
  });

  it('USER 读自己记录 → 放行；ADMIN 读任意 → 放行', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(makeRecord({ ownerId: 'u-bl' }));
    await expect(dataService.get('camp-x', blViewer)).resolves.toBeTruthy();
    await expect(dataService.get('camp-x', adminViewer)).resolves.toBeTruthy();
  });
});

describe('assertBusinessLine 守卫', () => {
  const admin = { id: 'a', role: 'ADMIN' as const, businessLineCode: null };
  const dg = { id: 'b', role: 'USER' as const, businessLineCode: 'DG' };
  const noBl = { id: 'c', role: 'USER' as const, businessLineCode: null };

  it('ADMIN 或无业务线账号 → 放行', () => {
    expect(() => assertBusinessLine(admin, 'FT')).not.toThrow();
    expect(() => assertBusinessLine(noBl, 'FT')).not.toThrow();
  });
  it('业务线账号 + 其他 code → 403', () => {
    expect(() => assertBusinessLine(dg, 'FT')).toThrowError('不能创建或修改其他业务线的数据');
  });
  it('code 缺省 → 放行（旧载荷兼容）', () => {
    expect(() => assertBusinessLine(dg, undefined)).not.toThrow();
    expect(() => assertBusinessLine(dg, '')).not.toThrow();
  });
});

describe('dataService · getOrThrow', () => {
  it('不存在 → 404', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(null);
    await expect(dataService.getOrThrow('nope')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('dataService · create', () => {
  it('合法 data → 创建;campaign id 服务端自增(忽略客户端 id)', async () => {
    prismaMock.dataRecord.create.mockImplementation(({ data }) => Promise.resolve(makeRecord({ data: data.data })));
    await dataService.create({ id: 'u1', role: 'ADMIN', businessLineCode: null }, 'campaign', validCampaign);
    const { data } = prismaMock.dataRecord.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.kind).toBe('CAMPAIGN');
    expect(data.ownerId).toBe('u1');
    expect(data.id).toBe('1'); // PK = 自增 id
    expect((data.data as { id: string }).id).toBe('1'); // data.id 同值,非客户端 camp-x
  });
  it('campaign 自增:取已有数字 id 最大值 +1(忽略非数字遗留 id)', async () => {
    prismaMock.dataRecord.findMany.mockResolvedValue([{ id: '1' }, { id: '3' }, { id: 'camp-glowlab-q4' }]);
    prismaMock.dataRecord.create.mockImplementation(({ data }) => Promise.resolve(makeRecord({ data: data.data })));
    await dataService.create({ id: 'u1', role: 'ADMIN', businessLineCode: null }, 'campaign', validCampaign);
    const { data } = prismaMock.dataRecord.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.id).toBe('4'); // max(1,3)=3 → 4;camp-glowlab-q4 忽略
  });
  it('非法 data(缺 name)→ 400', async () => {
    const { name, ...bad } = validCampaign;
    await expect(dataService.create({ id: 'u1', role: 'ADMIN', businessLineCode: null }, 'campaign', bad)).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.dataRecord.create).not.toHaveBeenCalled();
  });
});

describe('dataService · importMany', () => {
  it('新 id → created;已存在 → updated;非法 → skipped', async () => {
    prismaMock.dataRecord.findUnique
      .mockResolvedValueOnce(null) // camp-x 不存在 → create
      .mockResolvedValueOnce(makeRecord()); // camp-y 存在 → update
    const r = await dataService.importMany({ id: 'u1', role: 'ADMIN', businessLineCode: null }, 'campaign', [
      validCampaign, // valid, new
      { ...validCampaign, id: 'camp-y' }, // valid, exists
      { id: 'camp-bad' }, // invalid (缺 name) → skipped
    ]);
    expect(r).toEqual({ created: 1, updated: 1, skipped: 1 });
    expect(prismaMock.dataRecord.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.dataRecord.update).toHaveBeenCalledTimes(1);
  });
  it('id 缺失 → skipped', async () => {
    const r = await dataService.importMany({ id: 'u1', role: 'ADMIN', businessLineCode: null }, 'campaign', [{ name: 'no id' }]);
    expect(r.skipped).toBe(1);
  });
  it('重复导入同 id 幂等:第二次走 update', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(makeRecord());
    const r = await dataService.importMany({ id: 'u1', role: 'ADMIN', businessLineCode: null }, 'campaign', [validCampaign]);
    expect(r).toEqual({ created: 0, updated: 1, skipped: 0 });
  });
  it('DB 错误(create 抛异常)→ 该行 skipped,批次继续', async () => {
    prismaMock.dataRecord.findUnique
      .mockResolvedValueOnce(null) // item 1: new → create succeeds
      .mockResolvedValueOnce(null); // item 2: new → create throws
    prismaMock.dataRecord.create
      .mockResolvedValueOnce(makeRecord({ id: 'camp-a' })) // item 1 ok
      .mockRejectedValueOnce(new Error('unique constraint')); // item 2 DB error
    const r = await dataService.importMany({ id: 'u1', role: 'ADMIN', businessLineCode: null }, 'campaign', [
      { ...validCampaign, id: 'camp-a' },
      { ...validCampaign, id: 'camp-b' },
    ]);
    expect(r).toEqual({ created: 1, updated: 0, skipped: 1 });
  });
});

describe('dataService · update', () => {
  it('记录不存在 → 404', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(null);
    await expect(dataService.update('nope', { id: 'u1', role: 'ADMIN', businessLineCode: null }, validCampaign)).rejects.toMatchObject({ statusCode: 404 });
  });
  it('按记录既有 kind 校验 data 后更新', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(makeRecord());
    prismaMock.dataRecord.update.mockResolvedValue(makeRecord({ data: { ...validCampaign, name: '改名' } }));
    await dataService.update('camp-x', { id: 'u1', role: 'ADMIN', businessLineCode: null }, { ...validCampaign, name: '改名' });
    const arg = prismaMock.dataRecord.update.mock.calls[0][0] as { where: { id: string }; data: { data: { name: string } } };
    expect(arg.where.id).toBe('camp-x');
    expect(arg.data.data.name).toBe('改名');
  });
  it('campaign update:强制 data.id = 主键,客户端改 id 无效(不可编辑)', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(makeRecord()); // 既有 PK = camp-x
    prismaMock.dataRecord.update.mockImplementation(({ data }) => Promise.resolve(makeRecord({ data: data.data })));
    await dataService.update('camp-x', { id: 'u1', role: 'ADMIN', businessLineCode: null }, { ...validCampaign, id: 'hacked', name: '改名' });
    const arg = prismaMock.dataRecord.update.mock.calls[0][0] as { where: { id: string }; data: { data: { id: string; name: string } } };
    expect(arg.where.id).toBe('camp-x');
    expect(arg.data.data.id).toBe('camp-x'); // 不被 'hacked' 覆盖
    expect(arg.data.data.name).toBe('改名');
  });
  it('data 与记录 kind 不符(creator 数据塞 campaign 记录)→ 400', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(makeRecord()); // kind CAMPAIGN
    await expect(dataService.update('camp-x', { id: 'u1', role: 'ADMIN', businessLineCode: null }, { id: 'x', name: 'Mia', handle: '@m', platform: 'TikTok', tier: 'mega', followers: '1M', engagement: '8%', category: 'Beauty', region: 'US', metrics: [] })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('dataService · remove / clear', () => {
  it('remove: 不存在 → 404', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(null);
    await expect(dataService.remove('nope', { id: 'u1', role: 'ADMIN', businessLineCode: null })).rejects.toMatchObject({ statusCode: 404 });
  });
  it('remove: 存在 → delete', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(makeRecord());
    prismaMock.dataRecord.delete.mockResolvedValue(makeRecord());
    await dataService.remove('camp-x', { id: 'u1', role: 'ADMIN', businessLineCode: null });
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

describe('dataService · scopeCampaignId 同步', () => {
  const validCollab = {
    id: 'collab:c1:cr1',
    campaignId: 'c1',
    creatorId: 'cr1',
    deliverables: [{ contentType: 'post' }],
  };

  it('create collaboration → payload.scopeCampaignId = campaignId', async () => {
    prismaMock.dataRecord.create.mockImplementation(({ data }) =>
      Promise.resolve(makeRecord({ ...(data as object) })));
    await dataService.create({ id: 'u1', role: 'ADMIN', businessLineCode: null }, 'collaboration', validCollab);
    const { data } = prismaMock.dataRecord.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.scopeCampaignId).toBe('c1');
  });

  it('create campaign → payload.scopeCampaignId = null', async () => {
    prismaMock.dataRecord.create.mockImplementation(({ data }) =>
      Promise.resolve(makeRecord({ ...(data as object) })));
    await dataService.create({ id: 'u1', role: 'ADMIN', businessLineCode: null }, 'campaign', validCampaign);
    const { data } = prismaMock.dataRecord.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.scopeCampaignId).toBeNull();
  });

  it('importMany collaboration:新建 → create 带 scope;已存在 → update 同步 scope', async () => {
    prismaMock.dataRecord.findUnique
      .mockResolvedValueOnce(null)                                    // item1 new → create
      .mockResolvedValueOnce(makeRecord({ kind: 'COLLABORATION' }));  // item2 exists → update
    await dataService.importMany({ id: 'u1', role: 'ADMIN', businessLineCode: null }, 'collaboration', [
      validCollab,
      { ...validCollab, id: 'collab:c1:cr2' },
    ]);
    const createArg = prismaMock.dataRecord.create.mock.calls[0][0] as { data: Record<string, unknown> };
    const updateArg = prismaMock.dataRecord.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createArg.data.scopeCampaignId).toBe('c1');
    expect(updateArg.data.scopeCampaignId).toBe('c1');
  });

  it('update collaboration → payload 同步 scopeCampaignId', async () => {
    prismaMock.dataRecord.findUnique.mockResolvedValue(makeRecord({ kind: 'COLLABORATION', data: validCollab }));
    prismaMock.dataRecord.update.mockImplementation(({ data }) =>
      Promise.resolve(makeRecord({ ...(data as object) })));
    await dataService.update('collab:c1:cr1', { id: 'u1', role: 'ADMIN', businessLineCode: null }, validCollab);
    const arg = prismaMock.dataRecord.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.scopeCampaignId).toBe('c1');
  });
});
