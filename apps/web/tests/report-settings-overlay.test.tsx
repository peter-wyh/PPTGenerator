import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReportSettingsOverlay } from '@/editor/components/ReportSettingsOverlay';
import { useEditorStore } from '@/editor/store';
import { DEFAULT_THEME } from '@mediakit/shared';

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
    expect(screen.getByText('卡片阴影')).toBeInTheDocument();
  });
});
