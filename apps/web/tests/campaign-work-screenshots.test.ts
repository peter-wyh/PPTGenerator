import { describe, it, expect } from 'vitest';
import { campaignWorkScreenshots } from '@/api/creatorPerformance';

describe('campaignWorkScreenshots', () => {
  it('returns deterministic creator-work screenshots for a known campaign', () => {
    const shots = campaignWorkScreenshots('camp-glowlab-q4');
    // Mia(头部,4) + Sofia(腰部,3) + Tom(KOC,2) = 9
    expect(shots).toHaveLength(9);
    expect(shots.every((s) => s.src.startsWith('https://picsum.photos/seed/'))).toBe(true);
    expect(shots[0].caption ?? '').toContain('·');
    // 同输入 → 同输出（确定性）
    expect(campaignWorkScreenshots('camp-glowlab-q4')).toEqual(shots);
  });

  it('returns [] for an unknown campaign', () => {
    expect(campaignWorkScreenshots('does-not-exist')).toEqual([]);
  });
});
