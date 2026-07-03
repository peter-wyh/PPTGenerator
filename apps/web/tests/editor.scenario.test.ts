import { describe, it, expect, beforeEach } from 'vitest';
import { SCENARIO_TEMPLATES, getTemplate } from '@/editor/templates';
import { useEditorStore } from '@/editor/store';
import type { ProjectDetail } from '@mediakit/shared';

const emptyProject: ProjectDetail = {
  id: 'p',
  name: 'p',
  width: 1280,
  height: 720,
  pages: [{ id: 'pg', name: '第 1 页', components: [] }],
  createdAt: '',
  updatedAt: '',
};

describe('scenario templates (第④层)', () => {
  it('biweekly = 8 pages, monthly = 14 pages', () => {
    const biweekly = SCENARIO_TEMPLATES.find((s) => s.id === 'biweekly')!;
    const monthly = SCENARIO_TEMPLATES.find((s) => s.id === 'monthly')!;
    expect(biweekly.pages.length).toBe(8);
    expect(monthly.pages.length).toBe(14);
  });

  it('every referenced templateId exists in TEMPLATES', () => {
    for (const sc of SCENARIO_TEMPLATES) {
      for (const p of sc.pages) {
        expect(getTemplate(p.templateId)).toBeDefined();
      }
    }
  });

  it('expanding a scenario yields one component batch per page (all non-empty except blank)', () => {
    const monthly = SCENARIO_TEMPLATES.find((s) => s.id === 'monthly')!;
    const expanded = monthly.pages.map((p) => ({
      name: p.name,
      components: getTemplate(p.templateId)!.components(),
    }));
    expect(expanded.length).toBe(14);
    // 除 blank 外，每页都应带入组件。
    const nonBlank = expanded.filter((p) => p.components.length > 0);
    expect(nonBlank.length).toBeGreaterThanOrEqual(12);
  });
});

describe('store.addPagesBatch', () => {
  beforeEach(() => useEditorStore.getState().loadProject(emptyProject, 'p'));

  it('creates N pages in one commit with unique component ids', () => {
    const before = useEditorStore.getState().pages.length; // 1
    useEditorStore.getState().addPagesBatch([
      {
        name: '封面',
        components: [
          { id: 'x', type: 'text', x: 0, y: 0, w: 100, h: 50, data: { content: 'A', fontSize: 14, color: '#000' } },
        ],
      },
      {
        name: '业绩',
        components: [
          { id: 'x', type: 'text', x: 0, y: 0, w: 100, h: 50, data: { content: 'B', fontSize: 14, color: '#000' } },
        ],
      },
    ]);
    const pages = useEditorStore.getState().pages;
    expect(pages.length).toBe(before + 2);
    // 组件 id 被重新分配，不与传入的 'x' 冲突，且两页互不冲突。
    const ids = pages.flatMap((p) => p.components.map((c) => c.id));
    expect(ids).not.toContain('x');
    expect(new Set(ids).size).toBe(ids.length);
    // 当前页切到新生成的第一页。
    expect(useEditorStore.getState().currentPageId).toBe(pages[before].id);
  });

  it('undo reverts the whole batch in one step', () => {
    const before = useEditorStore.getState().pages.length;
    useEditorStore.getState().addPagesBatch([
      { name: 'a', components: [] },
      { name: 'b', components: [] },
      { name: 'c', components: [] },
    ]);
    expect(useEditorStore.getState().pages.length).toBe(before + 3);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().pages.length).toBe(before); // 一次 undo 全回退
  });
});

describe('legacy 整页版式 → 页面模板（拆成组件编排）', () => {
  // 这些页面模板由通用/业务组件拼成，不应再产生单体 business-block。
  const LEGACY_PAGE_IDS = [
    'milestone-page',
    'global-page',
    'org-page',
    'service-page',
    'challenge-page',
    'process-page',
    'calendar-page',
    'campaign-plan-page',
    'case-page',
    'content-analysis-page',
    'funnel-page',
  ];

  it('每个 legacy 页面模板都存在且编排组件（无单体 business-block）', () => {
    for (const id of LEGACY_PAGE_IDS) {
      const tpl = getTemplate(id);
      expect(tpl, `template ${id} missing`).toBeDefined();
      const comps = tpl!.components();
      expect(comps.length, `${id} 应至少含标题+内容`).toBeGreaterThanOrEqual(2);
      // 业务组件层迁移后，页面模板不再落下单体 business-block。
      expect(comps.every((c) => c.type !== 'business-block')).toBe(true);
    }
  });

  it('table 系页面含表格；案例页含成效卡 + 作品列表', () => {
    expect(getTemplate('milestone-page')!.components().some((c) => c.type === 'table')).toBe(true);
    const caseComps = getTemplate('case-page')!.components().map((c) => c.type);
    expect(caseComps).toContain('indicator-card');
    expect(caseComps).toContain('creator-works-list');
  });
});
