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
});
