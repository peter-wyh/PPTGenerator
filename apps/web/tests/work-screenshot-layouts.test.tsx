import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  WorkScreenshot,
  MOSAIC_LAYOUT_OPTIONS,
  MOSAIC_LAYOUTS,
  type MosaicTemplate,
} from '@/editor/components/WorksComponents';

/** 2026-08-04 新增的 8 个非对称版式：[id, 张数(=minImages)]。 */
const NEW_LAYOUTS = [
  ['hero-top', 4],
  ['hero-right', 4],
  ['pz-top', 3],
  ['pz-bottom', 3],
  ['hero-2up', 5],
  ['magazine', 5],
  ['strip-h', 3],
  ['split-half', 2],
] as const;

/** 模板是否完全铺满网格（既无空位也无重叠，所有 cell 在界内）。 */
function fullyCovered(t: MosaicTemplate): boolean {
  const occ: boolean[][] = Array.from({ length: t.gridRows }, () => Array(t.gridCols).fill(false));
  for (const c of t.cells) {
    for (let r = c.row; r < c.row + c.rowSpan; r++) {
      for (let col = c.col; col < c.col + c.colSpan; col++) {
        if (r < 0 || r >= t.gridRows || col < 0 || col >= t.gridCols) return false; // 越界
        if (occ[r][col]) return false; // 重叠
        occ[r][col] = true;
      }
    }
  }
  return occ.every((row) => row.every(Boolean)); // 无空位
}

describe('work-screenshot 新增版式预设 (2026-08-04)', () => {
  it('MOSAIC_LAYOUT_OPTIONS 含 8 个新版式，且 minImages = 各自张数', () => {
    const values = MOSAIC_LAYOUT_OPTIONS.map((o) => o.value);
    for (const [id, n] of NEW_LAYOUTS) {
      expect(values, `${id} 应在选项里`).toContain(id);
      const opt = MOSAIC_LAYOUT_OPTIONS.find((o) => o.value === id)!;
      expect(opt.minImages, `${id} minImages 应为 ${n}`).toBe(n);
    }
  });

  it('每个新模板完全铺满网格（无空位 / 无重叠 / 不越界）', () => {
    for (const [id, n] of NEW_LAYOUTS) {
      const t = MOSAIC_LAYOUTS[id as Exclude<keyof typeof MOSAIC_LAYOUTS, symbol>];
      expect(t, `模板 ${id} 应存在`).toBeDefined();
      expect(t.cells.length, `${id} 应有 ${n} 个 cell`).toBe(n);
      expect(fullyCovered(t), `${id} 应完全铺满`).toBe(true);
    }
  });

  it('WorkScreenshot 按每个新模板渲染对应张数的图位', () => {
    for (const [id, n] of NEW_LAYOUTS) {
      const images = Array.from({ length: n }, () => ({ src: 'x' }));
      const { container } = render(
        <WorkScreenshot
          data={{ style: 'mosaic', mosaicLayout: id as never, images }}
        />,
      );
      const imgs = container.querySelectorAll('img');
      expect(imgs.length, `${id} 应渲染 ${n} 个图位`).toBe(n);
    }
  });
});
