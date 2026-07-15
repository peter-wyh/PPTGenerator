import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PropertyPanel } from '@/editor/property-panel';
import { useEditorStore } from '@/editor/store';
import type { EditorComponent } from '@mediakit/shared';

function setIndicator(variant: string, extra: Record<string, unknown> = {}) {
  const comp: EditorComponent = {
    id: 'c1',
    type: 'indicator-card',
    x: 0, y: 0, w: 240, h: 100,
    data: { variant, title: 'GMV', value: '$1', colorTheme: 'orange', ...extra } as any,
  };
  useEditorStore.setState({
    pages: [{ id: 'p1', name: 'P1', components: [comp] }],
    currentPageId: 'p1',
    selectedIds: ['c1'],
  } as any);
}

function setTitleBlock(extra: Record<string, unknown> = {}, headingFontSize?: number) {
  const comp: EditorComponent = {
    id: 'c1',
    type: 'title-block',
    x: 0, y: 0, w: 600, h: 120,
    data: { variant: 'bar-left', text: 'T', subtitle: 'S', ...extra } as any,
  };
  useEditorStore.setState({
    pages: [{ id: 'p1', name: 'P1', components: [comp] }],
    currentPageId: 'p1',
    selectedIds: ['c1'],
    ...(headingFontSize !== undefined
      ? ({ projectMeta: { theme: { heading: { fontSize: headingFontSize } } } } as any)
      : {}),
  } as any);
}

describe('PropertyPanel title-block 字号 回显', () => {
  beforeEach(() => {
    useEditorStore.setState({
      pages: [],
      currentPageId: 'p1',
      selectedIds: [],
      projectMeta: null,
    } as any);
  });

  it('字号未设置时回显全局标题字号(默认 32),而非 0', () => {
    setTitleBlock(); // data 无 fontSize → 继承全局
    render(<PropertyPanel />);
    expect((screen.getByLabelText('字号') as HTMLInputElement).value).toBe('32');
  });

  it('字号已单组件覆盖时回显该覆盖值', () => {
    setTitleBlock({ fontSize: 48 });
    render(<PropertyPanel />);
    expect((screen.getByLabelText('字号') as HTMLInputElement).value).toBe('48');
  });

  it('字号未设置时跟随全局标题字号(自定义值)', () => {
    setTitleBlock({}, 28);
    render(<PropertyPanel />);
    expect((screen.getByLabelText('字号') as HTMLInputElement).value).toBe('28');
  });
});

describe('PropertyPanel icon field gating', () => {
  beforeEach(() => {
    useEditorStore.setState({
      pages: [],
      currentPageId: 'p1',
      selectedIds: [],
    } as any);
  });

  it('hides icon picker on plain variant', () => {
    setIndicator('plain');
    render(<PropertyPanel />);
    expect(screen.queryByText('图标')).toBeNull();
  });

  it('shows icon picker on icon-top variant', () => {
    setIndicator('icon-top');
    render(<PropertyPanel />);
    expect(screen.getByText('图标')).toBeInTheDocument();
  });

  it('shows icon picker on icon-left variant too', () => {
    setIndicator('icon-left');
    render(<PropertyPanel />);
    expect(screen.getByText('图标')).toBeInTheDocument();
  });
});
