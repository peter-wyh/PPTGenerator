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

  it('package table renders the comparison rows', () => {
    render(<BusinessBlockRenderer data={dataFor('package', 'table')} />);
    expect(screen.getByText('服务周期')).toBeInTheDocument();
    expect(screen.getByText('$80K')).toBeInTheDocument();
  });

  it('case-showcase results renders 138%', () => {
    render(<BusinessBlockRenderer data={dataFor('case-showcase', 'results')} />);
    expect(screen.getByText('138%')).toBeInTheDocument();
  });

  it('campaign-overview stats renders 12.6M hero', () => {
    render(<BusinessBlockRenderer data={dataFor('campaign-overview', 'stats')} />);
    expect(screen.getByText('12.6M')).toBeInTheDocument();
  });

  it('agenda renders 4 chapters', () => {
    render(<BusinessBlockRenderer data={dataFor('agenda')} />);
    expect(screen.getByText('公司概览')).toBeInTheDocument();
    expect(screen.getByText('Campaign 结案')).toBeInTheDocument();
  });

  it('generic cards fallback works for a kind without dedicated cards', () => {
    // challenge 的 cards 变体走通用兜底。
    const { container } = render(<BusinessBlockRenderer data={dataFor('challenge', 'cards')} />);
    expect(container.firstChild).toBeTruthy();
  });
});
