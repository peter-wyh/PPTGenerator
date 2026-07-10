import { describe, it, expect } from 'vitest';
import { formatNumber, formatMoney, DEFAULT_FORMAT } from '@mediakit/shared';
import type { ThemeFormat } from '@mediakit/shared';

const fmt = (over: Partial<ThemeFormat>): ThemeFormat => ({ ...DEFAULT_FORMAT, ...over });

describe('formatNumber', () => {
  it('默认：千分位 + 0 小数', () => {
    expect(formatNumber(1240000)).toBe('1,240,000');
    expect(formatNumber(0)).toBe('0');
  });
  it('decimals 控制小数位', () => {
    expect(formatNumber(72.5, fmt({ decimals: 1 }))).toBe('72.5');
    expect(formatNumber(72.567, fmt({ decimals: 2 }))).toBe('72.57');
  });
  it('thousandsSep=false 去千分位', () => {
    expect(formatNumber(1240000, fmt({ thousandsSep: false }))).toBe('1240000');
  });
  it('compact=auto：≥1e6→M，≥1e3→K（1 位小数，覆盖 decimals）', () => {
    expect(formatNumber(1240000, fmt({ compact: 'auto', decimals: 0 }))).toBe('1.2M');
    expect(formatNumber(98000, fmt({ compact: 'auto' }))).toBe('98.0K');
    expect(formatNumber(500, fmt({ compact: 'auto' }))).toBe('500');
  });
  it('负数保留 -', () => {
    expect(formatNumber(-1240)).toBe('-1,240');
    expect(formatNumber(-1240000, fmt({ compact: 'auto' }))).toBe('-1.2M');
  });
  it('非法输入返回空串', () => {
    expect(formatNumber(NaN)).toBe('');
    expect(formatNumber(undefined)).toBe('');
    expect(formatNumber('abc')).toBe(''); // string 是合法 unknown，运行时非有限数 → ''
  });
});

describe('formatMoney', () => {
  it('before（默认 $）', () => {
    expect(formatMoney(1240000)).toBe('$1,240,000');
    expect(formatMoney(1240000, fmt({ compact: 'auto' }))).toBe('$1.2M');
  });
  it('after 位置 + 自定义符号', () => {
    expect(formatMoney(1240000, fmt({ currencySymbol: '€', currencyPosition: 'after' }))).toBe('1,240,000€');
  });
  it('非法输入返回空串（不加符号）', () => {
    expect(formatMoney(NaN)).toBe('');
  });
});
