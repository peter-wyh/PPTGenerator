import { describe, it, expect } from 'vitest';
import { CREATOR_META, MOCK_CREATORS, buildChannelMetrics } from '@/api/mock/creators';
import type { Creator } from '@/api/creators';
import { campaignParticipantIds } from '@/api/creatorPerformance';

/** 解析 compact 格式（"2.40M"/"180.0K"/"567"）为数值。 */
const parseCompact = (s: string): number => {
  const m = s.match(/([\d.]+)\s*([MK]?)/i);
  if (!m) return 0;
  const v = parseFloat(m[1]);
  return /M/i.test(m[2]) ? v * 1e6 : /K/i.test(m[2]) ? v * 1e3 : v;
};

const CHANNEL_LABELS = ['Avg Reach', 'Impressions', 'Follower Growth', 'CPM'];

describe('buildChannelMetrics (频道指标生成器)', () => {
  const mia = CREATOR_META.find((c) => c.id === 'cre-mia')!; // mega
  const tom = CREATOR_META.find((c) => c.id === 'cre-tom')!; // micro

  it('返回恰好 4 项指标，标签固定', () => {
    const m = buildChannelMetrics(mia, 0);
    expect(m).toHaveLength(4);
    expect(m.map((x) => x.label)).toEqual(CHANNEL_LABELS);
  });

  it('每项都有 label/value/compare，compare 为空串', () => {
    for (const x of buildChannelMetrics(mia, 0)) {
      expect(typeof x.label).toBe('string');
      expect(typeof x.value).toBe('string');
      expect(x.value.length).toBeGreaterThan(0);
      expect(x.compare).toBe('');
    }
  });

  it('确定性：同输入→同输出（无 RNG / 无 Date）', () => {
    expect(buildChannelMetrics(mia, 0)).toEqual(buildChannelMetrics(mia, 0));
  });

  it('tier 量级：mega 的 Avg Reach > micro 的 Avg Reach', () => {
    const reach = (meta: Omit<Creator, 'metrics'>, i: number) =>
      parseCompact(buildChannelMetrics(meta, i).find((x) => x.label === 'Avg Reach')!.value);
    expect(reach(mia, 0)).toBeGreaterThan(reach(tom, 1));
  });

  it('Follower Growth 形如 +N(K/M)', () => {
    const g = buildChannelMetrics(mia, 0).find((x) => x.label === 'Follower Growth')!.value;
    expect(g.startsWith('+')).toBe(true);
  });

  it('CPM 形如 $N', () => {
    const c = buildChannelMetrics(mia, 0).find((x) => x.label === 'CPM')!.value;
    expect(c.startsWith('$')).toBe(true);
  });
});

describe('达人库 roster', () => {
  it('共 12 名达人', () => {
    expect(MOCK_CREATORS).toHaveLength(12);
    expect(CREATOR_META).toHaveLength(12);
  });

  it('原 7 名 campaign 合作达人保留（id 与 tier 不变）', () => {
    const byId = Object.fromEntries(CREATOR_META.map((c) => [c.id, c]));
    const must = ['cre-mia', 'cre-sofia', 'cre-ava', 'cre-jamie', 'cre-leo', 'cre-nora', 'cre-tom'];
    for (const id of must) expect(byId[id], `missing ${id}`).toBeDefined();
    expect(byId['cre-mia'].tier).toBe('mega');
    expect(byId['cre-jamie'].tier).toBe('micro');
    expect(byId['cre-tom'].tier).toBe('micro');
  });

  it('新增 5 名库专属达人', () => {
    const byId = Object.fromEntries(CREATOR_META.map((c) => [c.id, c]));
    for (const id of ['cre-iris', 'cre-kenji', 'cre-priya', 'cre-marcus', 'cre-yuki']) {
      expect(byId[id], `missing ${id}`).toBeDefined();
    }
  });

  it('每个达人 metrics 恰好 4 项且标签固定（频道指标，非 campaign）', () => {
    const labels = ['Avg Reach', 'Impressions', 'Follower Growth', 'CPM'];
    for (const c of MOCK_CREATORS) {
      expect(c.metrics.map((m) => m.label)).toEqual(labels);
    }
  });
});

describe('campaign 合作达人是达人库的子集', () => {
  it('每个 campaign 参与者 id 都存在于达人库', () => {
    const libIds = new Set(MOCK_CREATORS.map((c) => c.id));
    for (const id of campaignParticipantIds()) {
      expect(libIds.has(id), `campaign creator ${id} not in library`).toBe(true);
    }
  });

  it('恰好 7 名达人参与 campaign（5 名为库专属未合作）', () => {
    const participants = new Set(campaignParticipantIds());
    expect(participants.size).toBe(7);
    const libraryOnly = MOCK_CREATORS.filter((c) => !participants.has(c.id));
    expect(libraryOnly).toHaveLength(5);
  });
});
