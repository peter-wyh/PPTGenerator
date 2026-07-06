import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IconPickerOverlay } from '@/editor/components/IconPickerOverlay';

describe('IconPickerOverlay', () => {
  it('按分类渲染图标按钮', () => {
    render(<IconPickerOverlay onPick={() => {}} onClose={() => {}} />);
    expect(screen.getByText('上升趋势')).toBeInTheDocument();
    expect(screen.getByText('选择图标')).toBeInTheDocument();
  });

  it('点击图标触发 onPick 并关闭', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<IconPickerOverlay onPick={onPick} onClose={onClose} />);
    fireEvent.click(screen.getByText('金额'));
    expect(onPick).toHaveBeenCalledWith('currency');
    expect(onClose).toHaveBeenCalled();
  });

  it('搜索过滤图标', () => {
    render(<IconPickerOverlay onPick={() => {}} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/搜索/), { target: { value: '粉丝' } });
    expect(screen.getByText('粉丝')).toBeInTheDocument();
    expect(screen.queryByText('上升趋势')).toBeNull();
  });

  it('current 图标高亮', () => {
    render(<IconPickerOverlay current="currency" onPick={() => {}} onClose={() => {}} />);
    const btn = screen.getByText('金额').closest('button');
    expect(btn?.className).toContain('border-accent-primary');
  });
});
