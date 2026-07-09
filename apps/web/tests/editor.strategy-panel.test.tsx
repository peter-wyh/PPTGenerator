import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PropertyPanel } from '@/editor/PropertyPanel';
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
      highlights: 'tips',
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
});
