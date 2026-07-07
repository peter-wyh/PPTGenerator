import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkScreenshot, WorkMetrics, CommentWordcloud } from '@/editor/components/WorksComponents';
import type { WorkScreenshotData, WorkMetricsData } from '@mediakit/shared';

describe('WorkScreenshot', () => {
  it('renders the title and a placeholder tile for each image lacking src', () => {
    const data: WorkScreenshotData = {
      variant: 'grid',
      title: '代表作',
      images: [{ src: '' }, { src: '' }],
    };
    render(<WorkScreenshot data={data} />);
    expect(screen.getByText('代表作')).toBeInTheDocument();
    // 每张缺 src 的图各渲染一个占位
    expect(screen.getAllByText('作品截图').length).toBe(2);
  });

  it('renders provided screenshot images', () => {
    const data: WorkScreenshotData = {
      variant: 'grid',
      images: [{ src: 'a.jpg' }, { src: 'b.jpg' }],
    };
    render(<WorkScreenshot data={data} />);
    const imgs = screen.getAllByRole('img');
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual(['a.jpg', 'b.jpg']);
  });

  it('every variant renders the images without throwing', () => {
    for (const v of ['grid', 'masonry', 'hero', 'skew'] as const) {
      const { unmount } = render(
        <WorkScreenshot data={{ variant: v, images: [{ src: 'x.jpg' }, { src: 'y.jpg' }] }} />,
      );
      expect(screen.getAllByRole('img').length).toBeGreaterThanOrEqual(1);
      unmount();
    }
  });

  it('shows an empty hint when there are no images', () => {
    render(<WorkScreenshot data={{ variant: 'grid', images: [] }} />);
    expect(screen.getByText('暂无作品截图')).toBeInTheDocument();
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
    expect(screen.getByText('暂无作品数据')).toBeInTheDocument();
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
    expect(screen.getByText('好评')).toHaveStyle({ color: '#22C55E' });
    expect(screen.getByText('差评')).toHaveStyle({ color: '#EF4444' });
    expect(screen.getByText('中性')).toHaveStyle({ color: '#9CA3AF' });
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
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });
});
