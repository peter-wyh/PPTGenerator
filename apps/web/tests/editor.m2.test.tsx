import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PropertyPanel } from '@/editor/property-panel';
import { ContextMenu } from '@/editor/components/ContextMenu';
import { useEditorStore } from '@/editor/store';
import type { ProjectDetail } from '@mediakit/shared';

const detail: ProjectDetail = {
  id: 'p',
  name: 'p',
  width: 1280,
  height: 720,
  pages: [{ id: 'pg', name: 'pg', components: [] }],
  createdAt: '',
  updatedAt: '',
};

function comp(id: string, x: number, y: number) {
  return { id, type: 'text' as const, x, y, w: 100, h: 50, data: { content: id, fontSize: 14, color: '#000' } };
}

function load(components: ReturnType<typeof comp>[]) {
  useEditorStore.getState().loadProject({ ...detail, pages: [{ id: 'pg', name: 'pg', components }] }, 'p');
}

describe('multi-select panel', () => {
  beforeEach(() => load([comp('a', 10, 10), comp('b', 200, 80), comp('c', 400, 200)]));

  it('renders when >1 selected and aligns on click', async () => {
    const user = userEvent.setup();
    useEditorStore.setState({ selectedIds: ['a', 'b'] });
    render(<PropertyPanel />);
    expect(screen.getByText('已选中 2 个组件')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '左对齐' }));
    const st = useEditorStore.getState();
    const a = st.currentComponents().find((c) => c.id === 'a')!;
    const b = st.currentComponents().find((c) => c.id === 'b')!;
    expect(a.x).toBe(b.x);
  });

  it('deletes all selected', async () => {
    const user = userEvent.setup();
    useEditorStore.setState({ selectedIds: ['a', 'b'] });
    render(<PropertyPanel />);
    await user.click(screen.getByRole('button', { name: '删除选中' }));
    expect(useEditorStore.getState().currentComponents()).toHaveLength(1);
  });
});

describe('context menu', () => {
  it('renders items and fires onClick + onClose', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    const onClose = vi.fn();
    render(
      <ContextMenu
        x={10}
        y={10}
        items={[
          { label: '复制', onClick: vi.fn() },
          'separator',
          { label: '删除', onClick: spy, danger: true },
        ]}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('复制')).toBeInTheDocument();
    await user.click(screen.getByText('删除'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
