import { describe, expect, it } from 'vitest';
import { themeToCssVars } from './theme';
import { DEFAULT_THEME, type ProjectTheme } from '@mediaket/shared';

const withGlass = (glass: boolean): ProjectTheme =>
  ({ ...DEFAULT_THEME, glass } as ProjectTheme);

describe('themeToCssVars · 0831 毛玻璃升级', () => {
  it('glass=true → 均衡档参数(blur22/白0.45)+ 四边递变高光线', () => {
    const vars = themeToCssVars(withGlass(true)) as Record<string, string>;
    expect(vars['--card-blur']).toBe('blur(22px) saturate(150%)');
    expect(vars['--card-bg']).toContain('55%, transparent'); // color-mix 通道保留
    // 左上亮 → 右下暗
    expect(vars['--card-border-top']).toBe('rgba(255,255,255,0.85)');
    expect(vars['--card-border-left']).toBe('rgba(255,255,255,0.45)');
    expect(vars['--card-border-right']).toBe('rgba(255,255,255,0.25)');
    expect(vars['--card-border-bottom']).toBe('rgba(255,255,255,0.15)');
    expect(vars['--card-glow']).toBe('rgba(255,255,255,0.9)');
    // 页面背景四层 bokeh 渐变(品红/靛蓝/暖橙粉 + 灰蓝底)
    expect(vars['--page-bg']).toContain('rgba(255,9,158,0.30)');
    expect(vars['--page-bg']).toContain('rgba(99,102,241,0.26)');
    expect(vars['--page-bg']).toContain('rgba(250,166,133,0.30)');
    expect(vars['--page-bg']).toContain('#d8dde6');
  });

  it('glass=false → 无玻璃变量、无 --page-bg(现状不变)', () => {
    const vars = themeToCssVars(withGlass(false)) as Record<string, string>;
    expect(vars['--card-blur']).toBeUndefined();
    expect(vars['--page-bg']).toBeUndefined();
  });
});
