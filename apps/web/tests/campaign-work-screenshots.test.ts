import { describe, it, expect } from 'vitest';
import { campaignWorkScreenshots } from '@/api/creatorPerformance';

describe('campaignWorkScreenshots', () => {
  it('returns deterministic creator-work screenshots for a known campaign', () => {
    const shots = campaignWorkScreenshots('camp-glowlab-q4');
    // 10 creators: Mia(mega,6) + Sofia(macro,5) + Tom(micro,4) + Iris(macro,5) + Ava(macro,5)
    //            + Jamie(micro,4) + Nora(macro,5) + Priya(micro,4) + Yuki(micro,4) + Marcus(macro,5) = 47
    expect(shots).toHaveLength(47);
    expect(shots.every((s) => s.src.startsWith('https://picsum.photos/seed/'))).toBe(true);
    expect(shots[0].caption ?? '').toContain('·');
    // 同输入 → 同输出（确定性）
    expect(campaignWorkScreenshots('camp-glowlab-q4')).toEqual(shots);
  });

  it('returns [] for an unknown campaign', () => {
    expect(campaignWorkScreenshots('does-not-exist')).toEqual([]);
  });
});
