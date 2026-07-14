import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useEditorStore, pickPersistableState } from '@/editor/store';
import type { ProjectDetail } from '@mediakit/shared';

const detail = (id: string): ProjectDetail => ({
  id,
  name: id,
  width: 1280,
  height: 720,
  pages: [{ id: 'pg', name: 'pg', components: [] }],
  createdAt: '',
  updatedAt: '',
});

/** load 一个项目，再制造一笔未保存改动（dirty + 改过的 pages）。 */
function loadDirty(mode: 'project' | 'template' = 'project') {
  useEditorStore.getState().loadProject(detail('p'), 'p', mode);
  useEditorStore.setState({
    dirty: true,
    dirtyTick: 1,
    pages: [{ id: 'pg', name: '改过', components: [] }],
  });
}

describe('pickPersistableState', () => {
  beforeEach(() => loadDirty());

  it('挑出数据字段，不含 action 函数', () => {
    const picked = pickPersistableState(useEditorStore.getState());
    expect(picked.projectId).toBe('p');
    expect(picked.pages).toHaveLength(1);
    expect(picked.pages?.[0].name).toBe('改过');
    expect(picked.dirty).toBe(true);
    // action 不应出现在结果里（回填旧 action 会让闭包指向废弃 store）
    const asRecord = picked as unknown as Record<string, unknown>;
    expect(asRecord.save).toBeUndefined();
    expect(asRecord.loadProject).toBeUndefined();
    expect(asRecord.flushSync).toBeUndefined();
  });
});

describe('flushSync（beforeunload 尽力刷盘）', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    loadDirty();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('project 模式：keepalive PATCH → /api/v1/projects/:id，body 带改动', () => {
    useEditorStore.getState().flushSync();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/projects/p');
    expect(init.method).toBe('PATCH');
    expect(init.keepalive).toBe(true);
    expect(init.credentials).toBe('include');
    const body = JSON.parse(init.body as string);
    expect(body.pages[0].name).toBe('改过');
  });

  it('template 模式：PATCH → /api/v1/templates/:id', () => {
    useEditorStore.setState({ saveMode: 'template' });
    useEditorStore.getState().flushSync();
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/templates/p');
  });

  it('未脏 → 不发请求', () => {
    useEditorStore.setState({ dirty: false });
    useEditorStore.getState().flushSync();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('保存中 → 不发请求', () => {
    useEditorStore.setState({ dirty: true, saving: true });
    useEditorStore.getState().flushSync();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('无 projectId → 不发请求', () => {
    useEditorStore.setState({ projectId: null });
    useEditorStore.getState().flushSync();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
