import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PageThumbnail } from '@/editor/components/PageThumbnail';
import { TemplateOverlay } from '@/editor/components/TemplateOverlay';
import { TEMPLATES, TEMPLATE_CATEGORIES } from '@/editor/templates';
import { useEditorStore } from '@/editor/store';
import type { Page, ProjectDetail } from '@mediakit/shared';

const detail: ProjectDetail = {
  id: 'p',
  name: 'p',
  width: 1280,
  height: 720,
  pages: [{ id: 'pg', name: 'pg', components: [] }],
  createdAt: '',
  updatedAt: '',
};

function comp(id: string, x: number, y: number, type: Page['components'][number]['type']) {
  return {
    id,
    type,
    x,
    y,
    w: 100,
    h: 50,
    data: { content: id, fontSize: 14, color: '#000' },
  } as Page['components'][number];
}

describe('PageThumbnail', () => {
  beforeEach(() => useEditorStore.getState().loadProject(detail, 'p'));

  it('shows 空白页 for an empty page', () => {
    render(<PageThumbnail page={{ id: 'a', name: 'a', components: [] }} canvasWidth={1280} canvasHeight={720} />);
    expect(screen.getByText('空白页')).toBeInTheDocument();
  });

  it('renders one box per component', () => {
    const page = { id: 'a', name: 'a', components: [comp('c1', 10, 10, 'text'), comp('c2', 200, 100, 'bar-chart')] };
    const { container } = render(<PageThumbnail page={page} canvasWidth={1280} canvasHeight={720} />);
    const boxes = container.querySelectorAll('.absolute > .absolute');
    expect(boxes.length).toBeGreaterThanOrEqual(2);
  });
});

describe('TemplateOverlay', () => {
  it('renders all templates', () => {
    render(<TemplateOverlay onApply={() => {}} onClose={() => {}} />);
    // TemplateOverlay 按 TEMPLATE_CATEGORIES 渲染（不含业务线变体）。
    const categorizedIds = new Set(TEMPLATE_CATEGORIES.flatMap((c) => c.ids));
    const visible = TEMPLATES.filter((t) => categorizedIds.has(t.id));
    // blank 卡片的缩略图(PageThumbnail 空页文案)与模板名同为「空白页」→ 用 getAllByText
    for (const tpl of visible) expect(screen.getAllByText(tpl.name).length).toBeGreaterThanOrEqual(1);
  });

  it('blank template creates an empty page', async () => {
    const user = userEvent.setup();
    useEditorStore.getState().loadProject(detail, 'p');
    render(<TemplateOverlay onApply={(tpl) => {
      if (tpl.id === 'blank') useEditorStore.getState().addPage();
      else useEditorStore.getState().addPageWithComponents(tpl.name, tpl.components());
    }} onClose={() => {}} />);
    // 卡片改版:点「应用」按钮触发 onApply(blank 卡缩略图文案与模板名重复)
    const cards = screen.getAllByText('空白页');
    const card = cards[0].closest('div.flex.flex-col') ?? cards[0].closest('.flex.flex-col');
    const applyBtn = within(card as HTMLElement).getByRole('button', { name: '应用' });
    await user.click(applyBtn);
    expect(useEditorStore.getState().pages).toHaveLength(2);
    expect(useEditorStore.getState().currentComponents()).toHaveLength(0);
  });

  it('overview template adds 4 components (3 cards + 1 chart)', async () => {
    const user = userEvent.setup();
    useEditorStore.getState().loadProject(detail, 'p');
    render(<TemplateOverlay onApply={(tpl) => {
      if (tpl.id === 'blank') useEditorStore.getState().addPage();
      else useEditorStore.getState().addPageWithComponents(tpl.name, tpl.components());
    }} onClose={() => {}} />);
    // 卡片改版:点「应用」按钮触发 onApply
    const cards = screen.getAllByText('数据概览');
    const card = cards[0].closest('div.flex.flex-col') ?? cards[0].closest('.flex.flex-col');
    const applyBtn = within(card as HTMLElement).getByRole('button', { name: '应用' });
    await user.click(applyBtn);
    expect(useEditorStore.getState().currentComponents()).toHaveLength(4);
  });
});
