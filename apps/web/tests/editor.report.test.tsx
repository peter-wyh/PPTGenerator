import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getDefaultData } from '@/editor/defaults';
import { REGISTRY } from '@/editor/registry';
import { TEMPLATES, getTemplate, getTemplateByPageType, resolveTemplateForBusinessLine } from '@/editor/templates';
import type { PageType } from '@mediakit/shared';
import { KpiBoard, TimelineCompare, PlacementDisplay, PostList, ProductPerformance } from '@/editor/components/report';

describe('report components — render', () => {
  it('kpi-board renders labels + values', () => {
    render(
      <KpiBoard
        data={{
          variant: 'grid',
          headers: ['指标', '数值', '对比'],
          rows: [
            ['Sales', '$1.24M', '+15%'],
            ['Clicks', '120K', '-3%'],
          ],
        }}
      />,
    );
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('$1.24M')).toBeInTheDocument();
    expect(screen.getByText('+15%')).toBeInTheDocument();
    expect(screen.getByText('-3%')).toBeInTheDocument();
  });

  it('timeline-compare renders rows + status chips', () => {
    render(
      <TimelineCompare
        data={{
          variant: 'standard',
          headers: ['指标', '本期', '上期', '状态'],
          rows: [['Total Sales', '$1.24M', '$1.08M', 'Exceeded']],
        }}
      />,
    );
    expect(screen.getByText('Total Sales')).toBeInTheDocument();
    expect(screen.getAllByText('$1.24M').length).toBeGreaterThan(0);
    expect(screen.getByText('Exceeded')).toBeInTheDocument();
  });

  it('every variant renders without throwing', () => {
    for (const v of ['grid', 'row', 'compact'] as const) {
      const { unmount } = render(
        <KpiBoard data={{ variant: v, headers: ['指标', '数值', '对比'], rows: [['A', '1', '+1%']] }} />,
      );
      expect(screen.getByText('A')).toBeInTheDocument();
      unmount();
    }
    for (const v of ['standard', 'mini', 'with-bar'] as const) {
      const { unmount } = render(
        <TimelineCompare
          data={{ variant: v, headers: ['指标', '本期', '上期', '状态'], rows: [['A', '10', '8', 'Exceeded']] }}
        />,
      );
      expect(screen.getByText('A')).toBeInTheDocument();
      unmount();
    }
  });
});

