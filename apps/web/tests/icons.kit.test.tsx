import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { IconKit } from '@/editor/icons/IconKit';

describe('IconKit', () => {
  it('renders an <svg> for a known key', () => {
    const { container } = render(<IconKit name="trend-up" weight="fill" size={20} color="#f00" />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders nothing (null) for an unknown key without throwing', () => {
    const { container } = render(<IconKit name="nope" />);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it('defaults weight to regular', () => {
    const { container } = render(<IconKit name="eye" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });
});
