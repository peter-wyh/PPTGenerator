import { describe, it, expect } from 'vitest';
import { CREATOR_META, buildChannelMetrics } from '@/api/mock/creators';
import type { Creator } from '@/api/creators';

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

  it('CPM 形如 ¥N', () => {
    const c = buildChannelMetrics(mia, 0).find((x) => x.label === 'CPM')!.value;
    expect(c.startsWith('¥')).toBe(true);
  });
});
