import { describe, it, expect } from 'vitest';
import { campaignWorkScreenshots } from '@/api/creatorPerformance';

describe('campaignWorkScreenshots', () => {
  it('returns deterministic creator-work screenshots for a known campaign', () => {
    const shots = campaignWorkScreenshots('camp-glowlab-q4');
    // 10 creators: Mia(mega,4) + Sofia(macro,3) + Tom(micro,2) + Iris(macro,3) + Ava(macro,3)
    //            + Jamie(micro,2) + Nora(macro,3) + Priya(micro,2) + Yuki(micro,2) + Marcus(macro,3) = 27
    expect(shots).toHaveLength(27);
    expect(shots.every((s) => s.src.startsWith('https://picsum.photos/seed/'))).toBe(true);
    expect(shots[0].caption ?? '').toContain('·');
    // 同输入 → 同输出（确定性）
    expect(campaignWorkScreenshots('camp-glowlab-q4')).toEqual(shots);
  });

  it('returns [] for an unknown campaign', () => {
    expect(campaignWorkScreenshots('does-not-exist')).toEqual([]);
  });
});
