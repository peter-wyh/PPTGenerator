import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StrategyBlockComponent } from '@/editor/components/report/StrategyBlock';
import type { StrategyBlockData } from '@mediakit/shared';

describe('StrategyBlock cards 变体(单列卡片 + 品牌色圆形徽章)', () => {
  it('每条渲染为独立卡片,含圆形徽章 + 大写标题 + 正文', () => {
    const data: StrategyBlockData = {
      variant: 'cards',
      headers: ['图标', '标题', '内容'],
      rows: [
        ['sparkle', 'INSIGHT', 'My audience values <mark>authenticity</mark>.'],
        ['target', 'STRATEGY', 'Focus on practical tips.'],
      ],
    };
    const { container } = render(<StrategyBlockComponent data={data} />);
    expect(screen.getByText('INSIGHT')).toBeInTheDocument();
    expect(screen.getByText('STRATEGY')).toBeInTheDocument();
    // 圆形徽章(rounded-full + bg-primary)每条一个
    const badges = container.querySelectorAll('.rounded-full.bg-primary');
    expect(badges).toHaveLength(2);
  });

  it('空数据显示占位', () => {
    render(<StrategyBlockComponent data={{ variant: 'cards', headers: [], rows: [] }} />);
    expect(screen.getByText('Strategy')).toBeInTheDocument();
  });
});
