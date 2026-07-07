import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetaStripComponent } from '@/editor/components/ReportComponents';

describe('MetaStripComponent', () => {
  it('渲染每项的 label + text', () => {
    render(
      <MetaStripComponent
        data={{
          headers: ['图标', '标签', '文本'],
          rows: [
            ['', 'BASE', 'The United States'],
            ['', 'TYPE', 'Beauty'],
          ],
        }}
      />,
    );
    expect(screen.getByText('BASE')).toBeInTheDocument();
    expect(screen.getByText('The United States')).toBeInTheDocument();
    expect(screen.getByText('TYPE')).toBeInTheDocument();
    expect(screen.getByText('Beauty')).toBeInTheDocument();
  });

  it('icon 命中时渲染 svg，空串不渲染', () => {
    const { container } = render(
      <MetaStripComponent
        data={{
          headers: ['图标', '标签', '文本'],
          rows: [
            ['target', 'TIER', 'A'],
            ['', 'BASE', 'US'],
          ],
        }}
      />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelectorAll('svg').length).toBe(1);
  });
});