describe('report components — defaults / registry', () => {
  it('getDefaultData returns table-shape + variant', () => {
    const kpi = getDefaultData('kpi-board') as { variant: string; headers: string[]; rows: string[][] };
    expect(kpi.variant).toBe('grid');
    expect(kpi.headers.length).toBe(3);
    expect(kpi.rows.length).toBeGreaterThan(0);

    const tl = getDefaultData('timeline-compare') as { variant: string; headers: string[] };
    expect(tl.variant).toBe('standard');
    expect(tl.headers.length).toBe(4);
  });

  it('REGISTRY has both with variants', () => {
    for (const t of ['kpi-board', 'timeline-compare'] as const) {
      expect(REGISTRY[t].variants?.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('product / placement / post — render + variants', () => {
  it('product-performance renders names + insight', () => {
    render(
      <ProductPerformance
        data={{
          variant: 'cards',
          insight: '精华类贡献 46%',
          headers: ['商品', '图URL', '销量', '占比', '品类'],
          rows: [['敏感肌精华', '', '12.4K', '32%', '护肤']],
        }}
      />,
    );
    expect(screen.getByText('敏感肌精华')).toBeInTheDocument();
    expect(screen.getByText(/精华类贡献/)).toBeInTheDocument();
  });

  it('placement-display renders names; with-text shows highlights', () => {
    render(
      <PlacementDisplay
        data={{
          variant: 'with-text',
          highlights: 'Banner CTR 高',
          learnings: '',
          headers: ['名称', '截图URL', '数据'],
          rows: [['首页 Banner', '', 'CTR 2.4%']],
        }}
      />,
    );
    expect(screen.getByText('首页 Banner')).toBeInTheDocument();
    expect(screen.getByText(/Banner CTR 高/)).toBeInTheDocument();
  });

  it('post-list renders titles + ids', () => {
    render(
      <PostList
        data={{
          variant: 'cards',
          headers: ['截图URL', '标题', 'ID', '链接', '数据'],
          rows: [['', '深度测评', 'CS-001', 'link', '阅读 24K']],
        }}
      />,
    );
    expect(screen.getByText('深度测评')).toBeInTheDocument();
    expect(screen.getByText('CS-001')).toBeInTheDocument();
  });

  it('every variant of the three renders without throwing', () => {
    const prod = { insight: '', headers: ['商品', '图', '销量', '占比', '品类'], rows: [['A', '', '1', '10%', 'c']] };
    for (const v of ['cards', 'rank', 'grid'] as const) {
      const { unmount } = render(<ProductPerformance data={{ variant: v, ...prod }} />);
      expect(screen.getAllByText('A').length).toBeGreaterThan(0);
      unmount();
    }
    const plc = { highlights: '', learnings: '', headers: ['名称', '图', '数据'], rows: [['P', '', 'd']] };
    for (const v of ['single', 'grid', 'with-text'] as const) {
      const { unmount } = render(<PlacementDisplay data={{ variant: v, ...plc }} />);
      expect(screen.getAllByText('P').length).toBeGreaterThan(0);
      unmount();
    }
    const post = { headers: ['图', '标题', 'ID', '链接', '数据'], rows: [['', 'T', 'ID1', 'l', 'm']] };
    for (const v of ['cards', 'row', 'compact'] as const) {
      const { unmount } = render(<PostList data={{ variant: v, ...post }} />);
      expect(screen.getAllByText('T').length).toBeGreaterThan(0);
      unmount();
    }
  });

  it('defaults + REGISTRY entries', () => {
    for (const t of ['product-performance', 'placement-display', 'post-list'] as const) {
      expect(getDefaultData(t)).toHaveProperty('variant');
      expect(REGISTRY[t].variants?.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('campaign report page templates', () => {
  const find = (id: string) => TEMPLATES.find((t) => t.id === id)!;
  const types = (id: string) => find(id).components().map((c) => c.type);

  it('report-weekly-overview = title + kpi-board + plan text', () => {
    const t = types('report-weekly-overview');
    expect(t).toContain('kpi-board');
    expect(t.filter((x) => x === 'text').length).toBeGreaterThanOrEqual(1);
  });

  it('report-monthly-overview = title + kpi + bar-chart + timeline + insight', () => {
    const t = types('report-monthly-overview');
    expect(t).toContain('kpi-board');
    expect(t).toContain('bar-chart');
    expect(t).toContain('timeline-compare');
  });

  it('report-channel = title + compact kpi-board + table', () => {
    const comps = find('report-channel').components();
    const kpi = comps.find((c) => c.type === 'kpi-board')!;
    expect((kpi.data as { variant: string }).variant).toBe('compact'); // 验证模板内可调变体
    expect(comps.map((c) => c.type)).toContain('table');
  });

  it('report-wrapup-review = title + kpi + timeline(with-bar) + text', () => {
    const comps = find('report-wrapup-review').components();
    const tl = comps.find((c) => c.type === 'timeline-compare')!;
    expect((tl.data as { variant: string }).variant).toBe('with-bar');
    expect(comps.map((c) => c.type)).toContain('kpi-board');
  });

  it('report-product = title + product-performance', () => {
    const t = types('report-product');
    expect(t).toContain('product-performance');
    expect(t).toContain('text');
  });

  it('report-creator-collab composes creator trio + note', () => {
    const t = types('report-creator-collab');
    expect(t).toContain('creator-avatar-card');
    expect(t).toContain('creator-stats-strip');
    expect(t).toContain('creator-works-list');
    // 数据在运行时由 applyPageBinding 从项目数据填充，模板只声明布局+取数逻辑。
    // 验证组件结构完整（avatar + stats + works + fanGender + fanAge + note）。
    const comps = find('report-creator-collab').components();
    expect(comps.length).toBeGreaterThanOrEqual(6);
  });

  it('report-placement = title + placement-display(with-text)', () => {
    const comps = find('report-placement').components();
    const pl = comps.find((c) => c.type === 'placement-display')!;
    expect((pl.data as { variant: string }).variant).toBe('with-text');
  });

  it('report-posts = title + post-list', () => {
    const t = types('report-posts');
    expect(t).toContain('post-list');
    expect(t).toContain('text');
  });
});

describe('report-creator-collab 业务线变体（"+ 页面" 浮层按业务线套用）', () => {
  const BUSINESS_LINES = ['FT', 'SM', 'CX', 'DG', 'KN', 'DM'] as const;

  it.each(BUSINESS_LINES)('%s 存在 report-creator-collab 业务线变体', (bl) => {
    const tpl = getTemplateByPageType('report-creator-collab', bl);
    expect(tpl?.businessLine).toBe(bl);
    expect(tpl?.id).toBe(`report-creator-collab-${bl}-bl`);
  });

  it.each(BUSINESS_LINES)('%s 变体保留 creator 三件套 + 粉丝画像 + 备注', (bl) => {
    const tpl = getTemplate(`report-creator-collab-${bl}-bl`)!;
    const compTypes = tpl.components().map((c) => c.type);
    expect(compTypes).toContain('creator-avatar-card');
    expect(compTypes).toContain('creator-stats-strip');
    expect(compTypes).toContain('creator-works-list');
    expect(compTypes).toContain('creator-fan-gender');
    expect(compTypes).toContain('creator-fan-age');
  });

  it('resolveTemplateForBusinessLine：FT 项目点通用 report-creator-collab → 解析到 FT 变体', () => {
    const generic = getTemplate('report-creator-collab')!;
    // 命中业务线变体
    expect(resolveTemplateForBusinessLine(generic, 'FT').id).toBe('report-creator-collab-FT-bl');
    // 无业务线 → 回退通用
    expect(resolveTemplateForBusinessLine(generic, undefined).id).toBe('report-creator-collab');
    // 该 pageType 无业务线变体 → 回退通用（blank 故意不变体化）
    const blank = getTemplate('blank')!;
    expect(resolveTemplateForBusinessLine(blank, 'FT').id).toBe('blank');
  });
});

describe('其余报告页业务线变体（weekly / channel / wrapup / placement / posts）', () => {
  // 每个类型断言「6 个业务线都有变体 + 保留该页的关键组件」。
  const CASES: { id: string; keyComp: string }[] = [
    { id: 'report-weekly-overview', keyComp: 'kpi-board' },
    { id: 'report-channel', keyComp: 'table' },
    { id: 'report-wrapup-review', keyComp: 'timeline-compare' },
    { id: 'report-placement', keyComp: 'placement-display' },
    { id: 'report-posts', keyComp: 'post-list' },
  ];
  const BLS = ['FT', 'SM', 'CX', 'DG', 'KN', 'DM'];

  it.each(CASES)('$id：6 个业务线均有变体且保留关键组件 $keyComp', ({ id, keyComp }) => {
    for (const bl of BLS) {
      const tpl = getTemplateByPageType(id as PageType, bl);
      expect(tpl?.businessLine, `${id}/${bl} businessLine`).toBe(bl);
      expect(tpl?.id, `${id}/${bl} id`).toBe(`${id}-${bl}-bl`);
      expect(tpl!.components().map((c) => c.type), `${id}/${bl} components`).toContain(keyComp);
    }
  });

  it('report-channel 变体的 kpi-board 保持 compact 变体；wrapup 的 timeline 保持 with-bar', () => {
    const channel = getTemplate('report-channel-FT-bl')!.components();
    expect((channel.find((c) => c.type === 'kpi-board')!.data as { variant: string }).variant).toBe('compact');
    const wrapup = getTemplate('report-wrapup-review-FT-bl')!.components();
    expect((wrapup.find((c) => c.type === 'timeline-compare')!.data as { variant: string }).variant).toBe('with-bar');
  });

  it('report-placement 变体的 placement-display 保持 with-text 变体', () => {
    const placement = getTemplate('report-placement-FT-bl')!.components();
    expect((placement.find((c) => c.type === 'placement-display')!.data as { variant: string }).variant).toBe('with-text');
  });
});

describe('基础 / 公司 / 策略页业务线变体', () => {
  const CASES: { id: string; keyComp: string }[] = [
    { id: 'title', keyComp: 'text' },
    { id: 'table', keyComp: 'table' },
    { id: 'agenda', keyComp: 'table' },
    { id: 'company', keyComp: 'brand-wall' },
    { id: 'milestone', keyComp: 'table' },
    { id: 'global', keyComp: 'table' },
    { id: 'org', keyComp: 'table' },
    { id: 'service', keyComp: 'table' },
    { id: 'process', keyComp: 'table' },
    { id: 'calendar', keyComp: 'table' },
    { id: 'campaign-plan', keyComp: 'table' },
    { id: 'challenge', keyComp: 'swot-matrix' },
    { id: 'content-analysis', keyComp: 'bar-chart' },
  ];
  const BLS = ['FT', 'SM', 'CX', 'DG', 'KN', 'DM'];

  it.each(CASES)('$id：6 个业务线均有变体且保留关键组件 $keyComp', ({ id, keyComp }) => {
    for (const bl of BLS) {
      const tpl = getTemplateByPageType(id as PageType, bl);
      expect(tpl?.businessLine, `${id}/${bl} businessLine`).toBe(bl);
      expect(tpl?.id, `${id}/${bl} id`).toBe(`${id}-${bl}-bl`);
      expect(tpl!.components().map((c) => c.type), `${id}/${bl} components`).toContain(keyComp);
    }
  });

  it('blank 故意无业务线变体（空页无样式可分），FT 项目仍回退通用 blank', () => {
    expect(getTemplateByPageType('blank', 'FT')?.id).toBe('blank');
    expect(getTemplateByPageType('blank', 'FT')?.businessLine).toBeUndefined();
  });
});
