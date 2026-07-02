import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BusinessLibrary } from '@/editor/components/BusinessLibrary';
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

describe('BusinessLibrary', () => {
  beforeEach(() => useEditorStore.getState().loadProject(detail, 'p'));

  it('opens on click and lists grouped items', async () => {
    const user = userEvent.setup();
    render(<BusinessLibrary />);
    await user.click(screen.getByText(/业务组件/));
    expect(screen.getByText('基础页面')).toBeInTheDocument();
    expect(screen.getByText('封面信息')).toBeInTheDocument();
    expect(screen.getByText('增长漏斗')).toBeInTheDocument();
  });

  it('adds a business block when an item is clicked', async () => {
    const user = userEvent.setup();
    render(<BusinessLibrary />);
    await user.click(screen.getByText(/业务组件/));
    await user.click(screen.getByText('封面信息'));
    const comps = useEditorStore.getState().currentComponents();
    expect(comps).toHaveLength(1);
    expect(comps[0].type).toBe('business-block');
    expect((comps[0].data as { businessKind: string }).businessKind).toBe('cover');
  });
});
