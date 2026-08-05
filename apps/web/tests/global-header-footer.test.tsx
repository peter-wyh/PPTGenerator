import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { GlobalHeader } from '@/editor/components/GlobalHeaderFooter';
import type { GlobalHeaderConfig } from '@mediakit/shared';

function headerRoot(config: GlobalHeaderConfig): HTMLElement {
  const { container } = render(<GlobalHeader config={config} width={1080} />);
  return container.firstChild as HTMLElement;
}

/**
 * 页眉背景不透明度（HeaderBackground.opacity）必须让页眉真正半透明。
 * 历史回归：容器自身画了不透明 `background: bg`，再叠一层 zIndex:-1 遮罩——
 * 同色叠加，遮罩毫无效果，页眉永远不透明。
 */
describe('GlobalHeader 背景不透明度', () => {
  it('opacity<1：容器背景透明（让 zIndex:-1 遮罩透过容器与页面合成半透明）', () => {
    const root = headerRoot({
      enabled: true,
      background: { type: 'color', color: '#1a1a2e', opacity: 0.5 },
    });
    expect(root.style.background).toBe('transparent');
    // 遮罩层存在且承载半透明背景
    const overlay = Array.from(root.children).find(
      (c) => (c as HTMLElement).style.opacity === '0.5',
    );
    expect(overlay).toBeTruthy();
  });

  it('opacity=1：容器画不透明背景，不渲染遮罩层', () => {
    const root = headerRoot({
      enabled: true,
      background: { type: 'color', color: '#1a1a2e', opacity: 1 },
    });
    expect(root.style.background).not.toBe('transparent');
    const overlay = Array.from(root.children).find(
      (c) => (c as HTMLElement).style.opacity === '1',
    );
    expect(overlay).toBeUndefined();
  });

  it('字符串背景（旧形状，无 opacity）：容器画不透明背景', () => {
    const root = headerRoot({ enabled: true, background: '#1a1a2e' });
    expect(root.style.background).not.toBe('transparent');
  });

  it('opacity=0（完全透明）：容器背景透明', () => {
    const root = headerRoot({
      enabled: true,
      background: { type: 'color', color: '#1a1a2e', opacity: 0 },
    });
    expect(root.style.background).toBe('transparent');
  });
});
