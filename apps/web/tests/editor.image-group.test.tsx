import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { resolveLayout, ImageGroupComponent } from '@/editor/components/ImageGroupComponent';
import type { ImageGroupData } from '@mediakit/shared';

/* image-group 无图表，无需 mock recharts。按 [[web-chart-test-convention]] 断言 shell 文本。 */

describe('resolveLayout', () => {
  it('auto 按数量映射到最接近版式', () => {
    expect(resolveLayout('auto', 2).id).toBe('duo');
    expect(resolveLayout('auto', 3).id).toBe('trio');
    expect(resolveLayout('auto', 4).id).toBe('quad');
    expect(resolveLayout('auto', 5).id).toBe('mosaic-5');
    expect(resolveLayout('auto', 6).id).toBe('hex');
    expect(resolveLayout('auto', 7).id).toBe('septet');
    expect(resolveLayout('auto', 9).id).toBe('nona');
    expect(resolveLayout('auto', 12).id).toBe('duoza');
  });

  it('auto 平手取较大版式；超出范围落到最大', () => {
    expect(resolveLayout('auto', 8).id).toBe('nona'); // 7 与 9 等距 → 取 9
    expect(resolveLayout('auto', 10).id).toBe('nona'); // 离 9 比 12 近
    expect(resolveLayout('auto', 11).id).toBe('duoza'); // 离 12 比 9 近
    expect(resolveLayout('auto', 13).id).toBe('duoza'); // >12 → 最大
    expect(resolveLayout('auto', 1).id).toBe('duo'); // <2 → 最小
  });

  it('auto 缺省（undefined）等同 auto', () => {
    expect(resolveLayout(undefined, 6).id).toBe('hex');
  });

  it('锁定版式忽略数量，始终返回该版式', () => {
    expect(resolveLayout('trio', 5).id).toBe('trio');
    expect(resolveLayout('septet', 2).id).toBe('septet');
  });

  it('每个版式的槽位数 = 其张数', () => {
    const expects: Record<string, number> = {
      duo: 2, trio: 3, quad: 4, 'mosaic-5': 5, hex: 6, septet: 7, nona: 9, duoza: 12,
    };
    for (const [id, count] of Object.entries(expects)) {
      expect(resolveLayout(id as never, count).cells.length).toBe(count);
    }
  });
});

describe('ImageGroupComponent 渲染', () => {
  it('无图片 → 整块占位「组图」', () => {
    render(<ImageGroupComponent data={{ images: [] } as ImageGroupData} />);
    expect(screen.getByText('组图')).toBeInTheDocument();
    expect(screen.queryByText('图片')).not.toBeInTheDocument();
  });

  it('auto + 3 张空图 → trio 版式，3 个「图片」占位', () => {
    render(
      <ImageGroupComponent
        data={{ variant: 'auto', images: [{ src: '' }, { src: '' }, { src: '' }] }}
      />,
    );
    expect(screen.getAllByText('图片')).toHaveLength(3);
  });

  it('锁定 trio + 5 张图 → 仍 3 个槽位（溢出忽略）', () => {
    const images = Array.from({ length: 5 }, () => ({ src: '' }));
    render(<ImageGroupComponent data={{ variant: 'trio', images }} />);
    expect(screen.getAllByText('图片')).toHaveLength(3);
  });

  it('锁定 quad + 2 张图 → 4 个槽位（不足补空占位）', () => {
    render(
      <ImageGroupComponent
        data={{ variant: 'quad', images: [{ src: '' }, { src: '' }] }}
      />,
    );
    expect(screen.getAllByText('图片')).toHaveLength(4);
  });

  it('有真实 src 的格子渲染 <img>，空槽仍占位', () => {
    const { container } = render(
      <ImageGroupComponent
        data={{ variant: 'duo', images: [{ src: 'https://example.com/a.png' }] }}
      />,
    );
    // alt="" 的装饰性图片 role 为 none，故直接查 <img> 元素。
    expect(container.querySelector('img')).not.toBeNull();
    expect(screen.getAllByText('图片')).toHaveLength(1); // 另一格为空槽
  });
});
