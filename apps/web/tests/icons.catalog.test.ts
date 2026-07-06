import { describe, it, expect } from 'vitest';
import { ICONS, ICON_CATEGORIES, ICON_WEIGHTS, findIcon } from '@/editor/icons/catalog';

describe('icon catalog', () => {
  it('exposes 6 weights', () => {
    expect(ICON_WEIGHTS).toEqual(['thin', 'light', 'regular', 'bold', 'fill', 'duotone']);
  });

  it('every icon has stable key + category + Comp', () => {
    for (const ic of ICONS) {
      expect(typeof ic.key).toBe('string');
      expect(ic.key.length).toBeGreaterThan(0);
      expect(ICON_CATEGORIES.map((c) => c.id)).toContain(ic.category);
      expect(typeof ic.Comp).toBe('object'); // React 组件
      expect(typeof ic.label).toBe('string');
    }
  });

  it('keys are unique', () => {
    const keys = ICONS.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('findIcon returns def by key, undefined when missing', () => {
    expect(findIcon(ICONS[0].key)).toBe(ICONS[0]);
    expect(findIcon('non-existent-key')).toBeUndefined();
    expect(findIcon(undefined)).toBeUndefined();
  });
});
