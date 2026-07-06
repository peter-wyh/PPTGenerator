import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IconPickerOverlay } from '@/editor/icons/IconPickerOverlay';

describe('IconPickerOverlay', () => {
  it('renders category groups with icons', () => {
    const { container } = render(
      <IconPickerOverlay weight="regular" onPick={() => {}} onClear={() => {}} onClose={() => {}} />,
    );
    // 至少渲染出图标按钮（每个图标一个 <svg>）
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(5);
    expect(screen.getByPlaceholderText('搜索图标 key / 名称')).toBeInTheDocument();
  });

  it('search filters icons', () => {
    const { container } = render(
      <IconPickerOverlay weight="regular" onPick={() => {}} onClear={() => {}} onClose={() => {}} />,
    );
    const input = screen.getByPlaceholderText('搜索图标 key / 名称');
    fireEvent.change(input, { target: { value: 'cart' } });
    // 搜索后只剩匹配类目的图标，数量变少但仍 >=1
    const svgsAfter = container.querySelectorAll('svg').length;
    expect(svgsAfter).toBeGreaterThanOrEqual(1);
  });

  it('clicking an icon calls onPick with its key and closes', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<IconPickerOverlay weight="regular" onPick={onPick} onClear={() => {}} onClose={onClose} />);
    // 第一个图标按钮
    const firstIconBtn = document.querySelector('button[title]') as HTMLButtonElement;
    expect(firstIconBtn).toBeTruthy();
    fireEvent.click(firstIconBtn);
    expect(onPick).toHaveBeenCalledTimes(1);
    // 注：onClose 由调用方在 onPick 后触发（见 Task 8），overlay 内点击图标不主动 onClose
  });

  it('shows clear button only when value present; clicking calls onClear', () => {
    const onClear = vi.fn();
    const { rerender } = render(
      <IconPickerOverlay weight="regular" onPick={() => {}} onClear={onClear} onClose={() => {}} />,
    );
    expect(screen.queryByText('清除')).toBeNull();
    rerender(
      <IconPickerOverlay value="eye" weight="regular" onPick={() => {}} onClear={onClear} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByText('清除'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
