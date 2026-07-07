import { describe, it, expect } from 'vitest';
import { CREATOR_METRIC_CATALOG, type CreatorStatItem, type ShapeData, type ShapeKind } from '@mediakit/shared';

describe('creator stat types & catalog', () => {
  it('catalog has 8 standard metrics with stable keys', () => {
    const keys = CREATOR_METRIC_CATALOG.map((m) => m.key);
    expect(keys).toEqual([
      'followers', 'engagement', 'reach', 'impressions',
      'cpm', 'cpe', 'completion', 'growth',
    ]);
    for (const m of CREATOR_METRIC_CATALOG) {
      expect(typeof m.label).toBe('string');
      expect(typeof m.color).toBe('string');
      expect(typeof m.placeholder).toBe('string');
    }
  });

  it('CreatorStatItem accepts optional key/selected', () => {
    const item: CreatorStatItem = { label: '粉丝', value: '1M', color: '#FF5C00' };
    const full: CreatorStatItem = { key: 'followers', label: '粉丝', value: '1M', color: '#FF5C00', selected: true };
    expect(item.selected).toBeUndefined();
    expect(full.selected).toBe(true);
  });
});

describe('shape types', () => {
  it('ShapeKind has 4 values', () => {
    const kinds: ShapeKind[] = ['rectangle', 'rounded', 'circle', 'line'];
    expect(kinds).toHaveLength(4);
  });
  it('ShapeData 可构造', () => {
    const rect: ShapeData = { shape: 'rectangle', fill: '#FF5C00', stroke: '#E5E7EB', strokeWidth: 0, opacity: 1, rotation: 0 };
    const line: ShapeData = { shape: 'line', stroke: '#E5E7EB', strokeWidth: 1, opacity: 1, rotation: 0, dash: false };
    expect(rect.shape).toBe('rectangle');
    expect(line.shape).toBe('line');
  });
});
