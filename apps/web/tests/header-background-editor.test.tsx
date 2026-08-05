import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeaderBackgroundEditor } from '@/editor/components/ReportSettingsOverlay';

/**
 * 页眉背景不透明度在改色/切类型时必须保留。
 * 历史回归：HeaderBackgroundEditor 的 color/type/gradient/image 每次.onChange 都重建
 * 背景对象且不带 opacity，导致用户调好透明度后再动一下颜色，opacity 静默回到 1。
 */
describe('HeaderBackgroundEditor 改色/切类型时保留 opacity', () => {
  it('改纯色值 → onChange 携带原 opacity', () => {
    const onChange = vi.fn();
    render(
      <HeaderBackgroundEditor
        background={{ type: 'color', color: '#ffffff', opacity: 0.5 }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('#ffffff'), { target: { value: '#000000' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'color', color: '#000000', opacity: 0.5 }),
    );
  });

  it('切到渐变 → onChange 保留原 opacity', () => {
    const onChange = vi.fn();
    render(
      <HeaderBackgroundEditor
        background={{ type: 'color', color: '#ffffff', opacity: 0.5 }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText('渐变'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'gradient', opacity: 0.5 }));
  });

  it('切到图片 → onChange 保留原 opacity', () => {
    const onChange = vi.fn();
    render(
      <HeaderBackgroundEditor
        background={{ type: 'color', color: '#ffffff', opacity: 0.3 }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText('图片'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'image', opacity: 0.3 }));
  });

  it('原背景无 opacity → 不强行注入', () => {
    const onChange = vi.fn();
    render(
      <HeaderBackgroundEditor background={{ type: 'color', color: '#ffffff' }} onChange={onChange} />,
    );
    fireEvent.change(screen.getByPlaceholderText('#ffffff'), { target: { value: '#000000' } });
    expect((onChange.mock.calls[0]?.[0] as { opacity?: number }).opacity).toBeUndefined();
  });
});
