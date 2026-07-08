import { describe, it, expect } from 'vitest';
import { gradientToCss, type PageGradient } from '@mediakit/shared';

describe('gradientToCss', () => {
  it('线性渐变：angle + 两色标', () => {
    const g: PageGradient = {
      type: 'linear',
      angle: 90,
      stops: [
        { color: '#FF5C00', position: 0 },
        { color: '#FFFFFF', position: 100 },
      ],
    };
    expect(gradientToCss(g)).toBe('linear-gradient(90deg, #FF5C00 0%, #FFFFFF 100%)');
  });

  it('径向渐变：忽略 angle，circle at center', () => {
    const g: PageGradient = {
      type: 'radial',
      angle: 90,
      stops: [
        { color: '#FF5C00', position: 0 },
        { color: '#FFFFFF', position: 100 },
      ],
    };
    expect(gradientToCss(g)).toBe('radial-gradient(circle at center, #FF5C00 0%, #FFFFFF 100%)');
  });

  it('按 position 升序排序色标', () => {
    const g: PageGradient = {
      type: 'linear',
      angle: 0,
      stops: [
        { color: '#FFFFFF', position: 100 },
        { color: '#000000', position: 50 },
        { color: '#FF5C00', position: 0 },
      ],
    };
    expect(gradientToCss(g)).toBe('linear-gradient(0deg, #FF5C00 0%, #000000 50%, #FFFFFF 100%)');
  });

  it('position 超界 clamp 到 0–100', () => {
    const g: PageGradient = {
      type: 'linear',
      angle: 0,
      stops: [
        { color: '#FF5C00', position: -20 },
        { color: '#FFFFFF', position: 150 },
      ],
    };
    expect(gradientToCss(g)).toBe('linear-gradient(0deg, #FF5C00 0%, #FFFFFF 100%)');
  });

  it('单色标补齐到 2（同色 0/100）', () => {
    const g = { type: 'linear', angle: 0, stops: [{ color: '#FF5C00', position: 0 }] } as PageGradient;
    expect(gradientToCss(g)).toBe('linear-gradient(0deg, #FF5C00 0%, #FF5C00 100%)');
  });

  it('多于 6 色标截断到 6（先排序后截断）', () => {
    const g: PageGradient = {
      type: 'linear',
      angle: 0,
      stops: [
        { color: '#111111', position: 0 },
        { color: '#222222', position: 20 },
        { color: '#333333', position: 40 },
        { color: '#444444', position: 60 },
        { color: '#555555', position: 80 },
        { color: '#666666', position: 100 },
        { color: '#777777', position: 90 },
      ],
    };
    expect(gradientToCss(g)).toBe(
      'linear-gradient(0deg, #111111 0%, #222222 20%, #333333 40%, #444444 60%, #555555 80%, #777777 90%)',
    );
  });

  it('angle 缺省回退 180', () => {
    const g = {
      type: 'linear',
      stops: [
        { color: '#FF5C00', position: 0 },
        { color: '#FFFFFF', position: 100 },
      ],
    } as PageGradient;
    expect(gradientToCss(g)).toBe('linear-gradient(180deg, #FF5C00 0%, #FFFFFF 100%)');
  });

  it('angle 超界 clamp 0–360', () => {
    const g = {
      type: 'linear',
      angle: 400,
      stops: [
        { color: '#FF5C00', position: 0 },
        { color: '#FFFFFF', position: 100 },
      ],
    } as PageGradient;
    expect(gradientToCss(g)).toBe('linear-gradient(360deg, #FF5C00 0%, #FFFFFF 100%)');
  });

  it('异常输入不抛错，回退纯白线性', () => {
    const fallback = 'linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 100%)';
    expect(gradientToCss(null)).toBe(fallback);
    expect(gradientToCss(undefined)).toBe(fallback);
    expect(gradientToCss({})).toBe(fallback);
  });

  it('非法颜色回退白', () => {
    const g = {
      type: 'linear',
      angle: 0,
      stops: [
        { color: 'not-a-color', position: 0 },
        { color: '#FFFFFF', position: 100 },
      ],
    } as unknown as PageGradient;
    expect(gradientToCss(g)).toBe('linear-gradient(0deg, #FFFFFF 0%, #FFFFFF 100%)');
  });
});
