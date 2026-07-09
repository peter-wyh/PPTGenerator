import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '@/editor/store';
import type { ProjectDetail, ProjectMeta } from '@mediakit/shared';

function makeDetail(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  return {
    id: 'proj-1',
    name: '测试项目',
    width: 1280,
    height: 720,
    pages: [{ id: 'p1', name: '第 1 页', components: [] }],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}
function load(meta: Partial<ProjectMeta> = {}) {
  const detail = makeDetail({ meta: meta as ProjectMeta });
  useEditorStore.getState().loadProject(detail, detail.name);
}
function page(id = 'p1') {
  return useEditorStore.getState().pages.find((p) => p.id === id)!;
}

describe('setPageType — 投放报告标题', () => {
  beforeEach(() => load({ advertiser: 'GlowLab', scenarioSub: 'weekly' }));

  it('设为 media-report：创建标题组件并写入生成标题', () => {
    useEditorStore.getState().setPageType('p1', 'media-report');
    const p = page();
    expect(p.pageType).toBe('media-report');
    expect(p.titleOverridden).toBe(false);
    expect(p.name).toBe("GlowLab's MEDIA REPORT · 上周");
    expect(p.titleComponentId).toBeDefined();
    const titleComp = p.components.find((c) => c.id === p.titleComponentId)!;
    expect((titleComp.data as { content: string }).content).toBe("GlowLab's MEDIA REPORT · 上周");
  });

  it('清除 pageType：保留组件', () => {
    const s = useEditorStore.getState();
    s.setPageType('p1', 'media-report');
    s.setPageType('p1', undefined);
    const p = page();
    expect(p.pageType).toBeUndefined();
    expect(p.components.length).toBeGreaterThan(0);
    expect(p.titleComponentId).toBeUndefined();
  });

  it('结案：标题取 campaign 区间', () => {
    load({ advertiser: 'GlowLab', scenarioSub: 'wrap-up', campaignInfo: { startDate: '2026-10-12', endDate: '2026-11-10' } });
    useEditorStore.getState().setPageType('p1', 'media-report');
    expect(page().name).toBe("GlowLab's MEDIA REPORT · 2026.10.12–2026.11.10");
  });
});

describe('restoreReportTitle', () => {
  beforeEach(() => load({ advertiser: 'GlowLab', scenarioSub: 'weekly' }));

  it('清除 overridden 并按 meta 重算标题', () => {
    const s = useEditorStore.getState();
    s.setPageType('p1', 'media-report');
    // 模拟手改后 overridden 且标题变陈旧
    useEditorStore.setState((st) => ({
      pages: st.pages.map((p) => (p.id === 'p1' ? { ...p, titleOverridden: true, name: '陈旧标题' } : p)),
    }));
    s.restoreReportTitle('p1');
    const p = page();
    expect(p.titleOverridden).toBe(false);
    expect(p.name).toBe("GlowLab's MEDIA REPORT · 上周");
    expect(
      (p.components.find((c) => c.id === p.titleComponentId)!.data as { content: string }).content,
    ).toBe("GlowLab's MEDIA REPORT · 上周");
  });
});

describe('loadProject 刷新投放报告标题', () => {
  it('加载带 media-report 的页：按 meta 重算标题', () => {
    const detail = makeDetail({
      meta: { advertiser: 'GlowLab', scenarioSub: 'monthly' } as ProjectMeta,
      pages: [
        {
          id: 'p1',
          name: '封面',
          components: [
            { id: 'c1', type: 'text', x: 0, y: 0, w: 100, h: 50, data: { content: 'Report Title', fontSize: 56, color: '#000' } },
          ],
          pageType: 'media-report',
          titleComponentId: 'c1',
          titleOverridden: false,
        },
      ],
    });
    useEditorStore.getState().loadProject(detail, detail.name);
    const p = page();
    expect(p.name).toBe("GlowLab's MEDIA REPORT · 上月");
    expect((p.components[0].data as { content: string }).content).toBe("GlowLab's MEDIA REPORT · 上月");
  });

  it('overridden 的页加载后不被重算', () => {
    const detail = makeDetail({
      meta: { advertiser: 'GlowLab', scenarioSub: 'monthly' } as ProjectMeta,
      pages: [
        {
          id: 'p1',
          name: '自定义标题',
          components: [
            { id: 'c1', type: 'text', x: 0, y: 0, w: 100, h: 50, data: { content: '自定义标题', fontSize: 56, color: '#000' } },
          ],
          pageType: 'media-report',
          titleComponentId: 'c1',
          titleOverridden: true,
        },
      ],
    });
    useEditorStore.getState().loadProject(detail, detail.name);
    expect(page().name).toBe('自定义标题');
  });
});

describe('refreshReportTitle 不脏化已正确的项目', () => {
  it('标题已正确时 loadProject 不把项目标脏', () => {
    const detail = makeDetail({
      meta: { advertiser: 'GlowLab', scenarioSub: 'weekly' } as ProjectMeta,
      pages: [
        {
          id: 'p1',
          name: "GlowLab's MEDIA REPORT · 上周",
          components: [
            { id: 'c1', type: 'text', x: 0, y: 0, w: 100, h: 50, data: { content: "GlowLab's MEDIA REPORT · 上周", fontSize: 56, color: '#000' } },
          ],
          pageType: 'media-report',
          titleComponentId: 'c1',
          titleOverridden: false,
        },
      ],
    });
    useEditorStore.getState().loadProject(detail, detail.name);
    expect(useEditorStore.getState().dirty).toBe(false);
  });
});

describe('手改标题停止自动跟随', () => {
  beforeEach(() => load({ advertiser: 'GlowLab', scenarioSub: 'weekly' }));

  it('编辑标题组件 content → titleOverridden=true 且 name 同步', () => {
    const s = useEditorStore.getState();
    s.setPageType('p1', 'media-report');
    const titleId = page().titleComponentId!;
    const data = page().components.find((c) => c.id === titleId)!.data as { content: string; fontSize: number; color: string };
    s.updateComponent(titleId, { data: { ...data, content: '自定义标题' } });
    s.commit();
    const p = page();
    expect(p.titleOverridden).toBe(true);
    expect(p.name).toBe('自定义标题');
  });

  it('改标题组件字号（非 content）不触发 overridden', () => {
    const s = useEditorStore.getState();
    s.setPageType('p1', 'media-report');
    const titleId = page().titleComponentId!;
    const data = page().components.find((c) => c.id === titleId)!.data as { content: string; fontSize: number; color: string };
    s.updateComponent(titleId, { data: { ...data, fontSize: 40 } });
    s.commit();
    expect(page().titleOverridden).toBe(false);
  });

  it('拖拽标题组件（非 data patch）不触发 overridden', () => {
    const s = useEditorStore.getState();
    s.setPageType('p1', 'media-report');
    const titleId = page().titleComponentId!;
    s.updateComponent(titleId, { x: 200, y: 100 });
    expect(page().titleOverridden).toBe(false);
  });

  it('侧栏改名 media-report 页 → overridden=true 且标题组件同步', () => {
    const s = useEditorStore.getState();
    s.setPageType('p1', 'media-report');
    s.renamePage('p1', '我的封面');
    const p = page();
    expect(p.titleOverridden).toBe(true);
    expect(p.name).toBe('我的封面');
    expect(
      (p.components.find((c) => c.id === p.titleComponentId)!.data as { content: string }).content,
    ).toBe('我的封面');
  });
});

describe('addPageWithComponents / copyPage — 模板与复制', () => {
  beforeEach(() => load({ advertiser: 'GlowLab', scenarioSub: 'weekly' }));

  it('addPageWithComponents 带 titleComponentIndex → media-report + 标题', () => {
    const comp = {
      id: 'x',
      type: 'text' as const,
      x: 0,
      y: 0,
      w: 100,
      h: 50,
      data: { content: 'Report Title', fontSize: 56, color: '#000' },
    };
    useEditorStore.getState().addPageWithComponents('封面', [comp], { titleComponentIndex: 0 });
    const p = useEditorStore.getState().pages[1];
    expect(p.pageType).toBe('media-report');
    expect(p.name).toBe("GlowLab's MEDIA REPORT · 上周");
    expect((p.components[0].data as { content: string }).content).toBe("GlowLab's MEDIA REPORT · 上周");
  });

  it('copyPage 复制 media-report 页：保留 pageType 并重指向标题组件', () => {
    const s = useEditorStore.getState();
    s.setPageType('p1', 'media-report');
    const srcTitleId = page().titleComponentId!;
    s.copyPage('p1');
    const copy = useEditorStore.getState().pages[1];
    expect(copy.pageType).toBe('media-report');
    expect(copy.titleComponentId).toBeTruthy();
    expect(copy.titleComponentId).not.toBe(srcTitleId);
    expect(copy.components.find((c) => c.id === copy.titleComponentId)).toBeTruthy();
  });
});
