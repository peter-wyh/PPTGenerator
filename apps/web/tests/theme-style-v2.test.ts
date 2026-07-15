import { describe, it, expect } from 'vitest';
import { themeToCssVars, resolveChartStyle } from '../src/editor/theme';
import { DEFAULT_THEME } from '@mediakit/shared';

const vars = (theme: object) => themeToCssVars(theme as any) as Record<string, string>;

describe('themeToCssVars v2 变量', () => {
  it('行高 ratio → 裸倍数', () => {
    expect(vars({ ...DEFAULT_THEME, lineHeight: { mode: 'ratio', value: 1.5 } })['--line-height']).toBe('1.5');
  });
  it('行高 fixed → calc(1em + Npx)', () => {
    expect(vars({ ...DEFAULT_THEME, lineHeight: { mode: 'fixed', value: 8 } })['--line-height']).toBe(
      'calc(1em + 8px)',
    );
  });
  it('shadow 各档映射 box-shadow', () => {
    expect(vars({ ...DEFAULT_THEME, shadow: 'none' })['--shadow-card']).toBe('none');
    expect(vars({ ...DEFAULT_THEME, shadow: 'soft' })['--shadow-card']).toBe('0 2px 8px var(--shadow-color, rgba(0,0,0,.08))');
    expect(vars({ ...DEFAULT_THEME, shadow: 'strong' })['--shadow-card']).toBe('0 8px 24px var(--shadow-color, rgba(0,0,0,.12))');
  });
});

describe('resolveChartStyle', () => {
  it('默认：显示轴/网格，legend=bottom，barRadius 来自入参', () => {
    expect(resolveChartStyle({ showAxis: true, showGrid: true, legendPosition: 'bottom', barRadius: 6 })).toEqual({
      showAxis: true,
      showGrid: true,
      legend: { verticalAlign: 'bottom' },
      barRadius: 6,
    });
  });
  it('legendPosition=none → legend=false', () => {
    expect(resolveChartStyle({ showAxis: true, showGrid: true, legendPosition: 'none', barRadius: 4 }).legend).toBe(false);
  });
  it('legendPosition=top/right 映射 recharts legend props', () => {
    expect(resolveChartStyle({ showAxis: true, showGrid: true, legendPosition: 'top', barRadius: 4 }).legend).toEqual({
      verticalAlign: 'top',
    });
    expect(resolveChartStyle({ showAxis: true, showGrid: true, legendPosition: 'right', barRadius: 4 }).legend).toEqual({
      verticalAlign: 'middle',
      align: 'right',
      layout: 'vertical',
    });
  });
  it('undefined 入参 → DEFAULT_CHART_CFG', () => {
    expect(resolveChartStyle(undefined).barRadius).toBe(4);
    expect(resolveChartStyle(undefined).showGrid).toBe(true);
  });
});

describe('themeToCssVars 不再输出 skin 变量', () => {
  it('skinPreset=flat 不再设 --skin-radius-card / --skin-shadow-card', () => {
    const v = vars({ ...DEFAULT_THEME, skinPreset: 'flat' } as never);
    expect(v['--skin-radius-card']).toBeUndefined();
    expect(v['--skin-shadow-card']).toBeUndefined();
  });

  it('skinPreset=elevated 不再设 --skin-*', () => {
    const v = vars({ ...DEFAULT_THEME, skinPreset: 'elevated' } as never);
    expect(v['--skin-radius-card']).toBeUndefined();
    expect(v['--skin-shadow-card']).toBeUndefined();
  });
});
