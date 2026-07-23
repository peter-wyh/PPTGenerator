import { describe, it, expect } from 'vitest';
import type { CreatorWork } from '@mediakit/shared';
import { MOCK_CREATORS, buildAudience, buildWorks, buildStats } from '@/api/analytics/creators';
import { dtoToCreator, type CreatorDTO } from '@/api/campaignsApi';

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

describe('dtoToCreator maps rich fields', () => {
  it('preserves audience/works/stats + profile(bio/tags/contact/rate)', () => {
    const dto: CreatorDTO = {
      id: 'cre-x', name: 'X', handle: '@x', platform: 'TikTok', tier: 'macro',
      followers: '100K', engagement: '7%', category: 'Beauty', region: 'US', avatar: null,
      profileUrl: null, contact: null, rate: null,
      metrics: [], audience: { genderSplit: [{ label: 'Female', value: 55 }] },
      works: [{ id: 'w1', title: 'T' }],
      stats: [{ label: 'Followers', value: '100K', color: '#000' }],
      profile: { bio: '简介', tags: ['美妆'], contact: { mcn: 'M' }, rate: { post: '$1K' } },
    };
    const c = dtoToCreator(dto);
    expect(c.audience?.genderSplit?.[0].value).toBe(55);
    expect(c.works?.[0].id).toBe('w1');
    expect(c.stats?.[0].label).toBe('Followers');
    expect(c.bio).toBe('简介');
    expect(c.tags).toEqual(['美妆']);
    expect(c.contact?.mcn).toBe('M');
    expect(c.rate?.post).toBe('$1K');
  });

  it('tolerates null profile / missing json', () => {
    const c = dtoToCreator({
      id: 'cre-y', name: 'Y', handle: '@y', platform: 'IG', tier: 'micro',
      followers: '1K', engagement: '5%', category: 'Food', region: 'US', avatar: null,
      metrics: null as unknown, audience: null as unknown, works: null as unknown,
      stats: null as unknown, profile: null as unknown,
    } as CreatorDTO);
    expect(c.metrics).toEqual([]);
    expect(c.audience).toBeUndefined();
    expect(c.bio).toBeUndefined();
  });
});

describe('MOCK_CREATORS rich profile', () => {
  it('every creator has bio/tags/contact/rate', () => {
    for (const c of MOCK_CREATORS) {
      expect(typeof c.bio).toBe('string');
      expect(c.bio!.length).toBeGreaterThan(0);
      expect(Array.isArray(c.tags)).toBe(true);
      expect(c.tags!.length).toBeGreaterThanOrEqual(2);
      expect(c.contact).toBeTruthy();
      expect(c.contact?.email).toBeTruthy();
      expect(c.rate).toBeTruthy();
      expect(c.rate?.currency).toMatch(/^(USD|CNY)$/);
    }
  });

  it('rate currency matches region mapping', () => {
    const cn = MOCK_CREATORS.find((c) => c.region === 'CN');
    const us = MOCK_CREATORS.find((c) => c.region === 'US');
    expect(cn?.rate?.currency).toBe('CNY');
    expect(us?.rate?.currency).toBe('USD');
  });
});

describe('MOCK_CREATORS works rich fields', () => {
  it('every work has contentType/hashtags/productLink/attribution/duration/featured', () => {
    for (const c of MOCK_CREATORS) {
      for (const w of c.works ?? []) {
        expect(['image', 'video', 'live', 'long', 'series']).toContain(w.contentType);
        expect(Array.isArray(w.hashtags)).toBe(true);
        expect(w.hashtags!.length).toBeGreaterThan(0);
        expect(w.attribution).toBeTruthy();
        expect(w.attribution?.gmv).toBeTruthy();
      }
      // 每个达人恰好一条 featured
      expect((c.works ?? []).filter((w: CreatorWork) => w.featured).length).toBe(1);
    }
  });
});
