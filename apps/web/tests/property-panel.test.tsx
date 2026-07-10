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
