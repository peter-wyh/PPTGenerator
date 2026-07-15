import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CreatorAvatar } from '@/components/CreatorAvatar';

describe('CreatorAvatar', () => {
  it('有 avatar URL → 渲染 <img>', () => {
    const { container } = render(<CreatorAvatar name="Mia Chen" avatar="https://x/a.png" size={28} />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('https://x/a.png');
    expect(img?.getAttribute('alt')).toBe('Mia Chen');
  });
  it('无 avatar → 首字母兜底(无 img)', () => {
    const { container } = render(<CreatorAvatar name="Mia Chen" size={28} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('M');
  });
  it('无 name → "?"', () => {
    const { container } = render(<CreatorAvatar name="" size={28} />);
    expect(container.textContent).toBe('?');
  });
});
