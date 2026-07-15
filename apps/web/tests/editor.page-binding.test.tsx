import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../src/editor/store';

beforeEach(() => {
  useEditorStore.setState({
    pages: [{ id: 'p1', name: 'n', creatorId: 'cr-1', components: [] } as any],
    currentPageId: 'p1',
    reportData: {
      campaign: { id: 'camp-1', name: 'G', metrics: [] } as any,
      campaignCreators: [{ id: 'cr-1', name: 'Ada', platform: 'TikTok', stats: [{ label: 'F', value: '1M', compare: '' }] } as any],
    } as any,
    projectMeta: {},
  });
});

describe('addComponent on bound page', () => {
  it('新增 creator 型组件 → 自动填 + _dataSource=project', () => {
    useEditorStore.getState().addComponent('creator-stats-strip');
    const c = useEditorStore.getState().pages[0].components[0];
    expect((c.data as any)._dataSource).toBe('project');
    expect((c.data as any).stats).toBeDefined();
  });
  it('未绑定页面新增组件 → 不填（保持默认 manual）', () => {
    useEditorStore.setState({ pages: [{ id: 'p2', name: 'n', components: [] } as any], currentPageId: 'p2' });
    useEditorStore.getState().addComponent('creator-stats-strip');
    const c = useEditorStore.getState().pages[0].components[0];
    expect((c.data as any)._dataSource).toBeUndefined();
  });
});

describe('applyPageBinding action', () => {
  it('手动改某组件 source=manual 后，applyPageBinding 不覆盖它', () => {
    useEditorStore.getState().addComponent('creator-stats-strip');
    const id = useEditorStore.getState().pages[0].components[0].id;
    useEditorStore.getState().setComponentData(id, { _dataSource: 'manual', stats: [{ label: 'X', value: '9', compare: '' }] } as any);
    useEditorStore.getState().applyPageBinding('p1');
    const c = useEditorStore.getState().pages[0].components[0];
    expect((c.data as any).stats[0].value).toBe('9'); // 保留手动值
  });
});

describe('page creation auto-fills', () => {
  it('addPageWithComponents 在自动绑定 campaign 的页上 → campaign 组件被填', () => {
    // funnel-chart 的 campaignPatch 恒返回 { steps }（不依赖 metrics）
    useEditorStore.getState().addPageWithComponents(
      'rep',
      [{ id: 't1', type: 'funnel-chart', x: 0, y: 0, w: 10, h: 10, data: { steps: [] } } as any],
      { pageType: 'report-monthly-overview' },
    );
    const page = useEditorStore.getState().pages.find((p) => p.name === 'rep')!;
    const c = page.components[0];
    expect((c.data as any)._dataSource).toBe('project');
    expect((c.data as any).steps.length).toBeGreaterThan(0);
  });
});

describe('setPageType patchCampaign triggers fill', () => {
  it('切到 campaign-report 且自动绑 campaign → 页内 campaign 组件被填', () => {
    useEditorStore.setState({
      pages: [{ id: 'p1', name: 'n', components: [{ id: 'f1', type: 'funnel-chart', x: 0, y: 0, w: 10, h: 10, data: { steps: [] } } as any] } as any],
      currentPageId: 'p1',
    });
    useEditorStore.getState().setPageType('p1', 'report-channel');
    const c = useEditorStore.getState().pages[0].components[0];
    expect((c.data as any)._dataSource).toBe('project');
    expect((c.data as any).steps.length).toBeGreaterThan(0);
  });
});

describe('changing page creator refills followers', () => {
  it('改 page.creatorId 后 applyPageBinding → 跟随组件更新；manual 组件不动', () => {
    // 两个达人，各带不同 stats
    useEditorStore.setState({
      reportData: {
        campaignCreators: [
          { id: 'cr-1', name: 'Ada', platform: 'TikTok', stats: [{ label: 'F', value: '1M', compare: '' }] } as any,
          { id: 'cr-2', name: 'Bo', platform: 'TikTok', stats: [{ label: 'F', value: '2M', compare: '' }] } as any,
        ],
      } as any,
      pages: [{ id: 'p1', name: 'n', creatorId: 'cr-1', components: [] } as any],
      currentPageId: 'p1',
    });
    // 加一个跟随组件（自动填 cr-1 的 1M）
    useEditorStore.getState().addComponent('creator-stats-strip');
    const follower = useEditorStore.getState().pages[0].components[0];
    expect((follower.data as any).stats[0].value).toBe('1M');
    // 切到达人 cr-2 并触发 applyPageBinding（模拟 PageProperties 改 creatorId 后的调用）
    useEditorStore.setState({
      pages: [{ id: 'p1', name: 'n', creatorId: 'cr-2', components: useEditorStore.getState().pages[0].components } as any],
    });
    useEditorStore.getState().applyPageBinding('p1');
    const after = useEditorStore.getState().pages[0].components[0];
    expect((after.data as any).stats[0].value).toBe('2M'); // 跟随组件已更新
  });
});
