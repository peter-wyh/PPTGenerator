import { describe, it, expect } from 'vitest';
import { resolvePageBackground, backgroundType, buildBackgroundTypePatch } from '@/editor/background';
import type { Page } from '@mediakit/shared';

type BgFields = Pick<Page, 'bgColor' | 'bgGradient' | 'bgImage'>;
const P = (over: Partial<BgFields>): BgFields => over as BgFields;

describe('resolvePageBackground — 优先级 bgImage > bgGradient > bgColor > surface', () => {
  it('bgImage 最高', () => {
    expect(
      resolvePageBackground(
        P({ bgImage: 'a.png', bgGradient: { type: 'linear', stops: [] }, bgColor: '#000' }),
      ),
    ).toBe('var(--surface-primary) url(a.png) center/cover no-repeat');
  });
  it('bgGradient 高于 bgColor', () => {
    expect(
      resolvePageBackground(
        P({
          bgGradient: { type: 'linear', angle: 0, stops: [{ color: '#FF5C00', position: 0 }, { color: '#fff', position: 100 }] },
          bgColor: '#000',
        }),
      ),
    ).toBe('linear-gradient(0deg, #FF5C00 0%, #fff 100%)');
  });
  it('仅 bgColor', () => {
    expect(resolvePageBackground(P({ bgColor: '#FF5C00' }))).toBe('#FF5C00');
  });
  it('全空回退到 --page-bg 变量链（玻璃四层 bokeh；非玻璃回退 surface）', () => {
    expect(resolvePageBackground(P({}))).toBe('var(--page-bg, var(--surface-primary))');
  });
});

describe('backgroundType — 由数据推导', () => {
  it('image / gradient / color / none', () => {
    expect(backgroundType(P({ bgImage: 'a.png' }))).toBe('image');
    expect(backgroundType(P({ bgGradient: { type: 'linear', stops: [] } }))).toBe('gradient');
    expect(backgroundType(P({ bgColor: '#000' }))).toBe('color');
    expect(backgroundType(P({}))).toBe('none');
  });
});

describe('buildBackgroundTypePatch — 单选切换', () => {
  it('切到 color：写 bgColor（缺省 surface），清 gradient/image', () => {
    const p = P({ bgGradient: { type: 'linear', stops: [] }, bgImage: 'a.png' });
    expect(buildBackgroundTypePatch(p, 'color')).toEqual({
      bgColor: 'var(--surface-primary)',
      bgGradient: undefined,
      bgImage: undefined,
    });
  });
  it('切到 color：保留已有 bgColor', () => {
    const p = P({ bgColor: '#FF5C00' });
    expect(buildBackgroundTypePatch(p, 'color')).toEqual({
      bgColor: '#FF5C00',
      bgGradient: undefined,
      bgImage: undefined,
    });
  });
  it('切到 gradient：用旧 bgColor 做第一 stop，清 color/image', () => {
    const p = P({ bgColor: '#FF5C00', bgImage: 'a.png' });
    expect(buildBackgroundTypePatch(p, 'gradient')).toEqual({
      bgColor: undefined,
      bgGradient: {
        type: 'linear',
        angle: 180,
        stops: [
          { color: '#FF5C00', position: 0 },
          { color: 'var(--border-default)', position: 100 },
        ],
      },
      bgImage: undefined,
    });
  });
  it('切到 gradient：无旧 bgColor 时第一 stop surface', () => {
    expect(buildBackgroundTypePatch(P({}), 'gradient')).toEqual({
      bgColor: undefined,
      bgGradient: {
        type: 'linear',
        angle: 180,
        stops: [
          { color: 'var(--surface-primary)', position: 0 },
          { color: 'var(--border-default)', position: 100 },
        ],
      },
      bgImage: undefined,
    });
  });
  it('切到 image：清 color/gradient，保留 bgImage', () => {
    const p = P({ bgColor: '#FF5C00', bgGradient: { type: 'linear', stops: [] }, bgImage: 'a.png' });
    expect(buildBackgroundTypePatch(p, 'image')).toEqual({
      bgColor: undefined,
      bgGradient: undefined,
      bgImage: 'a.png',
    });
  });
  it('切到 none：全清', () => {
    const p = P({ bgColor: '#FF5C00', bgGradient: { type: 'linear', stops: [] }, bgImage: 'a.png' });
    expect(buildBackgroundTypePatch(p, 'none')).toEqual({
      bgColor: undefined,
      bgGradient: undefined,
      bgImage: undefined,
    });
  });
});
