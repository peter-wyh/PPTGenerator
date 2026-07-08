import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetaStripComponent } from '@/editor/components/ReportComponents';
import { REGISTRY } from '@/editor/registry';
import type { MetaStripData } from '@mediakit/shared';

const rows: string[][] = [
  ['target', 'BASE', 'The United States'],
  ['tag', 'TYPE', 'Beauty'],
  ['trophy', 'TIER', 'A'],
];

function dataFor(variant?: MetaStripData['variant']): MetaStripData {
  return { headers: ['图标', '标签', '文本'], rows, ...(variant ? { variant } : {}) };
}

describe('MetaStripComponent variants', () => {
  it('default (no variant) renders inline labels and text', () => {
    const { container } = render(<MetaStripComponent data={dataFor()} />);
    expect(screen.getByText('BASE')).toBeInTheDocument();
    expect(screen.getByText('The United States')).toBeInTheDocument();
    // inline 胶囊带灰底
    expect(container.querySelector('[class*="bg-surface-secondary"]')).toBeTruthy();
  });

  it('divider renders text without capsule background', () => {
    const { container } = render(<MetaStripComponent data={dataFor('divider')} />);
    expect(screen.getByText('BASE')).toBeInTheDocument();
    expect(screen.getByText('Beauty')).toBeInTheDocument();
    // divider 无胶囊灰底
    expect(container.querySelector('[class*="bg-surface-secondary"]')).toBeNull();
  });

  it('list renders vertical rows', () => {
    const { container } = render(<MetaStripComponent data={dataFor('list')} />);
    expect(screen.getByText('BASE')).toBeInTheDocument();
    expect(screen.getByText('The United States')).toBeInTheDocument();
    // list 容器纵向排列
    expect(container.querySelector('[class*="flex-col"]')).toBeTruthy();
  });

  it('cards renders a grid of cards', () => {
    const { container } = render(<MetaStripComponent data={dataFor('cards')} />);
    expect(screen.getByText('BASE')).toBeInTheDocument();
    expect(screen.getByText('Beauty')).toBeInTheDocument();
    // cards 容器是 grid
    expect(container.querySelector('[class*="grid"]')).toBeTruthy();
  });

  it('stat renders large data text', () => {
    const { container } = render(<MetaStripComponent data={dataFor('stat')} />);
    expect(screen.getByText('The United States')).toBeInTheDocument();
    expect(screen.getByText('BASE')).toBeInTheDocument();
    // stat 的 text 用大号数据字体
    expect(container.querySelector('[class*="font-data"]')).toBeTruthy();
  });
});

describe('meta-strip registry', () => {
  it('declares 5 variants in order', () => {
    const ids = REGISTRY['meta-strip'].variants?.map((v) => v.id);
    expect(ids).toEqual(['inline', 'divider', 'list', 'cards', 'stat']);
  });
});
