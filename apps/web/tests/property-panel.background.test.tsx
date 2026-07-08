import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PropertyPanel } from '@/editor/PropertyPanel';
import { useEditorStore } from '@/editor/store';
import type { PageGradient } from '@mediakit/shared';

function setPage(over: Record<string, unknown> = {}) {
  useEditorStore.setState({
    pages: [{ id: 'p1', name: 'P1', components: [], ...over }],
    currentPageId: 'p1',
    selectedIds: [],
  } as any);
}

describe('PropertyPanel — 页面背景类型单选 + 渐变编辑器', () => {
  beforeEach(() => setPage());

  it('无选中时渲染三个背景类型 chip', () => {
    render(<PropertyPanel />);
    expect(screen.getByText('纯色')).toBeInTheDocument();
    expect(screen.getByText('渐变')).toBeInTheDocument();
    expect(screen.getByText('图片')).toBeInTheDocument();
  });

  it('点击「渐变」写入 bgGradient（默认 2 stop）并清掉 bgColor/bgImage', () => {
    setPage({ bgColor: '#FF5C00', bgImage: 'a.png' });
    render(<PropertyPanel />);
    fireEvent.click(screen.getByText('渐变'));
    const page = useEditorStore.getState().pages[0];
    expect(page.bgGradient).toBeDefined();
    expect((page.bgGradient as PageGradient).stops).toHaveLength(2);
    expect(page.bgColor).toBeUndefined();
    expect(page.bgImage).toBeUndefined();
  });

  it('已有 bgGradient 时渲染渐变编辑器（线性 / 径向 / 添加色标）', () => {
    setPage({
      bgGradient: {
        type: 'linear',
        angle: 180,
        stops: [
          { color: '#FFFFFF', position: 0 },
          { color: '#E5E7EB', position: 100 },
        ],
      },
    });
    render(<PropertyPanel />);
    expect(screen.getByText('线性')).toBeInTheDocument();
    expect(screen.getByText('径向')).toBeInTheDocument();
    expect(screen.getByText('+ 添加色标')).toBeInTheDocument();
  });

  it('点击「+ 添加色标」增加一个色标（2 → 3）', () => {
    setPage({
      bgGradient: {
        type: 'linear',
        angle: 180,
        stops: [
          { color: '#FFFFFF', position: 0 },
          { color: '#E5E7EB', position: 100 },
        ],
      },
    });
    render(<PropertyPanel />);
    fireEvent.click(screen.getByText('+ 添加色标'));
    const page = useEditorStore.getState().pages[0];
    expect((page.bgGradient as PageGradient).stops).toHaveLength(3);
  });

  it('6 个色标时禁用「+ 添加色标」', () => {
    const stops = Array.from({ length: 6 }, (_, i) => ({ color: '#FFFFFF', position: i * 20 }));
    setPage({ bgGradient: { type: 'linear', angle: 180, stops } });
    render(<PropertyPanel />);
    expect(screen.getByText('+ 添加色标')).toBeDisabled();
  });

  it('已有 bgColor 时按数据显示纯色编辑器（类型派生自数据）', () => {
    setPage({ bgColor: '#FF5C00' });
    render(<PropertyPanel />);
    // 纯色区块的 HEX 文本框
    expect(screen.getByPlaceholderText('#FFFFFF（留空=白）')).toBeInTheDocument();
    // 渐变编辑器不渲染
    expect(screen.queryByText('线性')).toBeNull();
  });

  it('点「图片」（无 URL）进入图片态：不显示纯色/渐变编辑器（imagePending 覆盖）', () => {
    setPage({});
    render(<PropertyPanel />);
    fireEvent.click(screen.getByText('图片'));
    expect(screen.queryByText('线性')).toBeNull();
    expect(screen.queryByPlaceholderText('#FFFFFF（留空=白）')).toBeNull();
  });
});
