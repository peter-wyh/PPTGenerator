import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getDefaultData } from '@/editor/defaults';
import { REGISTRY } from '@/editor/registry';
import { TEMPLATES } from '@/editor/templates';
import { BrandWall, PackageCard } from '@/editor/components/CompanyComponents';

describe('brand-wall + package-card — render', () => {
  it('brand-wall renders brand names, falls back to initial when no logo url', () => {
    render(
      <BrandWall
        data={{
          variant: 'grid',
          headers: ['品牌', 'Logo URL'],
          rows: [['LUMIÈRE', ''], ['NOVA', '']],
        }}
      />,
    );
    expect(screen.getByText('LUMIÈRE')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument(); // 缺 logo 占位首字母
  });

  it('package-card renders name + price + features', () => {
    render(
      <PackageCard
        data={{
          variant: 'standard',
          name: '增长加速包',
          price: '$80,000',
          headers: ['特性'],
          rows: [['40–60 位达人'], ['Spark Ads 资源位']],
          highlighted: false,
        }}
      />,
    );
    expect(screen.getByText('增长加速包')).toBeInTheDocument();
    expect(screen.getByText('$80,000')).toBeInTheDocument();
    expect(screen.getByText('40–60 位达人')).toBeInTheDocument();
  });

  it('package-card featured variant shows 推荐 badge when highlighted', () => {
    render(
      <PackageCard
        data={{
          variant: 'featured',
          name: 'P',
          price: '$1',
          headers: ['特性'],
          rows: [],
          highlighted: true,
        }}
      />,
    );
    expect(screen.getByText('Featured')).toBeInTheDocument();
  });

  it('every variant renders without throwing', () => {
    for (const v of ['grid', 'row', 'marquee'] as const) {
      const { unmount } = render(
        <BrandWall data={{ variant: v, headers: ['品牌', 'Logo URL'], rows: [['A', '']] }} />,
      );
      // grid/row 同时渲染首字母占位 + 品牌名 → 用 getAllByText。
      expect(screen.getAllByText('A').length).toBeGreaterThan(0);
      unmount();
    }
    for (const v of ['standard', 'featured', 'compact'] as const) {
      const { unmount } = render(
        <PackageCard
          data={{ variant: v, name: 'N', price: '$1', headers: ['特性'], rows: [['f']], highlighted: false }}
        />,
      );
      expect(screen.getByText('N')).toBeInTheDocument();
      unmount();
    }
  });
});

describe('brand-wall + package-card — defaults / registry', () => {
  it('getDefaultData returns table-shape data with variant', () => {
    const wall = getDefaultData('brand-wall') as { variant: string; headers: string[]; rows: string[][] };
    expect(wall.variant).toBe('grid');
    expect(wall.rows.length).toBeGreaterThan(0);

    const pkg = getDefaultData('package-card') as { variant: string; name: string; rows: string[][] };
    expect(pkg.variant).toBe('standard');
    expect(pkg.name).toBeTruthy();
    expect(pkg.rows.length).toBeGreaterThan(0);
  });

  it('REGISTRY has both with variants + propertySchema', () => {
    for (const t of ['brand-wall', 'package-card'] as const) {
      expect(REGISTRY[t].variants?.length).toBeGreaterThanOrEqual(2);
      expect(REGISTRY[t].propertySchema.length).toBeGreaterThan(0);
    }
  });
});

describe('decomposed page templates', () => {
  const find = (id: string) => TEMPLATES.find((t) => t.id === id)!;

  it('cover-page composes 2 text blocks', () => {
    const comps = find('cover-page').components();
    expect(comps.every((c) => c.type === 'text')).toBe(true);
    expect(comps.length).toBe(2);
  });

  it('agenda-page composes title text + table', () => {
    const types = find('agenda-page').components().map((c) => c.type);
    expect(types).toContain('text');
    expect(types).toContain('table');
  });

  it('company-page composes title + intro + brand-wall', () => {
    const types = find('company-page').components().map((c) => c.type);
    expect(types.filter((t) => t === 'text').length).toBeGreaterThanOrEqual(2);
    expect(types).toContain('brand-wall');
  });

  it('package-page composes title + 3 package-cards', () => {
    const comps = find('package-page').components();
    const types = comps.map((c) => c.type);
    expect(types.filter((t) => t === 'package-card').length).toBe(3);
    expect(types).toContain('text');
    // 中间卡为推荐（highlighted）。
    const cards = comps.filter((c) => c.type === 'package-card');
    expect((cards[1].data as { highlighted: boolean }).highlighted).toBe(true);
  });
});
