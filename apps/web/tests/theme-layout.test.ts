import { describe, it, expect } from 'vitest';
import {
  DEFAULT_THEME,
  STYLE_PRESETS,
  normalizeTheme,
} from '@mediakit/shared';

describe('ProjectTheme.layout defaults', () => {
  it('DEFAULT_THEME.layout has expected defaults', () => {
    expect(DEFAULT_THEME.layout).toBeDefined();
    expect(DEFAULT_THEME.layout!.safeMargin).toBe(24);
    expect(DEFAULT_THEME.layout!.gridSize).toBe(10);
    expect(DEFAULT_THEME.layout!.showGrid).toBe(true);
    expect(DEFAULT_THEME.layout!.showSafeArea).toBe(true);
  });

  it('DEFAULT_THEME 携带 v2 新维度默认值', () => {
    expect(DEFAULT_THEME.lineHeight).toEqual({ mode: 'ratio', value: 1.5 });
    expect(DEFAULT_THEME.format).toEqual({
      currencySymbol: '$',
      currencyPosition: 'before',
      thousandsSep: true,
      decimals: 0,
      compact: 'none',
    });
    expect(DEFAULT_THEME.chart).toEqual({ showAxis: true, showGrid: true, legendPosition: 'bottom', barRadius: 4 });
    expect(DEFAULT_THEME.shadow).toBe('soft');
  });

  it('every STYLE_PRESETS entry carries a layout block', () => {
    for (const p of STYLE_PRESETS) {
      expect(p.theme.layout).toBeDefined();
      expect(p.theme.layout!.safeMargin).toBeGreaterThan(0);
      expect(p.theme.layout!.gridSize).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('normalizeTheme layout tolerance', () => {
  it('fills layout defaults when missing (new-shape theme without layout)', () => {
    const t = normalizeTheme({ color: { primary: '#FF5C00' }, font: { text: 'inter', number: 'inter' } });
    expect(t.layout).toBeDefined();
    expect(t.layout!.safeMargin).toBe(24);
    expect(t.layout!.gridSize).toBe(10);
  });

  it('fills layout defaults for legacy flat theme', () => {
    const t = normalizeTheme({ primary: '#FF5C00', secondary: '#FF8533', fontFamily: "'Inter', sans-serif" });
    expect(t.layout).toBeDefined();
    expect(t.layout!.gridSize).toBe(10);
  });

  it('keeps provided layout fields and fills the rest', () => {
    const t = normalizeTheme({ layout: { safeMargin: 100 } });
    expect(t.layout!.safeMargin).toBe(100);
    expect(t.layout!.gridSize).toBe(10);
    expect(t.layout!.showGrid).toBe(true);
  });

  it('replaces non-positive gridSize with default', () => {
    const t = normalizeTheme({ layout: { safeMargin: 40, gridSize: 0 } });
    expect(t.layout!.gridSize).toBe(10);
  });

  it('returns layout for empty input', () => {
    expect(normalizeTheme({}).layout).toBeDefined();
    expect(normalizeTheme(null).layout).toBeDefined();
  });
});

describe('normalizeTheme v2 tolerance', () => {
  it('老 theme（无 v2 字段）补齐 v2 默认', () => {
    const t = normalizeTheme({ color: { primary: '#FF5C00' }, font: { text: 'inter', number: 'inter' } });
    expect(t.lineHeight).toEqual({ mode: 'ratio', value: 1.5 });
    expect(t.format!.currencySymbol).toBe('$');
    expect(t.format!.currencyPosition).toBe('before');
    expect(t.chart!.barRadius).toBe(4);
    expect(t.shadow).toBe('soft');
  });

  it('保留已提供的 v2 字段，非法值回退默认', () => {
    const t = normalizeTheme({
      lineHeight: { mode: 'fixed', value: 8 },
      format: { currencySymbol: '€', currencyPosition: 'after', thousandsSep: false, decimals: 2, compact: 'auto' },
      chart: { showAxis: false, showGrid: false, legendPosition: 'top', barRadius: 99 },
      shadow: 'strong',
    });
    expect(t.lineHeight).toEqual({ mode: 'fixed', value: 8 });
    expect(t.format!.currencySymbol).toBe('€');
    expect(t.format!.currencyPosition).toBe('after');
    expect(t.chart!.legendPosition).toBe('top');
    expect(t.chart!.barRadius).toBe(4); // 99 越界 → 4
    expect(t.shadow).toBe('strong');
  });

  it('非法 mode/position/compact 回退默认', () => {
    const t = normalizeTheme({
      lineHeight: { mode: 'bogus', value: -1 },
      format: { currencySymbol: '', currencyPosition: 'side', decimals: 9, compact: 'yes' },
    });
    expect(t.lineHeight).toEqual({ mode: 'ratio', value: 1.5 });
    expect(t.format!.currencyPosition).toBe('before');
    expect(t.format!.currencySymbol).toBe('$');
    expect(t.format!.compact).toBe('none');
  });
});

describe('normalizeTheme skinPreset 迁移', () => {
  it('flat → radius=sharp + shadow=none，且不再输出 skinPreset', () => {
    const t = normalizeTheme({ skinPreset: 'flat' });
    expect(t.radius).toBe('sharp');
    expect(t.shadow).toBe('none');
    expect('skinPreset' in t).toBe(false);
  });

  it('elevated → radius=large + shadow=strong', () => {
    const t = normalizeTheme({ skinPreset: 'elevated' });
    expect(t.radius).toBe('large');
    expect(t.shadow).toBe('strong');
    expect('skinPreset' in t).toBe(false);
  });

  it('default / 无 skinPreset → 不改 radius/shadow', () => {
    const t = normalizeTheme({ radius: 'large', shadow: 'subtle' });
    expect(t.radius).toBe('large');
    expect(t.shadow).toBe('subtle');
    expect('skinPreset' in t).toBe(false);
  });
});
