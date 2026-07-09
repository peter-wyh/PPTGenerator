import { describe, it, expect } from 'vitest';
import {
  DEFAULT_THEME,
  STYLE_PRESETS,
  normalizeTheme,
} from '@mediakit/shared';

describe('ProjectTheme.layout defaults', () => {
  it('DEFAULT_THEME.layout has expected defaults', () => {
    expect(DEFAULT_THEME.layout).toBeDefined();
    expect(DEFAULT_THEME.layout!.safeMargin).toBe(48);
    expect(DEFAULT_THEME.layout!.gridSize).toBe(10);
    expect(DEFAULT_THEME.layout!.showGrid).toBe(true);
    expect(DEFAULT_THEME.layout!.showSafeArea).toBe(true);
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
    expect(t.layout!.safeMargin).toBe(48);
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
