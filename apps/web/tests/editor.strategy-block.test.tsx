import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StrategyBlockComponent } from '@/editor/components/ReportComponents';
import type { StrategyBlockData } from '@mediakit/shared';

/* strategy-block 无图表，按 [[web-chart-test-convention]] 断言 shell 文本。 */

const baseRows = [
  ['lightbulb', 'INSIGHT', 'My audience values authenticity.'],
  ['target', 'STRATEGY', 'Focus on practical beauty tips.'],
];
const headers = ['图标', '标题', '内容'];
const highlights = 'authenticity, tips';

describe('StrategyBlockComponent variants', () => {
  it('default（无 variant）→ 平铺，两标题都在，无项目符号', () => {
    render(<StrategyBlockComponent data={{ headers, rows: baseRows, highlights }} />);
    expect(screen.getByText('INSIGHT')).toBeInTheDocument();
    expect(screen.getByText('STRATEGY')).toBeInTheDocument();
    expect(screen.queryByText('•')).not.toBeInTheDocument();
  });

  it('variant:default 显式 → 等同默认', () => {
    render(
      <StrategyBlockComponent data={{ variant: 'default', headers, rows: baseRows, highlights }} />,
    );
    expect(screen.getByText('INSIGHT')).toBeInTheDocument();
    expect(screen.getByText('STRATEGY')).toBeInTheDocument();
    expect(screen.queryByText('•')).not.toBeInTheDocument();
  });

  it('labeled → 卡片标签：两标题都在，无项目符号', () => {
    render(
      <StrategyBlockComponent data={{ variant: 'labeled', headers, rows: baseRows, highlights } as StrategyBlockData} />,
    );
    expect(screen.getByText('INSIGHT')).toBeInTheDocument();
    expect(screen.getByText('STRATEGY')).toBeInTheDocument();
    expect(screen.queryByText('•')).not.toBeInTheDocument();
  });

  it('bulleted → 首行作小标题，其余作 • 列表', () => {
    render(
      <StrategyBlockComponent data={{ variant: 'bulleted', headers, rows: baseRows, highlights } as StrategyBlockData} />,
    );
    // 首行标题作小标题渲染。
    expect(screen.getByText('INSIGHT')).toBeInTheDocument();
    // row[1] 的标题（STRATEGY）丢弃，仅 content 入列表。
    expect(screen.queryByText('STRATEGY')).not.toBeInTheDocument();
    // 1 个 body 行 → 1 个项目符号。
    expect(screen.getAllByText('•')).toHaveLength(1);
  });

  it('bulleted 单行（仅标题）→ 无项目符号', () => {
    render(
      <StrategyBlockComponent
        data={{ variant: 'bulleted', headers, rows: [baseRows[0]], highlights } as StrategyBlockData}
      />,
    );
    expect(screen.getByText('INSIGHT')).toBeInTheDocument();
    expect(screen.queryByText('•')).not.toBeInTheDocument();
  });
});
