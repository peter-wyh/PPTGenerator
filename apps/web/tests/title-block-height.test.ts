import { describe, it, expect } from 'vitest';
import { titleHeightForFontSize } from '@/editor/defaults';

/**
 * 标题块动态高度:高度由字号派生(字号×行高 + 副标题/分割线 + 内边距)。
 * 新建标题块、改字号(全局/单组件)时由此函数决定 comp.h。
 */
describe('titleHeightForFontSize', () => {
  it('仅标题:字号 × 1.25 + 8 内边距', () => {
    expect(titleHeightForFontSize(32)).toBe(48); // 32*1.25=40, +8
  });

  it('带副标题:额外加 字号×0.6×1.25', () => {
    expect(titleHeightForFontSize(32, { subtitle: true })).toBe(72); // 48 + 24
  });

  it('带分割线:额外 +4', () => {
    expect(titleHeightForFontSize(32, { divider: true })).toBe(52); // 48 + 4
  });

  it('副标题 + 分割线叠加', () => {
    expect(titleHeightForFontSize(32, { subtitle: true, divider: true })).toBe(76); // 48 + 24 + 4
  });

  it('字号越大高度越大(单调递增)', () => {
    expect(titleHeightForFontSize(40)).toBeGreaterThan(titleHeightForFontSize(32));
    expect(titleHeightForFontSize(24)).toBeLessThan(titleHeightForFontSize(32));
  });
});
