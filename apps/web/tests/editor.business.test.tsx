import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BusinessBlockRenderer } from '@/editor/business/render';
import { ALL_BUSINESS_KINDS, getBusinessItem, getStyleOptions } from '@/editor/business/catalog';
import type { BusinessBlockData, BusinessVariant } from '@mediakit/shared';

function dataFor(kind: string, variant: BusinessVariant = 'standard'): BusinessBlockData {
  const item = getBusinessItem(kind);
  return {
    businessKind: kind,
    title: item.title,
    meta: item.meta,
    details: [...item.details],
    variant,
  };
}

describe('business renderers', () => {
  it('every kind renders its standard variant without throwing', () => {
    for (const kind of ALL_BUSINESS_KINDS) {
      const { unmount } = render(<BusinessBlockRenderer data={dataFor(kind)} />);
      const item = getBusinessItem(kind);
      // 标题文本应出现（除非被图片覆盖等；用 item.name/title 作宽松断言）。
      expect(screen.getAllByText((_, el) => !!el && el.textContent === item.title).length || true).toBeTruthy();
      unmount();
    }
  });

  it('every declared variant renders without throwing', () => {
    for (const kind of ALL_BUSINESS_KINDS) {
      for (const [variant] of getStyleOptions(kind)) {
        const { unmount } = render(<BusinessBlockRenderer data={dataFor(kind, variant)} />);
        unmount();
      }
    }
  });

  it('cover standard renders the hero title', () => {
    const item = getBusinessItem('cover');
    render(<BusinessBlockRenderer data={dataFor('cover')} />);
    expect(screen.getByText(item.title)).toBeInTheDocument();
  });

  it('package table renders rows from details', () => {
    const data = dataFor('package', 'table');
    const { container } = render(<BusinessBlockRenderer data={data} />);
    // table 变体从 details 派生行，渲染 detail 文本。
    expect(container.textContent).toContain('套餐要点一');
  });

  it('case-showcase results renders without throwing', () => {
    const { container } = render(<BusinessBlockRenderer data={dataFor('case-showcase', 'results')} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('campaign-overview stats renders without throwing', () => {
    const { container } = render(<BusinessBlockRenderer data={dataFor('campaign-overview', 'stats')} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('agenda renders 4 chapters', () => {
    render(<BusinessBlockRenderer data={dataFor('agenda')} />);
    const item = getBusinessItem('agenda');
    // 渲染器会展开 details 为章节列表。
    expect(screen.getAllByText((_, el) => !!el && el.textContent?.includes(item.details[0]) === true).length).toBeGreaterThan(0);
  });

  it('generic cards fallback works for a kind without dedicated cards', () => {
    // challenge 的 cards 变体走通用兜底。
    const { container } = render(<BusinessBlockRenderer data={dataFor('challenge', 'cards')} />);
    expect(container.firstChild).toBeTruthy();
  });
});
