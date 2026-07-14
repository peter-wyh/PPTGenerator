import { describe, it, expect } from 'vitest';
import {
  createProjectSchema,
  updateProjectSchema,
  pageSchema,
} from '../src/modules/projects/projects.schema';
import { createTemplateSchema } from '../src/modules/templates/templates.schema';

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

describe('projectThemeSchema.heading', () => {
  it('accepts a theme with a valid heading (fontSize + variant + color)', () => {
    const r = parseTheme({ heading: { fontSize: 40, variant: 'highlight', color: '#FF5C00' } });
    expect(r.meta?.theme?.heading).toEqual({ fontSize: 40, variant: 'highlight', color: '#FF5C00' });
  });

  it('accepts a theme without heading (optional)', () => {
    const r = parseTheme({ color: { primary: '#FF5C00' } });
    expect(r.meta?.theme?.heading).toBeUndefined();
  });

  it('rejects fontSize out of range (< 8)', () => {
    expect(() => parseTheme({ heading: { fontSize: 4 } })).toThrow();
  });

  it('rejects unknown variant', () => {
    expect(() => parseTheme({ heading: { variant: 'unknown' } })).toThrow();
  });

  it('accepts block-underline variant', () => {
    const r = parseTheme({ heading: { variant: 'block-underline' } });
    expect(r.meta?.theme?.heading?.variant).toBe('block-underline');
  });
});

describe('pageSchema — 页面类型字段', () => {
  it('接受带 pageType/titleComponentId/titleOverridden 的页面', () => {
    const r = pageSchema.parse({
      id: 'p1',
      name: '封面',
      components: [],
      pageType: 'report-weekly-overview',
      titleComponentId: 'c1',
      titleOverridden: false,
    });
    expect(r.pageType).toBe('report-weekly-overview');
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

  it('把历史遗留的 PageCategory 串归一为 undefined（惰性迁移）', () => {
    // 旧编辑器曾把页面大类（campaign-report / creator-case / media-report / creator-collab）
    // 误当作 pageType 持久化；当前枚举不含这些值，归一为 undefined 使存量项目可重新保存。
    for (const legacy of ['campaign-report', 'creator-case', 'media-report', 'creator-collab']) {
      const r = pageSchema.parse({ id: 'p1', name: 'n', components: [], pageType: legacy });
      expect(r.pageType).toBeUndefined();
    }
  });
});

describe('projectMetaSchema — templateType / isDefault', () => {
  it('createProjectSchema 接受 meta.templateType(任意字符串)', () => {
    const out = createProjectSchema.parse({ name: 'n', meta: { templateType: 'weekly' } });
    expect(out.meta?.templateType).toBe('weekly');
  });

  it('createProjectSchema 不强求 templateType(向后兼容)', () => {
    const out = createProjectSchema.parse({ name: 'n', meta: { businessLine: 'FT' } });
    expect(out.meta?.templateType).toBeUndefined();
  });

  it('createTemplateSchema 接受 meta.isDefault', () => {
    const out = createTemplateSchema.parse({
      name: 't',
      meta: { businessLine: 'FT', scenario: 'campaign-report', templateType: 'weekly', isDefault: true },
    });
    expect(out.meta?.isDefault).toBe(true);
  });

  it('createProjectSchema 剥离 isDefault(项目不持有该字段)', () => {
    // projectMetaSchema 不含 isDefault → Zod 默认 strip 未知键。
    const out = createProjectSchema.parse({
      name: 'n',
      meta: { businessLine: 'FT', isDefault: true } as never,
    });
    expect((out.meta as { isDefault?: boolean })?.isDefault).toBeUndefined();
  });
});

describe('projectThemeSchema skinPreset 已移除', () => {
  it('旧 payload 携带 skinPreset 仍合法（Zod strip 未知键）', () => {
    const r = createProjectSchema.safeParse({
      name: 't',
      meta: { theme: { skinPreset: 'flat', color: { primary: '#FF5C00' } } },
    });
    expect(r.success).toBe(true);
  });

  it('旧 payload 携带非法 skinPreset 也合法（字段已不校验，被 strip）', () => {
    const r = createProjectSchema.safeParse({
      name: 't',
      meta: { theme: { skinPreset: 'bogus' } },
    });
    expect(r.success).toBe(true);
  });
});
