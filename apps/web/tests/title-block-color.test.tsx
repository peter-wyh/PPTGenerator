import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TitleBlock } from '@/editor/components/BasicComponents';
import type { TitleBlockData } from '@mediakit/shared';

const base: TitleBlockData = { variant: 'plain', text: 'Hello' };

function titleColor() {
  const el = screen.getByText('Hello');
  return (el as HTMLElement).style.color;
}

describe('TitleBlock 标题颜色(titleColor)', () => {
  it('缺省 = 黑色', () => {
    render(<TitleBlock data={{ ...base }} />);
    expect(titleColor()).toBe('var(--foreground-primary)'); // black → 前景色 CSS 变量(随主题明暗)
  });

  it('titleColor: "black" → 黑色', () => {
    render(<TitleBlock data={{ ...base, titleColor: 'black' }} />);
    expect(titleColor()).toBe('var(--foreground-primary)'); // black → 前景色 CSS 变量(随主题明暗)
  });

  it('titleColor: "brand" → 品牌色 var(--color-primary)', () => {
    render(<TitleBlock data={{ ...base, titleColor: 'brand' }} />);
    expect(titleColor()).toContain('var(--color-primary)');
  });

  it('gradient 变体固定白(忽略 titleColor)', () => {
    render(<TitleBlock data={{ variant: 'gradient', text: 'Hello', titleColor: 'brand' }} />);
    expect(titleColor()).toBe('var(--surface-primary)'); // gradient 固定反白 → 表面色 CSS 变量
  });
});
