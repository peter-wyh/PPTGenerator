import { describe, expect, it } from 'vitest';
import { aggregateDimensions } from './dimensions';

describe('aggregateDimensions', () => {
  it('topCategories:按 category group + pct + color,降序', () => {
    const r = aggregateDimensions([
      { category: 'Skincare', gmv: 3000, orders: 30 },
      { category: 'Makeup', gmv: 1000, orders: 10 },
      { category: 'Skincare', gmv: 1000, orders: 10 }, // 同类合并 → 4000
    ]);
    expect(r.topCategories).toEqual([
      { label: 'Skincare', pct: 80, color: '#ff099e' }, // 4000/5000
      { label: 'Makeup', pct: 20, color: '#4f46e5' },   // 1000/5000
    ]);
  });

  it('topProducts:按 productName group,前 5,revenue 格式化', () => {
    const r = aggregateDimensions([
      { productName: 'Serum A', gmv: 5000, orders: 5 },
      { productName: 'Serum B', gmv: 3000, orders: 3 },
    ]);
    expect(r.topProducts).toEqual([
      { name: 'Serum A', revenue: '$5,000' },
      { name: 'Serum B', revenue: '$3,000' },
    ]);
  });

  it('topMarket:按 market group + revenue + pct + color', () => {
    const r = aggregateDimensions([{ market: 'US', gmv: 8000, orders: 8 }, { market: 'EU', gmv: 2000, orders: 2 }]);
    expect(r.topMarket).toEqual([
      { country: 'US', revenue: '$8,000', pct: 80, color: '#ff099e' },
      { country: 'EU', revenue: '$2,000', pct: 20, color: '#4f46e5' },
    ]);
  });

  it('topPromotion:按 promoName group,type/promoType/usage(=orders)/tagKind', () => {
    const r = aggregateDimensions([
      { promoName: 'Summer Sale', promoType: 'discount', gmv: 4000, orders: 40 },
      { promoName: 'Bundle A', promoType: 'bundle', gmv: 1000, orders: 5 },
    ]);
    expect(r.topPromotion).toEqual([
      { name: 'Summer Sale', type: 'discount', revenue: '$4,000', usage: '40', tagKind: 'discount' },
      { name: 'Bundle A', type: 'bundle', revenue: '$1,000', usage: '5', tagKind: 'bundle' },
    ]);
  });

  it('某维度全空 → 该维度 undefined(降级)', () => {
    const r = aggregateDimensions([{ category: 'Skincare', gmv: 1000, orders: 1 }]);
    expect(r.topCategories).toBeDefined();
    expect(r.topProducts).toBeUndefined();
    expect(r.topMarket).toBeUndefined();
    expect(r.topPromotion).toBeUndefined();
  });

  it('总 gmv=0 → pct=0(除零保护),不 NaN', () => {
    const r = aggregateDimensions([{ category: 'X', gmv: 0, orders: 0 }]);
    expect(r.topCategories).toEqual([{ label: 'X', pct: 0, color: '#ff099e' }]);
  });

  it('调色板不足 → 循环复用', () => {
    const links = Array.from({ length: 8 }, (_, i) => ({ category: `C${i}`, gmv: 8 - i, orders: 1 }));
    const r = aggregateDimensions(links)!;
    expect(r.topCategories!.length).toBe(8);
    expect(r.topCategories![0].color).toBe(r.topCategories![6].color); // 0 和 6 同色(6 色循环)
  });

  it('tagKind 未知 promoType → gift 兜底', () => {
    const r = aggregateDimensions([{ promoName: 'Mystery', promoType: 'unknown', gmv: 1, orders: 1 }]);
    expect(r.topPromotion![0].tagKind).toBe('gift');
  });

  it('一条 link 含全部维度 → 4 维度同时产出(无串扰)', () => {
    const r = aggregateDimensions([{
      productName: 'Serum', category: 'Skincare', market: 'US',
      promoName: 'Sale', promoType: 'discount', gmv: 1000, orders: 10,
    }]);
    expect(r.topCategories).toEqual([{ label: 'Skincare', pct: 100, color: '#ff099e' }]);
    expect(r.topProducts).toEqual([{ name: 'Serum', revenue: '$1,000' }]);
    expect(r.topMarket).toEqual([{ country: 'US', revenue: '$1,000', pct: 100, color: '#ff099e' }]);
    expect(r.topPromotion).toEqual([{ name: 'Sale', type: 'discount', revenue: '$1,000', usage: '10', tagKind: 'discount' }]);
  });

  it('topProducts 降序取前 5(slice 上限)', () => {
    const links = Array.from({ length: 8 }, (_, i) => ({ productName: `P${i}`, gmv: 8 - i, orders: 1 }));
    const r = aggregateDimensions(links)!;
    expect(r.topProducts).toHaveLength(5);
    expect(r.topProducts![0].name).toBe('P0'); // gmv=8 最高
    expect(r.topProducts![4].name).toBe('P4'); // gmv=4,第 5
  });
});
