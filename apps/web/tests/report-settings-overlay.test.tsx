import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportSettingsOverlay } from '@/editor/components/ReportSettingsOverlay';
import { useEditorStore } from '@/editor/store';
import { DEFAULT_THEME } from '@mediakit/shared';
import { BUSINESS_LINE_META } from '@/projectsMeta';

vi.mock('@/components/ImageInput', () => ({
  ImageInput: ({ value }: { value?: string }) => (value ? <img alt="img" src={value} /> : null),
}));

const noop = () => {};

describe('ReportSettingsOverlay skinPreset 移除', () => {
  it('不渲染「皮肤质感」分区；弹窗正常渲染', () => {
    useEditorStore.setState({ projectMeta: { theme: DEFAULT_THEME } } as never);
    render(<ReportSettingsOverlay onClose={noop} />);
    expect(screen.queryByText('皮肤质感')).toBeNull();
    expect(screen.getByText('全局样式设置')).toBeInTheDocument();
    // 卡片阴影现归「组件样式」分类（重构后非默认视图），切到该分类后可见。
    fireEvent.click(screen.getByText('组件样式'));
    expect(screen.getByText('卡片阴影')).toBeInTheDocument();
  });
});

describe('ReportSettingsOverlay 左导航 + 业务线 Logo', () => {
  it('左导航 4 项可见；默认选「基础样式」（配色可见）', () => {
    useEditorStore.setState({ projectMeta: { theme: DEFAULT_THEME } } as never);
    render(<ReportSettingsOverlay onClose={noop} />);
    expect(screen.getByText('基础样式')).toBeInTheDocument();
    expect(screen.getByText('布局')).toBeInTheDocument();
    expect(screen.getByText('组件样式')).toBeInTheDocument();
    expect(screen.getByText('品牌')).toBeInTheDocument();
    expect(screen.getByText('配色')).toBeInTheDocument(); // 基础样式默认展开
  });

  it('标题栏右上角渲染当前业务线 Logo + 名称', () => {
    useEditorStore.setState({ projectMeta: { businessLine: 'FT', theme: DEFAULT_THEME } } as never);
    render(<ReportSettingsOverlay onClose={noop} />);
    const logo = screen.getByAltText(BUSINESS_LINE_META.FT.name);
    expect(logo).toHaveAttribute('src', BUSINESS_LINE_META.FT.logo);
  });

  it('无业务线时不渲染 Logo', () => {
    useEditorStore.setState({ projectMeta: { theme: DEFAULT_THEME } } as never);
    render(<ReportSettingsOverlay onClose={noop} />);
    expect(screen.queryByAltText(BUSINESS_LINE_META.FT.name)).toBeNull();
  });
});
