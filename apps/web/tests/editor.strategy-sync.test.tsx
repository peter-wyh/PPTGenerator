import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PropertyPanel } from '@/editor/property-panel';
import { StrategyBlockComponent } from '@/editor/components/report';
import { useEditorStore } from '@/editor/store';
import type { EditorComponent } from '@mediakit/shared';

/**
 * 回归：strategy-block 右侧配置 → 画板 同步。
 * 覆盖：标题 input(onChange)、图标选择器(onPick)、富文本内容(onInput/onBlur)。
 * contentEditable/execCommand 在 jsdom 不可用，故富文本用「直接写 innerHTML + fireEvent」
 * 模拟浏览器键入结果，验证 commit 路径（含 onInput 实时提交，见末尾用例）。
 */
function setStrategyBlock(rows: string[][]) {
  const comp: EditorComponent = {
    id: 'c1',
    type: 'strategy-block',
    x: 0, y: 0, w: 600, h: 200,
    data: { headers: ['图标', '标题', '内容'], rows, highlights: '' } as any,
  };
  useEditorStore.setState({
    pages: [{ id: 'p1', name: 'P1', components: [comp] }],
    currentPageId: 'p1',
    selectedIds: ['c1'],
  } as any);
}

/** 订阅 store 的画板探针：模拟 Canvas 用 currentComponents() 读取并渲染。 */
function CanvasProbe() {
  const comp = useEditorStore((s) => s.currentComponents()?.[0]);
  if (!comp) return null;
  return <StrategyBlockComponent data={comp.data as any} />;
}

describe('strategy-block panel → canvas sync', () => {
  beforeEach(() => {
    useEditorStore.setState({ pages: [], currentPageId: 'p1', selectedIds: [] } as any);
  });

  it('编辑标题 → store.data.rows 更新', () => {
    setStrategyBlock([['sparkle', 'INSIGHT', 'hello']]);
    render(<PropertyPanel />);
    fireEvent.change(screen.getByPlaceholderText('标题'), { target: { value: 'NEW TITLE' } });
    const comp = useEditorStore.getState().pages[0].components[0];
    expect((comp.data as any).rows[0][1]).toBe('NEW TITLE');
  });

  it('编辑标题 → 订阅 store 的画板探针渲染新标题', () => {
    setStrategyBlock([['sparkle', 'INSIGHT', 'hello']]);
    render(
      <>
        <PropertyPanel />
        <CanvasProbe />
      </>,
    );
    expect(screen.getByText('INSIGHT')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('标题'), { target: { value: 'NEW TITLE' } });
    expect(screen.getByText('NEW TITLE')).toBeInTheDocument();
  });

  it('选择图标 → store.rows[0][0] 更新（验证 TableCellIconPicker 接线）', () => {
    setStrategyBlock([['', 'INSIGHT', 'hello']]); // 初始无图标
    render(
      <>
        <PropertyPanel />
        <CanvasProbe />
      </>,
    );
    // 打开图标选择器（无图标时按钮 title 为「选择图标」）
    fireEvent.click(screen.getByTitle('选择图标'));
    const titledBtns = document.querySelectorAll('button[title]');
    // [0] 是选择器按钮自身；[1+] 是 overlay 内的图标按钮
    expect(titledBtns.length).toBeGreaterThan(1);
    fireEvent.click(titledBtns[1]);
    const comp = useEditorStore.getState().pages[0].components[0];
    expect((comp.data as any).rows[0][0]).not.toBe('');
  });

  it('富文本内容：模拟键入后 blur 提交 → store + 画板探针更新', () => {
    setStrategyBlock([['sparkle', 'INSIGHT', 'hello']]);
    render(
      <>
        <PropertyPanel />
        <CanvasProbe />
      </>,
    );
    const editable = document.querySelector('[contenteditable="true"]') as HTMLElement;
    expect(editable).toBeTruthy();
    // 模拟浏览器中用户键入后 contentEditable 的 innerHTML（execCommand 在 jsdom 不可用）。
    editable.innerHTML = 'hello world';
    fireEvent.blur(editable);
    const comp = useEditorStore.getState().pages[0].components[0];
    expect((comp.data as any).rows[0][2]).toContain('hello world');
  });

  /**
   * 回归：富文本内容必须「实时」同步（onInput），不能只依赖 onBlur。
   * 现实场景：用户在右侧面板编辑内容后，点击画布上的组件查看效果——
   * Canvas.handleComponentMouseDown 调用 e.preventDefault() 会阻止 contentEditable 失焦，
   * 若仅 onBlur 提交，内容永远写不进 store → 画板不同步。
   */
  it('富文本内容：onInput 实时提交（不依赖 blur）', () => {
    setStrategyBlock([['sparkle', 'INSIGHT', 'hello']]);
    render(
      <>
        <PropertyPanel />
        <CanvasProbe />
      </>,
    );
    const editable = document.querySelector('[contenteditable="true"]') as HTMLElement;
    editable.innerHTML = 'hello world';
    fireEvent.input(editable); // 仅 input，不 blur
    const comp = useEditorStore.getState().pages[0].components[0];
    expect((comp.data as any).rows[0][2]).toContain('hello world');
  });
});
