import { describe, it, expect } from 'vitest';
import { createProjectSchema, updateProjectSchema } from '../src/modules/projects/projects.schema';

/** 含渐变的页（模拟前端保存时的 pages 项）。 */
const pageWithGradient = {
  id: 'p1',
  name: 'P1',
  bgGradient: {
    type: 'linear' as const,
    angle: 90,
    stops: [
      { color: '#FF5C00', position: 0 },
      { color: '#FFFFFF', position: 100 },
    ],
  },
  components: [],
};

type ParsedPage = { bgGradient?: { type: string; stops: unknown[] } };

describe('pageSchema 保留 bgGradient（存盘/重载 round-trip）', () => {
  it('createProjectSchema 不剥离 bgGradient', () => {
    const out = createProjectSchema.parse({ name: 'n', pages: [pageWithGradient] });
    const page = (out.pages as unknown as ParsedPage[])[0];
    expect(page.bgGradient).toBeDefined();
    expect(page.bgGradient?.type).toBe('linear');
    expect(page.bgGradient?.stops).toHaveLength(2);
  });

  it('updateProjectSchema 不剥离 bgGradient', () => {
    const out = updateProjectSchema.parse({ pages: [pageWithGradient] });
    const page = (out.pages as unknown as ParsedPage[])[0];
    expect(page.bgGradient).toBeDefined();
    expect(page.bgGradient?.stops).toHaveLength(2);
  });

  it('径向渐变（无 angle）通过校验', () => {
    const radialPage = {
      id: 'p2',
      name: 'P2',
      bgGradient: { type: 'radial', stops: [{ color: '#FFF', position: 0 }, { color: '#000', position: 100 }] },
      components: [],
    };
    const out = updateProjectSchema.parse({ pages: [radialPage] });
    const page = (out.pages as unknown as ParsedPage[])[0];
    expect(page.bgGradient?.type).toBe('radial');
  });

  it('无 bgGradient 的旧页仍可解析（向后兼容）', () => {
    const out = createProjectSchema.parse({ name: 'n', pages: [{ id: 'p3', name: 'P3', components: [] }] });
    const page = (out.pages as unknown as ParsedPage[])[0];
    expect(page.bgGradient).toBeUndefined();
  });
});

/** 取 createProjectSchema 内嵌的 projectThemeSchema 解析结果（meta.theme）。 */
function parseTheme(theme: unknown) {
  return createProjectSchema.parse({
    name: 'p',
    width: 1280,
    height: 720,
    meta: { theme: theme as never },
  });
}

describe('projectThemeSchema.layout', () => {
  it('accepts a theme with a valid layout', () => {
    const r = parseTheme({ layout: { safeMargin: 48, gridSize: 10, showGrid: true, showSafeArea: true } });
    expect(r.meta?.theme?.layout).toEqual({ safeMargin: 48, gridSize: 10, showGrid: true, showSafeArea: true });
  });

  it('accepts a theme without layout (optional)', () => {
    const r = parseTheme({ color: { primary: '#FF5C00' } });
    expect(r.meta?.theme?.layout).toBeUndefined();
  });

  it('rejects gridSize out of range (0)', () => {
    expect(() => parseTheme({ layout: { safeMargin: 40, gridSize: 0 } })).toThrow();
  });

  it('rejects safeMargin out of range (negative)', () => {
    expect(() => parseTheme({ layout: { safeMargin: -5, gridSize: 10 } })).toThrow();
  });
});
