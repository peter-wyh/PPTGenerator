import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkScreenshot, WorkMetrics, CommentWordcloud } from '@/editor/components/WorksComponents';
import type { WorkScreenshotData, WorkMetricsData } from '@mediakit/shared';

describe('WorkScreenshot', () => {
  it('renders the title and a placeholder tile for each image lacking src', () => {
    const data: WorkScreenshotData = {
      variant: 'auto',
      title: '代表作',
      images: [{ src: '' }, { src: '' }],
    };
    render(<WorkScreenshot data={data} />);
    expect(screen.getByText('代表作')).toBeInTheDocument();
    // 每张缺 src 的图各渲染一个占位
    expect(screen.getAllByText('Work screenshot').length).toBe(2);
  });

  it('renders provided screenshot images', () => {
    const data: WorkScreenshotData = {
      variant: 'auto',
      images: [{ src: 'a.jpg' }, { src: 'b.jpg' }],
    };
    render(<WorkScreenshot data={data} />);
    const imgs = screen.getAllByRole('img');
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual(['a.jpg', 'b.jpg']);
  });

  it('uses count-based mosaic layout: 2 images → 2 columns (duo)', () => {
    const { container } = render(
      <WorkScreenshot data={{ variant: 'auto', images: [{ src: 'a.jpg' }, { src: 'b.jpg' }] }} />,
    );
    const grid = container.querySelector('[style*="grid-template-columns"]') as HTMLElement;
    expect(grid?.style.gridTemplateColumns).toBe('repeat(2, 1fr)');
  });

  it('uses count-based mosaic layout: 9 images → 3 columns (nona)', () => {
    const { container } = render(
      <WorkScreenshot
        data={{ variant: 'auto', images: Array.from({ length: 9 }, () => ({ src: 'x.jpg' })) }}
      />,
    );
    const grid = container.querySelector('[style*="grid-template-columns"]') as HTMLElement;
    expect(grid?.style.gridTemplateColumns).toBe('repeat(3, 1fr)');
  });

  it('every image-group variant renders the images without throwing', () => {
    for (const v of [
      'auto', 'duo', 'trio', 'quad', 'mosaic-5', 'hex', 'septet', 'nona', 'duoza',
    ] as const) {
      const { unmount } = render(
        <WorkScreenshot data={{ variant: v, images: [{ src: 'x.jpg' }, { src: 'y.jpg' }] }} />,
      );
      expect(screen.getAllByRole('img').length).toBeGreaterThanOrEqual(1);
      unmount();
    }
  });

  it('shows an empty hint when there are no images', () => {
    render(<WorkScreenshot data={{ variant: 'auto', images: [] }} />);
    expect(screen.getByText('No work screenshots')).toBeInTheDocument();
  });

  it('mosaic style: 4 images use the 4-cell template — no empty 5th cell / wide blank', () => {
    // 回归：MOSAIC_TEMPLATES 索引曾差一，4 张图误用 5 张模板（3×3），
    // 第 5 格无图 → 右下大片空白。修复后应落在 4 张模板（3 列 × 2 行）。
    const { container } = render(
      <WorkScreenshot
        data={{
          style: 'mosaic',
          images: Array.from({ length: 4 }, (_, i) => ({ src: `${i}.jpg` })),
        }}
      />,
    );
    const grid = container.querySelector('[style*="grid-template-columns"]') as HTMLElement;
    expect(grid?.style.gridTemplateRows).toBe('repeat(2, 1fr)');
    expect(screen.getAllByRole('img').length).toBe(4);
  });

  it('mosaicLayout hero-4 (1大3小): 4 imgs → 2 cols × 3 rows, big cell spans 3 rows', () => {
    const { container } = render(
      <WorkScreenshot
        data={{
          style: 'mosaic',
          mosaicLayout: 'hero-4',
          images: Array.from({ length: 4 }, (_, i) => ({ src: `${i}.jpg` })),
        }}
      />,
    );
    const grid = container.querySelector('[style*="grid-template-columns"]') as HTMLElement;
    expect(grid?.style.gridTemplateColumns).toBe('repeat(2, 1fr)');
    expect(grid?.style.gridTemplateRows).toBe('repeat(3, 1fr)');
    expect(screen.getAllByRole('img').length).toBe(4);
    // 大格 gridRow 跨 3 行
    expect(container.querySelector('[style*="span 3"]')).not.toBeNull();
  });

  it('mosaicLayout grid-3x3 (九宫格): 9 imgs → 3 cols × 3 rows', () => {
    const { container } = render(
      <WorkScreenshot
        data={{
          style: 'mosaic',
          mosaicLayout: 'grid-3x3',
          images: Array.from({ length: 9 }, (_, i) => ({ src: `${i}.jpg` })),
        }}
      />,
    );
    const grid = container.querySelector('[style*="grid-template-columns"]') as HTMLElement;
    expect(grid?.style.gridTemplateColumns).toBe('repeat(3, 1fr)');
    expect(grid?.style.gridTemplateRows).toBe('repeat(3, 1fr)');
    expect(screen.getAllByRole('img').length).toBe(9);
  });

  it('mosaicLayout hero-5 truncates extra images to its 5 cells', () => {
    render(
      <WorkScreenshot
        data={{
          style: 'mosaic',
          mosaicLayout: 'hero-5',
          images: Array.from({ length: 6 }, (_, i) => ({ src: `${i}.jpg` })),
        }}
      />,
    );
    // hero-5 只有 5 个 cell，第 6 张被忽略
    expect(screen.getAllByRole('img').length).toBe(5);
  });

  it('mosaicLayout auto (explicit) keeps count-based template for 4 imgs', () => {
    const { container } = render(
      <WorkScreenshot
        data={{
          style: 'mosaic',
          mosaicLayout: 'auto',
          images: Array.from({ length: 4 }, (_, i) => ({ src: `${i}.jpg` })),
        }}
      />,
    );
    const grid = container.querySelector('[style*="grid-template-columns"]') as HTMLElement;
    // auto 4 张 = MOSAIC_TEMPLATES[3]（3 cols × 2 rows 的 L 型），行为不变
    expect(grid?.style.gridTemplateRows).toBe('repeat(2, 1fr)');
    expect(screen.getAllByRole('img').length).toBe(4);
  });

  it('mosaicLayout staggered (错落): 5 imgs → 3 cols, per-column vertical offset, 5 rendered', () => {
    const { container } = render(
      <WorkScreenshot
        data={{
          style: 'mosaic',
          mosaicLayout: 'staggered',
          images: Array.from({ length: 5 }, (_, i) => ({ src: `${i}.jpg` })),
        }}
      />,
    );
    const grid = container.querySelector('[style*="grid-template-columns"]') as HTMLElement;
    expect(grid?.style.gridTemplateColumns).toBe('repeat(3, 1fr)');
    expect(screen.getAllByRole('img').length).toBe(5);
    // staggered 独有：列偏移 translateY
    expect(container.querySelector('[style*="translateY"]')).not.toBeNull();
  });
});

