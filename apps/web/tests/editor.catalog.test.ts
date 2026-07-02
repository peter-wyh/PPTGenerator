import { describe, it, expect } from 'vitest';
import {
  BUSINESS_GROUPS,
  BUSINESS_BY_ID,
  BUSINESS_LAYOUTS,
  BUSINESS_STYLE_OPTIONS,
  ALL_BUSINESS_KINDS,
  getStyleOptions,
  getLayout,
  getBusinessItem,
} from '@/editor/business/catalog';

describe('business catalog', () => {
  it('has 20 items across 5 groups', () => {
    const total = BUSINESS_GROUPS.reduce((n, g) => n + g.items.length, 0);
    expect(total).toBe(20);
    expect(BUSINESS_GROUPS.map((g) => g.group)).toEqual([
      '基础页面',
      '公司与服务',
      '策略与方案',
      '案例与结案',
      '报价与工具',
    ]);
  });

  it('every item has a layout and is in BUSINESS_BY_ID', () => {
    for (const id of ALL_BUSINESS_KINDS) {
      expect(BUSINESS_BY_ID[id]).toBeDefined();
      expect(BUSINESS_LAYOUTS[id]).toBeDefined();
      const l = BUSINESS_LAYOUTS[id];
      expect(l.w).toBeGreaterThan(0);
      expect(l.h).toBeGreaterThan(0);
      expect(typeof l.form).toBe('string');
    }
  });

  it('every item has at least one style option (standard first)', () => {
    for (const id of ALL_BUSINESS_KINDS) {
      const opts = BUSINESS_STYLE_OPTIONS[id];
      expect(opts).toBeDefined();
      expect(opts.length).toBeGreaterThan(0);
      expect(opts[0][0]).toBe('standard');
    }
  });

  it('getStyleOptions falls back to default 3', () => {
    const opts = getStyleOptions('does-not-exist');
    expect(opts.map((o) => o[0])).toEqual(['standard', 'cards', 'accent']);
  });

  it('getLayout falls back', () => {
    const l = getLayout('nope');
    expect(l.w).toBe(580);
  });

  it('getBusinessItem falls back with safe defaults', () => {
    const it = getBusinessItem('nope');
    expect(it.id).toBe('nope');
    expect(Array.isArray(it.details)).toBe(true);
  });

  it('cover layout + variants are correct', () => {
    expect(BUSINESS_LAYOUTS.cover).toEqual({ w: 760, h: 430, form: '品牌叙事' });
    expect(getStyleOptions('cover').map((o) => o[0])).toEqual(['standard', 'light', 'accent']);
  });

  it('package has table variant', () => {
    expect(getStyleOptions('package').map((o) => o[0])).toContain('table');
  });
});
