import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StrategyBlockComponent } from '@/editor/components/report';
import type { StrategyBlockData } from '@mediakit/shared';

/* strategy-block 无图表，按 [[web-chart-test-convention]] 断言 shell 文本。 */

const baseRows = [
  ['lightbulb', 'INSIGHT', 'My audience values authenticity.'],
  ['target', 'STRATEGY', 'Focus on practical beauty tips.'],
];
const headers = ['图标', '标题', '内容'];

describe('StrategyBlockComponent variants', () => {
  it('default（无 variant）→ 平铺，两标题都在', () => {
    render(<StrategyBlockComponent data={{ headers, rows: baseRows } as StrategyBlockData} />);
    expect(screen.getByText('INSIGHT')).toBeInTheDocument();
    expect(screen.getByText('STRATEGY')).toBeInTheDocument();
  });

  it('variant:default 显式 → 等同默认', () => {
    render(
      <StrategyBlockComponent data={{ variant: 'default', headers, rows: baseRows } as StrategyBlockData} />,
    );
    expect(screen.getByText('INSIGHT')).toBeInTheDocument();
    expect(screen.getByText('STRATEGY')).toBeInTheDocument();
  });

  it('labeled → 两标题都在', () => {
    render(
      <StrategyBlockComponent data={{ variant: 'labeled', headers, rows: baseRows } as StrategyBlockData} />,
    );
    expect(screen.getByText('INSIGHT')).toBeInTheDocument();
    expect(screen.getByText('STRATEGY')).toBeInTheDocument();
  });

  it('bulleted（卡片列表）→ 每行渲染为独立卡片，标题均在，无项目符号', () => {
    render(
      <StrategyBlockComponent data={{ variant: 'bulleted', headers, rows: baseRows } as StrategyBlockData} />,
    );
    expect(screen.getByText('INSIGHT')).toBeInTheDocument();
    expect(screen.getByText('STRATEGY')).toBeInTheDocument();
    expect(screen.queryByText('•')).not.toBeInTheDocument();
  });

  it('bulleted 单行 → 1 张卡片、标题出现', () => {
    render(
      <StrategyBlockComponent
        data={{ variant: 'bulleted', headers, rows: [baseRows[0]] } as StrategyBlockData}
      />,
    );
    expect(screen.getByText('INSIGHT')).toBeInTheDocument();
  });

  it('default 富文本内容：渲染 <b>', () => {
    const { container } = render(
      <StrategyBlockComponent
        data={{ headers, rows: [['sparkle', 'INSIGHT', 'focus on <b>beauty tips</b>']] } as StrategyBlockData}
      />,
    );
    expect(container.querySelector('b')).not.toBeNull();
  });

  it('default 富文本内容：<ul> 列表渲染', () => {
    const { container } = render(
      <StrategyBlockComponent
        data={{ headers, rows: [['target', 'STRATEGY', '<ul><li>a</li><li>b</li></ul>']] } as StrategyBlockData}
      />,
    );
    expect(container.querySelector('ul')).not.toBeNull();
    expect(container.querySelectorAll('li').length).toBe(2);
  });

  it('default 内联高亮 <mark> 经 sanitize 保留并渲染', () => {
    const { container } = render(
      <StrategyBlockComponent
        data={{ headers, rows: [['sparkle', 'INSIGHT', 'focus on <mark>beauty</mark>']] } as StrategyBlockData}
      />,
    );
    expect(container.querySelector('mark')).not.toBeNull();
  });

  it('bulleted 多行 → 每行一张卡片，grid-cols-2 网格', () => {
    const { container } = render(
      <StrategyBlockComponent
        data={{
          variant: 'bulleted',
          headers,
          rows: [
            ['target', 'ONE', 'item1'],
            ['sparkle', 'TWO', 'item2'],
            ['sparkle', 'THREE', 'item3'],
            ['sparkle', 'FOUR', 'item4'],
          ],
        } as StrategyBlockData}
      />,
    );
    expect(screen.getByText('ONE')).toBeInTheDocument();
    expect(screen.getByText('FOUR')).toBeInTheDocument();
    expect(container.querySelector('.grid-cols-2')).not.toBeNull();
  });
});
