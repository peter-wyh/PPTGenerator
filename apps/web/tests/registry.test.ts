import { describe, it, expect } from 'vitest';
import { REGISTRY, GEOMETRY_FIELDS } from '@/editor/registry';
import { DEFAULT_SIZES, getDefaultData } from '@/editor/defaults';
import type { ComponentType } from '@mediakit/shared';

const TYPES: ComponentType[] = [
  'text',
  'image',
  'indicator-card',
  'bar-chart',
  'line-chart',
  'pie-chart',
  'table',
  'business-block',
  'creator-avatar-card',
  'creator-stats-strip',
  'creator-works-list',
  'brand-wall',
  'package-card',
  'kpi-board',
  'timeline-compare',
  'product-performance',
  'placement-display',
  'post-list',
  'creator-fan-gender',
  'creator-fan-city',
  'creator-fan-age',
  'creator-fan-interest',
  'work-screenshot',
  'work-metrics',
  'comment-wordcloud',
  'image-group',
];

describe('REGISTRY', () => {
  it('covers every ComponentType', () => {
    for (const t of TYPES) expect(REGISTRY[t]).toBeDefined();
  });

  it('every block has Component / defaultSize / defaultData / propertySchema', () => {
    for (const t of TYPES) {
      const b = REGISTRY[t];
      expect(typeof b.Component).toBe('function');
      expect(b.defaultSize.w).toBeGreaterThan(0);
      expect(b.defaultSize.h).toBeGreaterThan(0);
      expect(typeof b.defaultData).toBe('function');
      expect(Array.isArray(b.propertySchema)).toBe(true);
    }
  });

  it('defaultSize matches DEFAULT_SIZES and defaultData matches getDefaultData', () => {
    for (const t of TYPES) {
      expect(REGISTRY[t].defaultSize).toEqual(DEFAULT_SIZES[t]);
      expect(REGISTRY[t].defaultData()).toEqual(getDefaultData(t));
    }
  });

  it('exposes x/y/w/h geometry fields', () => {
    expect(GEOMETRY_FIELDS.map((f) => f.key)).toEqual(['x', 'y', 'w', 'h']);
  });

  it('creator-stats-strip defers stats editing to custom panel (empty propertySchema)', () => {
    expect(REGISTRY['creator-stats-strip'].propertySchema).toEqual([]);
  });
});

describe('indicator-card variants', () => {
  const def = REGISTRY['indicator-card'];

  it('declares 4 variants', () => {
    expect(def.variants?.map((v) => v.id)).toEqual(['plain', 'icon-left', 'icon-top', 'icon-bg']);
  });

  it('plain has no icon slot; the other three declare icon slots', () => {
    const byId = Object.fromEntries((def.variants ?? []).map((v) => [v.id, v]));
    expect(byId.plain.icon).toBeUndefined();
    expect(byId['icon-left'].icon?.position).toBe('left');
    expect(byId['icon-top'].icon?.position).toBe('top');
    expect(byId['icon-bg'].icon?.position).toBe('bg');
  });

  it('icon variants carry a default key + weight', () => {
    const byId = Object.fromEntries((def.variants ?? []).map((v) => [v.id, v]));
    expect(byId['icon-top'].icon?.defaultKey).toBeTruthy();
    expect(byId['icon-bg'].icon?.defaultWeight).toBeTruthy();
  });
});
