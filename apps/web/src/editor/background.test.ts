import { describe, expect, it } from 'vitest';
import { resolvePageBackground } from './background';

describe('resolvePageBackground · 0831 玻璃页面背景', () => {
  it('页面无背景字段 + CSS 变量存在 → 缺省走 var(--page-bg)(玻璃模式四层 bokeh)', () => {
    expect(resolvePageBackground({} as any)).toBe('var(--page-bg, var(--surface-primary))');
  });

  it('bgColor 显式设置 → 优先用户值(现状不变)', () => {
    expect(resolvePageBackground({ bgColor: '#123456' } as any)).toBe('#123456');
  });

  it('bgGradient 显式设置 → 优先渐变(现状不变)', () => {
    expect(resolvePageBackground({ bgGradient: { type: 'linear', angle: 90, stops: [{ color: '#fff', position: 0 }, { color: '#000', position: 100 }] } } as any)).toContain('linear-gradient');
  });

  it('bgImage 显式设置 → 优先图片(现状不变)', () => {
    expect(resolvePageBackground({ bgImage: 'https://x/y.png' } as any)).toContain('url(https://x/y.png)');
  });
});
