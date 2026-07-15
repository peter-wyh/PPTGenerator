import { describe, it, expect } from 'vitest';
import { defaultIconFor } from '@/editor/kpiIcons';

describe('defaultIconFor', () => {
  it('金额类 → currency', () => {
    expect(defaultIconFor('GMV')).toBe('currency');
    expect(defaultIconFor('Spend')).toBe('currency');
    expect(defaultIconFor('AOV')).toBe('currency');
    expect(defaultIconFor('sales')).toBe('currency');
  });

  it('曝光/浏览类 → eye', () => {
    expect(defaultIconFor('Impressions')).toBe('eye');
    expect(defaultIconFor('曝光')).toBe('eye');
  });

  it('点击类 → target', () => {
    expect(defaultIconFor('Clicks')).toBe('target');
    expect(defaultIconFor('点击')).toBe('target');
  });

  it('比率类 → percent', () => {
    expect(defaultIconFor('CVR')).toBe('percent');
    expect(defaultIconFor('CTR')).toBe('percent');
    expect(defaultIconFor('ROAS')).toBe('percent');
  });

  it('转化/销量类 → cart', () => {
    expect(defaultIconFor('Conversions')).toBe('cart');
    expect(defaultIconFor('销量')).toBe('cart');
  });

  it('粉丝/互动类 → users / heart', () => {
    expect(defaultIconFor('粉丝数')).toBe('users');
    expect(defaultIconFor('点赞')).toBe('heart');
  });

  it('未知指标回退 target', () => {
    expect(defaultIconFor('自定义指标 X')).toBe('target');
  });
});
