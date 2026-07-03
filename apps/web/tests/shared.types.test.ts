import { describe, it, expect } from 'vitest';
import { CREATOR_METRIC_CATALOG, type CreatorStatItem } from '@mediakit/shared';

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
