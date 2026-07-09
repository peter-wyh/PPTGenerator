import { describe, it, expect } from 'vitest';
import {
  createProjectSchema,
  updateProjectSchema,
  pageSchema,
} from '../src/modules/projects/projects.schema';

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

describe('pageSchema — 页面类型字段', () => {
  it('接受带 pageType/titleComponentId/titleOverridden 的页面', () => {
    const r = pageSchema.parse({
      id: 'p1',
      name: '封面',
      components: [],
      pageType: 'media-report',
      titleComponentId: 'c1',
      titleOverridden: false,
    });
    expect(r.pageType).toBe('media-report');
    expect(r.titleComponentId).toBe('c1');
    expect(r.titleOverridden).toBe(false);
  });

  it('接受无 pageType 的旧页面（向后兼容）', () => {
    const r = pageSchema.parse({ id: 'p1', name: 'n', components: [] });
    expect(r.pageType).toBeUndefined();
    expect(r.titleComponentId).toBeUndefined();
    expect(r.titleOverridden).toBeUndefined();
  });

  it('拒绝非法 pageType 取值', () => {
    expect(() => pageSchema.parse({ id: 'p1', name: 'n', components: [], pageType: 'bogus' })).toThrow();
  });
});
