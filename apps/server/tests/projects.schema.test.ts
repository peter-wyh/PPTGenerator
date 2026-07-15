import { describe, it, expect } from 'vitest';
import {
  createProjectSchema,
  updateProjectSchema,
  pageSchema,
  projectMetaSchema,
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

describe('projectThemeSchema skinPreset', () => {
  it('合法 skinPreset 值通过校验', () => {
    const r = createProjectSchema.safeParse({
      name: 't',
      meta: { theme: { skinPreset: 'flat', color: { primary: '#FF5C00' } } },
    });
    expect(r.success).toBe(true);
  });

  it('非法 skinPreset 值被拒绝', () => {
    const r = createProjectSchema.safeParse({
      name: 't',
      meta: { theme: { skinPreset: 'bogus' } },
    });
    expect(r.success).toBe(false);
  });
});

describe('pageSchema 接受新 media-kit 页面类型', () => {
  it('audience-portrait / account-overview / brand-collab 均通过校验', () => {
    for (const pt of ['audience-portrait', 'account-overview', 'brand-collab'] as const) {
      const out = pageSchema.parse({ id: 'p', name: 'P', components: [], pageType: pt });
      expect((out as { pageType?: string }).pageType).toBe(pt);
    }
  });
});

describe('reportData.creators[].audience 经 schema 保留（round-trip）', () => {
  it('creators 与 campaignCreators 的 audience 字段不被剥离', () => {
    const meta = {
      reportData: {
        creators: [
          {
            id: 'c1',
            name: 'C1',
            audience: {
              genderSplit: [{ label: 'F', value: 62 }],
              ageRange: [{ label: '18-24', value: 30 }],
              topCities: [{ label: '上海', value: 28, color: '#FF5C00' }],
            },
          },
        ],
        campaignCreators: [{ id: 'c2', name: 'C2', audience: { genderSplit: [{ label: 'M', value: 40 }] } }],
      },
    };
    const out = projectMetaSchema.parse(meta) as {
      reportData?: {
        creators?: { audience?: { genderSplit?: { value: number }[]; topCities?: { color?: string }[] } }[];
        campaignCreators?: { audience?: { genderSplit?: { value: number }[] } }[];
      };
    };
    expect(out.reportData?.creators?.[0]?.audience?.genderSplit?.[0]?.value).toBe(62);
    expect(out.reportData?.creators?.[0]?.audience?.topCities?.[0]?.color).toBe('#FF5C00');
    expect(out.reportData?.campaignCreators?.[0]?.audience?.genderSplit?.[0]?.value).toBe(40);
  });
});