describe('WorkMetrics', () => {
  it('renders title + each metric label and value, value colored by metric.color', () => {
    const data: WorkMetricsData = {
      title: '单作品数据',
      metrics: [
        { label: '播放', value: '1.2M', color: '#FF5C00' },
        { label: '点赞', value: '86K' },
      ],
    };
    render(<WorkMetrics data={data} />);
    expect(screen.getByText('单作品数据')).toBeInTheDocument();
    expect(screen.getByText('播放')).toBeInTheDocument();
    expect(screen.getByText('点赞')).toBeInTheDocument();
    const value = screen.getByText('1.2M');
    expect(value).toBeInTheDocument();
    expect(value).toHaveStyle({ color: '#FF5C00' });
  });

  it('renders cover image and work name when provided', () => {
    render(
      <WorkMetrics
        data={{ workName: '我的作品', cover: 'c.jpg', metrics: [{ label: '播放', value: '1' }] }}
      />,
    );
    expect(screen.getByText('我的作品')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '我的作品' })).toHaveAttribute('src', 'c.jpg');
  });

  it('shows an empty hint when metrics list is empty', () => {
    render(<WorkMetrics data={{ title: '作品数据', metrics: [] }} />);
    expect(screen.getByText('No work data')).toBeInTheDocument();
  });
});

describe('CommentWordcloud', () => {
  it('renders title + each word text', () => {
    render(
      <CommentWordcloud
        data={{
          title: '评论词云',
          words: [
            { text: '种草', weight: 80, sentiment: 'pos' },
            { text: '刺激', weight: 30, sentiment: 'neg' },
          ],
        }}
      />,
    );
    expect(screen.getByText('评论词云')).toBeInTheDocument();
    expect(screen.getByText('种草')).toBeInTheDocument();
    expect(screen.getByText('刺激')).toBeInTheDocument();
  });

  it('colors words by sentiment', () => {
    render(
      <CommentWordcloud
        data={{
          words: [
            { text: '好评', weight: 50, sentiment: 'pos' },
            { text: '差评', weight: 50, sentiment: 'neg' },
            { text: '中性', weight: 50, sentiment: 'neutral' },
          ],
        }}
      />,
    );
    // weight=50 each, total=150, ratio=0.33 < 0.45 → uses SENTIMENT_LIGHT (40% mix)
    expect(screen.getByText('好评')).toHaveStyle({ color: 'color-mix(in srgb, var(--green, #22C55E) 40%, white)' });
    expect(screen.getByText('差评')).toHaveStyle({ color: 'color-mix(in srgb, var(--red, #EF4444) 40%, white)' });
    expect(screen.getByText('中性')).toHaveStyle({ color: 'var(--border-default, #D1D5DB)' });
  });

  it('scales font-size by weight (heavier word is larger than lighter)', () => {
    render(
      <CommentWordcloud
        data={{
          words: [
            { text: '重词', weight: 90, sentiment: 'pos' },
            { text: '轻词', weight: 20, sentiment: 'neutral' },
          ],
        }}
      />,
    );
    const heavyPx = parseInt(screen.getByText('重词').style.fontSize, 10);
    const lightPx = parseInt(screen.getByText('轻词').style.fontSize, 10);
    expect(heavyPx).toBeGreaterThan(lightPx);
  });

  it('shows empty state when there are no words', () => {
    render(<CommentWordcloud data={{ words: [] }} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });
});
