import { describe, expect, it } from 'vitest';
import { formatMoney, formatNum, formatPct, formatRatio } from './format';

describe('format', () => {
  it('formatMoney:整数美元加千分位 + $ 前缀', () => {
    expect(formatMoney(876360)).toBe('$876,360');
    expect(formatMoney(0)).toBe('$0');
  });
  it('formatMoney:小数四舍五入到整数', () => {
    expect(formatMoney(192000.6)).toBe('$192,001');
  });
  it('formatNum:整数加千分位', () => {
    expect(formatNum(348619)).toBe('348,619');
    expect(formatNum(0)).toBe('0');
  });
  it('formatPct:数字 → 带 % 字符串(入参已是 34.6)', () => {
    expect(formatPct(34.6)).toBe('34.6%');
    expect(formatPct(0)).toBe('0%');
  });
  it('formatRatio → "4.10x"(2 位小数 + x)', () => {
    expect(formatRatio(4)).toBe('4.00x');
    expect(formatRatio(4.105)).toBe('4.11x');   // toFixed 四舍五入
    expect(formatRatio(0.5)).toBe('0.50x');
  });
});
