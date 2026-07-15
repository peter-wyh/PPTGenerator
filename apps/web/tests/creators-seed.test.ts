import { describe, it, expect } from 'vitest';
import { MOCK_CREATORS, buildAudience, buildWorks, buildStats } from '@/api/mock/creators';

const isSlice = (x: unknown) =>
  !!x &&
  typeof x === 'object' &&
  typeof (x as { label?: unknown }).label === 'string' &&
  typeof (x as { value?: unknown }).value === 'number';

describe('MOCK_CREATORS seed — audience/works/stats', () => {
  it('每条 creator 含 audience(genderSplit/ageRange/topCities 均为 slice 数组)', () => {
    for (const c of MOCK_CREATORS) {
      const a = c.audience;
      expect(a, `${c.id} audience`).toBeTruthy();
      expect(Array.isArray(a!.genderSplit) && a!.genderSplit!.every(isSlice)).toBe(true);
      expect(Array.isArray(a!.ageRange) && a!.ageRange!.every(isSlice)).toBe(true);
      expect(Array.isArray(a!.topCities) && a!.topCities!.every(isSlice)).toBe(true);
    }
  });

  it('每条 creator 含 works(数组,项有 id+title)', () => {
    for (const c of MOCK_CREATORS) {
      expect(Array.isArray(c.works), `${c.id} works`).toBe(true);
      for (const w of c.works!) {
        expect(typeof w.id).toBe('string');
        expect(typeof w.title).toBe('string');
      }
    }
  });

  it('每条 creator 含 stats(数组,项有 label+value+color)', () => {
    for (const c of MOCK_CREATORS) {
      expect(Array.isArray(c.stats), `${c.id} stats`).toBe(true);
      for (const s of c.stats!) {
        expect(typeof s.label).toBe('string');
        expect(typeof s.value).toBe('string');
        expect(typeof s.color).toBe('string');
      }
    }
  });

  it('buildAudience/buildWorks/buildStats 对单条 meta 产出合法形状', () => {
    const meta = {
      id: 'cre-x',
      name: 'X',
      handle: '@x',
      platform: 'TikTok',
      tier: 'mega',
      followers: '1M',
      engagement: '8%',
      category: 'Beauty',
      region: 'US',
    };
    const a = buildAudience(meta, 0);
    expect(a.genderSplit!.length).toBeGreaterThan(0);
    const w = buildWorks(meta, 0);
    expect(w.length).toBeGreaterThan(0);
    const s = buildStats(meta, 0);
    expect(s.length).toBe(4);
  });
});
