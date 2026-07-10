import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PropertyPanel } from '@/editor/property-panel';
import { useEditorStore } from '@/editor/store';
import type { EditorComponent } from '@mediakit/shared';

/**
 * strategy-block 属性面板烟雾测试。
 * contentEditable / execCommand 在 jsdom 不可用，故只断言结构：
 * 行删除按钮数、contentEditable 数量、添加行。
 * 按 [[web-chart-test-convention]] 与 property-panel.test.tsx 的 store 接线方式渲染。
 */
function setStrategyBlock(rows: string[][]) {
  const comp: EditorComponent = {
    id: 'c1',
    type: 'strategy-block',
    x: 0, y: 0, w: 600, h: 200,
    data: {
      headers: ['图标', '标题', '内容'],
      rows,
    } as any,
  };
  useEditorStore.setState({
    pages: [{ id: 'p1', name: 'P1', components: [comp] }],
    currentPageId: 'p1',
    selectedIds: ['c1'],
  } as any);
}

describe('StrategyBlockFields panel', () => {
  beforeEach(() => {
    useEditorStore.setState({
      pages: [],
      currentPageId: 'p1',
      selectedIds: [],
    } as any);
  });

  it('为 2 行渲染 2 个「删除该项」按钮 + 2 个 contentEditable', () => {
    setStrategyBlock([
      ['sparkle', 'INSIGHT', 'focus on tips'],
      ['target', 'STRATEGY', 'do x'],
    ]);
    render(<PropertyPanel />);

    expect(screen.getAllByTitle('删除该项')).toHaveLength(2);
    expect(document.querySelectorAll('[contenteditable="true"]').length).toBeGreaterThanOrEqual(2);
  });

  it('点击「+ 添加项」后变为 3 个「删除该项」', () => {
    setStrategyBlock([
      ['sparkle', 'INSIGHT', 'focus on tips'],
      ['target', 'STRATEGY', 'do x'],
    ]);
    render(<PropertyPanel />);

    fireEvent.click(screen.getByText('+ 添加项'));

    expect(screen.getAllByTitle('删除该项')).toHaveLength(3);
  });

  it('删除首行后，剩余行的富文本内容正确跟随（RichTextField sync）', () => {
    // 用一个两行、内容不同的 strategy-block；rows 内容分别为 content-alpha / content-beta。
    setStrategyBlock([
      ['sparkle', 'INSIGHT', 'content-alpha'],
      ['target', 'STRATEGY', 'content-beta'],
    ]);
    render(<PropertyPanel />);

    // 删除前：两个 contentEditable，第一个含 content-alpha。
    let editables = document.querySelectorAll('[contenteditable="true"]');
    expect(editables.length).toBe(2);
    expect(editables[0].textContent).toContain('content-alpha');

    // 点击第一行的删除按钮。
    const removeBtns = screen.getAllByTitle('删除该项');
    fireEvent.click(removeBtns[0]);

    // 删除后：剩一个 contentEditable；它应显示第二行内容 content-beta（而非残留的 content-alpha）。
    editables = document.querySelectorAll('[contenteditable="true"]');
    expect(editables.length).toBe(1);
    expect(editables[0].textContent).toContain('content-beta');
    expect(editables[0].textContent).not.toContain('content-alpha');
  });

  it('富文本工具栏渲染「高亮」按钮（title=高亮）', () => {
    setStrategyBlock([['sparkle', 'INSIGHT', 'focus on tips']]);
    render(<PropertyPanel />);
    expect(screen.getByTitle('高亮')).toBeInTheDocument();
  });
});
