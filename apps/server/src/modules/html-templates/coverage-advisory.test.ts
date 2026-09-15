import { describe, it, expect } from 'vitest';
import { coverageAdvisory, lpScale } from './ai-generate.service';

describe('0911 coverage-advisory (C 方案: 覆盖度感知口径裁决)', () => {
  it('lpScale: LP 聚合列提供订单侧真值标尺', () => {
    expect(lpScale({ orders: 3398, gmv: 118449.3 })).toEqual({ orders: 3398, gmv: 118449.3 });
    expect(lpScale(null)).toBeNull();
    expect(lpScale({ orders: 0, gmv: 0 })).toBeNull(); // 空 LP 不当标尺
  });

  it('订单表覆盖 LP 的 80% 以上 → use-order-table', () => {
    expect(coverageAdvisory(3000, 3398)).toBe('use-order-table'); // 88%
    expect(coverageAdvisory(2719, 3398)).toBe('use-order-table'); // 恰好 80% 边界(含)
  });

  it('订单表覆盖不足 80% → fall-back-to-lp (wander 实测 1.8%)', () => wanderCase());

  function wanderCase() {
    // wander: 订单 60 vs LP 3398 → 1.8% → 回落 LP 口径
    const r = coverageAdvisory(60, 3398);
    if (r !== 'fall-back-to-lp') throw new Error(`expected fall-back-to-lp, got ${r}`);
    return expect(r).toBe('fall-back-to-lp');
  }

  it('LP 无订单(0) → 不裁决,保持订单表 (use-order-table)', () => {
    expect(coverageAdvisory(500, 0)).toBe('use-order-table');
  });

  it('订单表无订单 → fall-back-to-lp (订单表空)', () => {
    expect(coverageAdvisory(0, 1000)).toBe('fall-back-to-lp');
  });
});
