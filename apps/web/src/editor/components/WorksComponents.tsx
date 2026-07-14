/**
 * 业务组件（试点：业绩·商品域）渲染器：作品截图 / 作品数据 / 评论词云。
 * 与 ReportComponents / CreatorComponents 同级（一级 ComponentType），由 REGISTRY 分发。
 * 风格对齐 CreatorComponents.tsx：圆角卡片 + border-border-default + bg-surface-primary。
 */
import type {
  CommentWordcloudData,
  Sentiment,
  WorkMetricsData,
  WorkScreenshotData,
  WorkScreenshotMosaicLayout,
} from '@mediakit/shared';

/* ------------------------------ shared shell ------------------------------ */

/** 卡片外壳：可选标题 + 主体区。 */
function Shell({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col skin-card skin-pad-sm">
      {title && <div className="mb-2 text-sm font-semibold text-foreground-primary">{title}</div>}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

/* ------------------------------ work screenshot ------------------------------ */

/** 单张截图：有 src 渲染图片，无 src 渲染占位；可选底部说明条（支持显隐）。 */
function Screenshot({
  src,
  caption,
  captionHidden,
  cls,
}: {
  src: string;
  caption?: string;
  captionHidden?: boolean;
  cls?: string;
}) {
  return (
    <div className={`relative h-full w-full overflow-hidden rounded-lg ${cls ?? ''}`}>
      {src ? (
        <img src={src} alt={caption ?? 'Work screenshot'} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="flex h-full min-h-[64px] w-full items-center justify-center bg-surface-hover text-[10px] text-foreground-muted">
          Work screenshot
        </div>
      )}
      {caption && !captionHidden && (
        <div className="absolute inset-x-0 bottom-0 truncate bg-black/40 px-1 py-0.5 text-[10px] text-white">
          {caption}
        </div>
      )}
    </div>
  );
}

/** 按图片数量返回最佳列数，确保尽量无空位。
 *  1→1列, 2→2列, 3→3列(单行), 4→2列(2×2), 5→3列(3+2,末张跨2列),
 *  6→3列(3×2), 7→4列(4+3), 8→4列(4×2), 9→3列(3×3), 10→5列, 11→4列, 12→4列(4×3) */
function autoCols(n: number): number {
  const TABLE: Record<number, number> = {
    1: 1, 2: 2, 3: 3, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 3, 10: 5, 11: 4, 12: 4,
  };
  if (TABLE[n]) return TABLE[n];
  return Math.max(2, Math.min(5, Math.round(Math.sqrt(n))));
}

/** 计算每个图片的 grid-column span，让最后一行铺满无空位。
 *  例如 5 张图 3 列：前 3 张各 span 1，第 4 张 span 1，第 5 张 span 2 → 无空位。
 *  7 张图 4 列：前 4 张各 span 1，后 3 张 → span 分别 2,1,1 也不行…
 *  更好的策略：最后一行的图片均分剩余列数。 */
function gridSpans(count: number, cols: number): number[] {
  const rows = Math.ceil(count / cols);
  const lastRowCount = count - (rows - 1) * cols;
  // 最后一行满 → 全部 span 1
  if (lastRowCount === cols || rows === 1) return new Array(count).fill(1);
  // 最后一行不满：让最后一行的图片均分 cols
  const spans = new Array(count).fill(1);
  const lastRowStart = (rows - 1) * cols;
  // 把 cols 分配给 lastRowCount 张图：每张 span = ceil(cols/lastRowCount) 或取整分配
  const base = Math.floor(cols / lastRowCount);
  const extra = cols % lastRowCount;
  for (let j = 0; j < lastRowCount; j++) {
    spans[lastRowStart + j] = base + (j < extra ? 1 : 0);
  }
  return spans;
}

/** 根据图片数量和容器宽高比计算最佳列数和行高比。
 *  核心原则：最后一行不满时，让图片跨列填满，绝不留空位。 */
function smartGrid(count: number): { cols: number; rows: number; rowHeights: string; spans: number[] } {
  const cols = autoCols(count);
  const spans = gridSpans(count, cols);
  const rows = Math.ceil(count / cols);
  return { cols, rows, rowHeights: `repeat(${rows}, 1fr)`, spans };
}

/** 非对称拼图模板：按图片数量定义 grid 单元格排列。
 *  每个 template 定义一个 grid 的列数、行数、以及每张图的单元格坐标。 */
interface MosaicCell { col: number; row: number; colSpan: number; rowSpan: number }
interface MosaicTemplate { gridCols: number; gridRows: number; cells: MosaicCell[] }

const MOSAIC_TEMPLATES: MosaicTemplate[] = [
  // [0]: 1 张 → 全幅
  { gridCols: 1, gridRows: 1, cells: [{ col: 0, row: 0, colSpan: 1, rowSpan: 1 }] },
  // [1]: 2 张 → 1:1 对半
  { gridCols: 2, gridRows: 1, cells: [
    { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
    { col: 1, row: 0, colSpan: 1, rowSpan: 1 },
  ]},
  // [2]: 3 张 → 1大2小（左大右叠）
  { gridCols: 2, gridRows: 2, cells: [
    { col: 0, row: 0, colSpan: 1, rowSpan: 2 }, // 左侧大图
    { col: 1, row: 0, colSpan: 1, rowSpan: 1 }, // 右上
    { col: 1, row: 1, colSpan: 1, rowSpan: 1 }, // 右下
  ]},
  // [3]: 4 张 → L型（左大+右上+右下+底部宽条）
  { gridCols: 3, gridRows: 2, cells: [
    { col: 0, row: 0, colSpan: 2, rowSpan: 1 }, // 左上大
    { col: 2, row: 0, colSpan: 1, rowSpan: 1 }, // 右上
    { col: 2, row: 1, colSpan: 1, rowSpan: 1 }, // 右下
    { col: 0, row: 1, colSpan: 2, rowSpan: 1 }, // 左下宽条
  ]},
  // [4]: 5 张 → 1大2中2小
  { gridCols: 3, gridRows: 3, cells: [
    { col: 0, row: 0, colSpan: 2, rowSpan: 2 }, // 左侧大
    { col: 2, row: 0, colSpan: 1, rowSpan: 1 }, // 右上
    { col: 2, row: 1, colSpan: 1, rowSpan: 1 }, // 右中
    { col: 0, row: 2, colSpan: 1, rowSpan: 1 }, // 左下
    { col: 1, row: 2, colSpan: 2, rowSpan: 1 }, // 右下宽
  ]},
  // [5]: 6 张 → 2大4小（品字型）
  { gridCols: 3, gridRows: 3, cells: [
    { col: 0, row: 0, colSpan: 2, rowSpan: 2 }, // 左大
    { col: 2, row: 0, colSpan: 1, rowSpan: 1 }, // 右上小
    { col: 2, row: 1, colSpan: 1, rowSpan: 1 }, // 右中小
    { col: 0, row: 2, colSpan: 1, rowSpan: 1 }, // 左下小
    { col: 1, row: 2, colSpan: 1, rowSpan: 1 }, // 中下小
    { col: 2, row: 2, colSpan: 1, rowSpan: 1 }, // 右下小
  ]},
  // [6]: 7 张 → 阶梯式
  { gridCols: 4, gridRows: 3, cells: [
    { col: 0, row: 0, colSpan: 2, rowSpan: 2 }, // 左大
    { col: 2, row: 0, colSpan: 1, rowSpan: 1 }, // 右上1
    { col: 3, row: 0, colSpan: 1, rowSpan: 1 }, // 右上2
    { col: 2, row: 1, colSpan: 2, rowSpan: 1 }, // 右中宽
    { col: 0, row: 2, colSpan: 1, rowSpan: 1 }, // 左下
    { col: 1, row: 2, colSpan: 1, rowSpan: 1 }, // 中下
    { col: 2, row: 2, colSpan: 2, rowSpan: 1 }, // 右下宽
  ]},
  // [7]: 8 张 → 1大7小
  { gridCols: 4, gridRows: 3, cells: [
    { col: 0, row: 0, colSpan: 2, rowSpan: 2 }, // 左大
    { col: 2, row: 0, colSpan: 1, rowSpan: 1 },
    { col: 3, row: 0, colSpan: 1, rowSpan: 1 },
    { col: 2, row: 1, colSpan: 1, rowSpan: 1 },
    { col: 3, row: 1, colSpan: 1, rowSpan: 1 },
    { col: 0, row: 2, colSpan: 1, rowSpan: 1 },
    { col: 1, row: 2, colSpan: 1, rowSpan: 1 },
    { col: 2, row: 2, colSpan: 2, rowSpan: 1 }, // 底部宽
  ]},
  // [8]: 9 张 → 1大8小（经典杂志封面）
  { gridCols: 4, gridRows: 3, cells: [
    { col: 0, row: 0, colSpan: 2, rowSpan: 2 }, // 左大
    { col: 2, row: 0, colSpan: 1, rowSpan: 1 },
    { col: 3, row: 0, colSpan: 1, rowSpan: 1 },
    { col: 2, row: 1, colSpan: 1, rowSpan: 1 },
    { col: 3, row: 1, colSpan: 1, rowSpan: 1 },
    { col: 0, row: 2, colSpan: 1, rowSpan: 1 },
    { col: 1, row: 2, colSpan: 1, rowSpan: 1 },
    { col: 2, row: 2, colSpan: 1, rowSpan: 1 },
    { col: 3, row: 2, colSpan: 1, rowSpan: 1 },
  ]},
  // [9+]: 10~12 张 → 1大+N小（更密网格）
  { gridCols: 4, gridRows: 4, cells: [
    { col: 0, row: 0, colSpan: 2, rowSpan: 2 }, // 左大
    { col: 2, row: 0, colSpan: 1, rowSpan: 1 },
    { col: 3, row: 0, colSpan: 1, rowSpan: 1 },
    { col: 2, row: 1, colSpan: 1, rowSpan: 1 },
    { col: 3, row: 1, colSpan: 1, rowSpan: 1 },
    { col: 0, row: 2, colSpan: 1, rowSpan: 1 },
    { col: 1, row: 2, colSpan: 1, rowSpan: 1 },
    { col: 2, row: 2, colSpan: 1, rowSpan: 1 },
    { col: 3, row: 2, colSpan: 1, rowSpan: 1 },
    { col: 0, row: 3, colSpan: 2, rowSpan: 1 }, // 底部宽
    { col: 2, row: 3, colSpan: 1, rowSpan: 1 },
    { col: 3, row: 3, colSpan: 1, rowSpan: 1 },
  ]},
];

/** 命名组合版式：用户在属性面板显式挑选（仅 style==='mosaic' 生效）。
 *  auto / staggered 不走 cell 模板（auto 用 MOSAIC_TEMPLATES；staggered 走偏移渲染）。 */
const MOSAIC_LAYOUTS: Record<Exclude<WorkScreenshotMosaicLayout, 'auto' | 'staggered'>, MosaicTemplate> = {
  // 1大2小（3 张）：左大 1×2 + 右侧 2 张竖排
  'hero-3': { gridCols: 2, gridRows: 2, cells: [
    { col: 0, row: 0, colSpan: 1, rowSpan: 2 },
    { col: 1, row: 0, colSpan: 1, rowSpan: 1 },
    { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
  ]},
  // 1大3小（4 张）：左大 1×3 + 右侧 3 张竖排
  'hero-4': { gridCols: 2, gridRows: 3, cells: [
    { col: 0, row: 0, colSpan: 1, rowSpan: 3 },
    { col: 1, row: 0, colSpan: 1, rowSpan: 1 },
    { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
    { col: 1, row: 2, colSpan: 1, rowSpan: 1 },
  ]},
  // 1大4小（5 张）：左大 2×2（半宽全高）+ 右侧 2×2 小图
  'hero-5': { gridCols: 4, gridRows: 2, cells: [
    { col: 0, row: 0, colSpan: 2, rowSpan: 2 },
    { col: 2, row: 0, colSpan: 1, rowSpan: 1 },
    { col: 3, row: 0, colSpan: 1, rowSpan: 1 },
    { col: 2, row: 1, colSpan: 1, rowSpan: 1 },
    { col: 3, row: 1, colSpan: 1, rowSpan: 1 },
  ]},
  // 九宫格（9 张）：均匀 3×3
  'grid-3x3': { gridCols: 3, gridRows: 3, cells: Array.from({ length: 9 }, (_, i) => ({
    col: i % 3, row: Math.floor(i / 3), colSpan: 1, rowSpan: 1,
  })) },
};

/** 组合版式可选项：属性面板按钮组与渲染分流共用（单一事实源）。minImages 用于按张数禁用。 */
export const MOSAIC_LAYOUT_OPTIONS: { value: WorkScreenshotMosaicLayout; label: string; minImages: number }[] = [
  { value: 'auto', label: '自动', minImages: 1 },
  { value: 'hero-3', label: '1大2小', minImages: 3 },
  { value: 'hero-4', label: '1大3小', minImages: 4 },
  { value: 'hero-5', label: '1大4小', minImages: 5 },
  { value: 'staggered', label: '错落', minImages: 4 },
  { value: 'grid-3x3', label: '九宫格', minImages: 9 },
];

/** 作品截图墙：支持 6 种视觉风格（grid / mosaic / skew / overlap / filmstrip / diagonal）。 */
export function WorkScreenshot({ data }: { data: WorkScreenshotData }) {
  const { style = 'grid', displayCount, title, images: allImages = [], gap = 8 } = data;

  const images = displayCount ? allImages.slice(0, displayCount) : allImages;

  if (images.length === 0) {
    return (
      <Shell title={title}>
        <div className="flex h-full w-full items-center justify-center text-xs text-foreground-muted">
          No work screenshots
        </div>
      </Shell>
    );
  }

  const cols = autoCols(images.length);
  const spans = gridSpans(images.length, cols);

  /* ---- skew: 斜切拼接（交替倾斜 + 按列数排布）---- */
  if (style === 'skew') {
    return (
      <Shell title={title}>
        <div
          className="grid h-full w-full content-center gap-1 overflow-hidden"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {images.map((im, i) => {
            const angle = i % 2 === 0 ? -5 : 5;
            const mt = i % 2 === 0 ? 0 : 6;
            return (
              <div
                key={i}
                className="relative aspect-square overflow-hidden rounded-lg shadow-md"
                style={{ transform: `rotate(${angle}deg)`, marginTop: mt, gridColumn: `span ${spans[i]}` }}
              >
                <Screenshot src={im?.src ?? ''} caption={im?.caption} captionHidden={im?.captionHidden} />
              </div>
            );
          })}
        </div>
      </Shell>
    );
  }

  /* ---- overlap: 重叠堆叠（扇形展开，按列数分行排列）---- */
  if (style === 'overlap') {
    const rows = Math.ceil(images.length / cols);
    return (
      <Shell title={title}>
        <div
          className="grid h-full w-full content-center overflow-hidden"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
        >
          {images.map((im, i) => {
            const colInRow = i % cols;
            const mid = (cols - 1) / 2;
            const offset = (colInRow - mid) * 16;
            const rot = (colInRow - mid) * 4;
            const z = Math.round(cols - Math.abs(colInRow - mid));
            return (
              <div key={i} className="relative flex items-center justify-center" style={{ gridColumn: `span ${spans[i]}` }}>
                <div
                  className="relative h-[70%] w-[80%] overflow-hidden rounded-lg shadow-lg"
                  style={{ transform: `translateX(${offset}px) rotate(${rot}deg)`, zIndex: z }}
                >
                  <Screenshot src={im?.src ?? ''} caption={im?.caption} captionHidden={im?.captionHidden} />
                </div>
              </div>
            );
          })}
        </div>
      </Shell>
    );
  }

  /* ---- filmstrip: 胶片条（按列数横向排列 + 深色背景）---- */
  if (style === 'filmstrip') {
    return (
      <Shell title={title}>
        <div
          className="grid h-full w-full gap-2 overflow-hidden rounded-lg p-2"
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            background: 'color-mix(in srgb, var(--color-neutral-bg, #f5f5f5) 60%, #000 8%)',
          }}
        >
          {images.map((im, i) => (
            <div key={i} className="relative h-full overflow-hidden rounded" style={{ gridColumn: `span ${spans[i]}` }}>
              <Screenshot src={im?.src ?? ''} caption={im?.caption} captionHidden={im?.captionHidden} />
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  /* ---- diagonal: 规整网格 + 行间横向斜切衔接 ---- */
  if (style === 'diagonal') {
    const clipH = 14;
    // diagonal 需要知道每张图的行号，但最后一行 span 扩展后行号不再线性，
    // 所以先计算每张图的起始列+跨列
    let cursor = 0;
    const cells = spans.map((sp, i) => {
      const row = Math.floor(cursor / cols);
      const col = cursor % cols;
      cursor += sp;
      return { row, col, span: sp, idx: i };
    });
    return (
      <Shell title={title}>
        <div
          className="grid h-full w-full overflow-hidden"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '2px' }}
        >
          {images.map((im, i) => {
            const c = cells[i];
            const clipEven = `polygon(0 0, 100% 0, 100% calc(100% - ${clipH}px), 0 100%)`;
            const clipOdd = `polygon(0 ${clipH}px, 100% 0, 100% 100%, 0 100%)`;
            const clipPath = c.row % 2 === 0 ? clipEven : clipOdd;
            const marginTop = c.row > 0 ? -clipH : 0;
            return (
              <div
                key={i}
                className="relative overflow-hidden rounded-md"
                style={{ clipPath, marginTop: `${marginTop}px`, gridColumn: `span ${spans[i]}` }}
              >
                <Screenshot src={im?.src ?? ''} caption={im?.caption} captionHidden={im?.captionHidden} />
              </div>
            );
          })}
        </div>
      </Shell>
    );
  }

  /* ---- mosaic: 非对称拼图（命名组合 / auto 按张数 / staggered 错落）---- */
  if (style === 'mosaic') {
    const layout = data.mosaicLayout ?? 'auto';

    // staggered（错落）：3 列，按列交替竖向偏移、不旋转；取前 6 张。
    if (layout === 'staggered') {
      const shown = images.slice(0, 6);
      const COL_OFFSET = ['0%', '10%', '5%'];
      return (
        <Shell title={title}>
          <div
            className="grid h-full w-full content-stretch gap-2 overflow-hidden"
            style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
          >
            {shown.map((im, i) => (
              <div
                key={i}
                className="relative h-full overflow-hidden rounded-lg"
                style={{ transform: `translateY(${COL_OFFSET[i % 3]})` }}
              >
                <Screenshot src={im?.src ?? ''} caption={im?.caption} captionHidden={im?.captionHidden} />
              </div>
            ))}
          </div>
        </Shell>
      );
    }

    // 命名组合（非 auto）：取对应模板，按 cells 渲染前 N 张（多出忽略，绝不留空位）。
    if (layout !== 'auto') {
      const tpl = MOSAIC_LAYOUTS[layout];
      const shown = images.slice(0, tpl.cells.length);
      return (
        <Shell title={title}>
          <div
            className="grid h-full w-full overflow-hidden"
            style={{
              gridTemplateColumns: `repeat(${tpl.gridCols}, 1fr)`,
              gridTemplateRows: `repeat(${tpl.gridRows}, 1fr)`,
              gap: '4px',
            }}
          >
            {tpl.cells.map((cell, i) => {
              const im = shown[i];
              if (!im) return null;
              return (
                <div
                  key={i}
                  className="relative overflow-hidden rounded-lg"
                  style={{
                    gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
                    gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
                  }}
                >
                  <Screenshot src={im.src} caption={im.caption} captionHidden={im.captionHidden} />
                </div>
              );
            })}
          </div>
        </Shell>
      );
    }

    // auto：模板按张数 1 基存储（MOSAIC_TEMPLATES[i] 容纳 i+1 张图，N 张取下标 N-1）。
    const idx = Math.min(Math.max(images.length - 1, 0), MOSAIC_TEMPLATES.length - 1);
    const tpl = MOSAIC_TEMPLATES[idx];
    const { gridCols, gridRows, cells } = tpl;
    return (
      <Shell title={title}>
        <div
          className="grid h-full w-full overflow-hidden"
          style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gridTemplateRows: `repeat(${gridRows}, 1fr)`, gap: '4px' }}
        >
          {cells.map((cell, i) => {
            const im = images[i];
            if (!im) return null;
            return (
              <div
                key={i}
                className="relative overflow-hidden rounded-lg"
                style={{
                  gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
                  gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
                }}
              >
                <Screenshot src={im.src} caption={im.caption} captionHidden={im.captionHidden} />
              </div>
            );
          })}
        </div>
      </Shell>
    );
  }

  /* ---- grid (default): 智能网格——任意张数都铺满无空位 ---- */
  const grid = smartGrid(images.length);
  return (
    <Shell title={title}>
      <div
        className="h-full w-full"
        style={{
          display: 'grid',
          gap,
          gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
          gridTemplateRows: grid.rowHeights,
        }}
      >
        {images.map((im, i) => (
          <div
            key={i}
            className="bg-surface-hover"
            style={{ gridColumn: `span ${grid.spans[i]}` }}
          >
            <Screenshot src={im?.src ?? ''} caption={im?.caption} captionHidden={im?.captionHidden} />
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* -------------------------------- work metrics ------------------------------- */

export function WorkMetrics({ data }: { data: WorkMetricsData }) {
  const { title, subtitle, cover, workName, metrics = [] } = data;

  if (metrics.length === 0) {
    return (
      <Shell title={title}>
        <div className="flex h-full w-full items-center justify-center text-xs text-foreground-muted">
          No work data
        </div>
      </Shell>
    );
  }

  return (
    <Shell title={title}>
      <div className="flex h-full w-full flex-col gap-3">
        {(cover || workName || subtitle) && (
          <div className="flex items-center gap-3">
            {cover && (
              <img
                src={cover}
                alt={workName ?? 'Work cover'}
                draggable={false}
                className="h-12 w-12 flex-none rounded object-cover"
              />
            )}
            <div className="min-w-0">
              {workName && <div className="truncate text-sm font-semibold text-foreground-primary">{workName}</div>}
              {subtitle && <div className="truncate text-[11px] text-foreground-secondary">{subtitle}</div>}
            </div>
          </div>
        )}
        <div className="grid flex-1 grid-cols-3 gap-2">
          {metrics.map((m, i) => (
            <div key={i} className="flex flex-col justify-center rounded-lg bg-surface-hover/60 px-3 py-2">
              <div className="text-[11px] text-foreground-secondary">{m.label}</div>
              <div
                className="font-data text-lg font-semibold"
                style={m.color ? { color: m.color } : undefined}
              >
                {m.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

/* ------------------------------ comment wordcloud ------------------------------ */

/** 情感 → 基础色。 */
const SENTIMENT_COLOR: Record<Sentiment, string> = {
  pos: 'var(--green, #22C55E)',
  neg: 'var(--red, #EF4444)',
  neutral: 'var(--foreground-muted, #9CA3AF)',
};

/** 情感 → 辅助色（较低权重用浅色调）。 */
const SENTIMENT_LIGHT: Record<Sentiment, string> = {
  pos: 'color-mix(in srgb, var(--green, #22C55E) 40%, white)',
  neg: 'color-mix(in srgb, var(--red, #EF4444) 40%, white)',
  neutral: 'var(--border-default, #D1D5DB)',
};

const WC_MIN_PX = 11;
const WC_MAX_PX = 52;

/** 权重 → 字号（按当前词集 min/max 线性映射）。等权时取中值。 */
function wordFontSize(weight: number, min: number, max: number): number {
  if (max <= min) return Math.round((WC_MIN_PX + WC_MAX_PX) / 2);
  const t = (weight - min) / (max - min);
  // 平方曲线让差异更夸张：低权词更小、高权词更大
  const curved = t * t * 0.6 + t * 0.4;
  return Math.round(WC_MIN_PX + curved * (WC_MAX_PX - WC_MIN_PX));
}

interface PlacedWord {
  text: string;
  sentiment: Sentiment;
  size: number;
  x: number; // 百分比（相对容器）
  y: number;
  rotation: number; // 度
  weight: number;
  weightRatio: number; // 0~1
}

/**
 * 黄金角螺旋布局：最大词放中心，其余按黄金角 (137.5°) 向外散开。
 * 模拟向日葵种子排列，分布均匀且自然聚集在中心。
 */
function spiralLayout(
  words: { text: string; weight: number; sentiment: Sentiment }[],
  min: number,
  max: number,
): PlacedWord[] {
  const sorted = [...words].sort((a, b) => b.weight - a.weight);
  const span = max - min || 1;
  const GOLDEN = 137.508;
  const placed: PlacedWord[] = [];

  // 螺旋半径系数：随词数自适应，让词铺满 ~80% 区域
  const radiusStep = 14 / Math.sqrt(Math.max(sorted.length, 1));

  for (let i = 0; i < sorted.length; i++) {
    const w = sorted[i];
    const weightRatio = (w.weight - min) / span;
    const size = wordFontSize(w.weight, min, max);

    if (i === 0) {
      // 最大词放正中心
      placed.push({
        text: w.text,
        sentiment: w.sentiment,
        size,
        x: 50,
        y: 50,
        rotation: 0,
        weight: w.weight,
        weightRatio,
      });
      continue;
    }

    const angle = i * GOLDEN;
    const radius = Math.sqrt(i) * radiusStep;
    const x = 50 + radius * Math.cos((angle * Math.PI) / 180);
    const y = 50 + radius * Math.sin((angle * Math.PI) / 180) * 0.72; // 椭圆压缩（容器通常宽>高）

    // 旋转策略：高权重不旋转（可读性优先）；中低权交替 ±90° / 0°
    let rotation = 0;
    if (weightRatio < 0.55) {
      rotation = i % 3 === 0 ? -90 : i % 3 === 1 ? 0 : 90;
    } else if (weightRatio < 0.8 && i % 4 === 0) {
      rotation = -90;
    }

    placed.push({
      text: w.text,
      sentiment: w.sentiment,
      size,
      x,
      y,
      rotation,
      weight: w.weight,
      weightRatio,
    });
  }

  return placed;
}

/** 评论词云：黄金角螺旋布局，中心大词 → 向外散开，字号差异夸张，颜色按情感+权重深浅。 */
export function CommentWordcloud({ data }: { data: CommentWordcloudData }) {
  const { title, subtitle, words = [] } = data;

  if (words.length === 0) {
    return (
      <Shell title={title}>
        <div className="flex h-full w-full items-center justify-center text-xs text-foreground-muted">No data</div>
      </Shell>
    );
  }

  const weights = words.map((w) => w.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);

  const placed = spiralLayout(words, min, max);

  return (
    <Shell title={title}>
      <div className="relative h-full w-full overflow-hidden">
        {subtitle && <div className="mb-1 text-[11px] text-foreground-secondary">{subtitle}</div>}
        {placed.map((w, i) => {
          // 高权重用深色 + 加粗；低权用浅色 + 常规
          const color = w.weightRatio > 0.45 ? SENTIMENT_COLOR[w.sentiment] : SENTIMENT_LIGHT[w.sentiment];
          const fontWeight = w.weightRatio > 0.7 ? 800 : w.weightRatio > 0.4 ? 600 : 400;
          return (
            <span
              key={i}
              className="absolute select-none whitespace-nowrap"
              style={{
                left: `${w.x}%`,
                top: `${w.y}%`,
                transform: `translate(-50%, -50%) rotate(${w.rotation}deg)`,
                fontSize: w.size,
                fontWeight,
                color,
                lineHeight: 1.1,
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </Shell>
  );
}
