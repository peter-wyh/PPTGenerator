import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetaStripComponent, StrategyBlockComponent } from '@/editor/components/ReportComponents';

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

describe('StrategyBlockComponent', () => {
  it('渲染每块的 title + content', () => {
    render(
      <StrategyBlockComponent
        data={{
          headers: ['图标', '标题', '内容'],
          rows: [
            ['', 'INSIGHT', 'My audience values authenticity.'],
            ['', 'STRATEGY', 'Focus on practical tips.'],
          ],
        }}
      />,
    );
    expect(screen.getByText('INSIGHT')).toBeInTheDocument();
    expect(screen.getByText('My audience values authenticity.')).toBeInTheDocument();
    expect(screen.getByText('STRATEGY')).toBeInTheDocument();
  });

  it('highlights 命中词包成高亮 span', () => {
    const { container } = render(
      <StrategyBlockComponent
        data={{
          headers: ['图标', '标题', '内容'],
          rows: [['', 'INSIGHT', 'practical beauty tips for everyday']],
          highlights: 'beauty, tips',
        }}
      />,
    );
    const highlights = container.querySelectorAll('.text-accent-secondary');
    expect(highlights.length).toBe(2);
    expect(highlights[0].textContent).toBe('beauty');
    expect(highlights[1].textContent).toBe('tips');
  });

  it('无 highlights 时纯文本、无高亮 span', () => {
    const { container } = render(
      <StrategyBlockComponent
        data={{
          headers: ['图标', '标题', '内容'],
          rows: [['', 'INSIGHT', 'plain text']],
        }}
      />,
    );
    expect(container.querySelector('.text-accent-secondary')).toBeNull();
    expect(screen.getByText('plain text')).toBeInTheDocument();
  });
});
