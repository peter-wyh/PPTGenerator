import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ShapeComponent } from '@/editor/components/BasicComponents';
import { ShapeFields } from '@/editor/property-panel';
import type { ShapeData } from '@mediakit/shared';

describe('ShapeComponent', () => {
  it('rectangle 渲染填充色', () => {
    const data: ShapeData = { shape: 'rectangle', fill: '#FF5C00', stroke: '#E5E7EB', strokeWidth: 0, opacity: 1, rotation: 0 };
    const { container } = render(<ShapeComponent data={data} />);
    const inner = container.querySelector('.h-full.w-full > div');
    expect(inner?.getAttribute('style')).toContain('background-color');
  });
  it('rounded 应用 borderRadius', () => {
    const data: ShapeData = { shape: 'rounded', fill: '#FF5C00', strokeWidth: 0, opacity: 1, rotation: 0, borderRadius: 16 };
    const { container } = render(<ShapeComponent data={data} />);
    expect(container.innerHTML).toContain('border-radius');
    expect(container.innerHTML).toContain('16');
  });
  it('circle 用 50% 圆角', () => {
    const data: ShapeData = { shape: 'circle', fill: '#3B82F6', strokeWidth: 0, opacity: 1, rotation: 0 };
    const { container } = render(<ShapeComponent data={data} />);
    expect(container.innerHTML).toContain('50%');
  });
  it('line 渲染 SVG line 且无填充', () => {
    const data: ShapeData = { shape: 'line', stroke: '#E5E7EB', strokeWidth: 2, opacity: 1, rotation: 0, dash: true };
    const { container } = render(<ShapeComponent data={data} />);
    expect(container.querySelector('svg line')).not.toBeNull();
    expect(container.querySelector('svg line')?.getAttribute('stroke-dasharray')).toBe('8 4');
    expect(container.innerHTML).not.toContain('background-color');
  });
  it('rotation/opacity 应用到外层', () => {
    const data: ShapeData = { shape: 'rectangle', fill: '#000', strokeWidth: 0, opacity: 0.5, rotation: 45 };
    const { container } = render(<ShapeComponent data={data} />);
    expect(container.innerHTML).toContain('rotate(45deg)');
    expect(container.innerHTML).toContain('opacity');
  });
});

describe('ShapeFields', () => {
  it('line 不显示填充色，rounded 显示圆角半径', () => {
    const line = render(<ShapeFields comp={{ id: 'l', type: 'shape', x: 0, y: 0, w: 200, h: 4, data: { shape: 'line', stroke: '#E5E7EB', strokeWidth: 1, opacity: 1, rotation: 0, dash: false } } as any} />);
    expect(line.queryByText('填充色')).toBeNull();
    const rounded = render(<ShapeFields comp={{ id: 'r', type: 'shape', x: 0, y: 0, w: 200, h: 120, data: { shape: 'rounded', fill: '#000', strokeWidth: 0, opacity: 1, rotation: 0, borderRadius: 12 } } as any} />);
    expect(rounded.getByText('圆角半径')).toBeInTheDocument();
  });
});
