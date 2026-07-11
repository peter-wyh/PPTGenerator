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
} from '@mediakit/shared';
import { resolveLayout, buildGridStyle, cellStyle } from './ImageGroupComponent';

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
        <img src={src} alt={caption ?? '作品截图'} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="flex h-full min-h-[64px] w-full items-center justify-center bg-surface-hover text-[10px] text-foreground-muted">
          作品截图
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

/** 作品截图墙：支持 4 种视觉风格（grid / skew / overlap / filmstrip）。 */
export function WorkScreenshot({ data }: { data: WorkScreenshotData }) {
  const { variant, style = 'grid', title, images = [], gap = 8 } = data;

  if (images.length === 0) {
    return (
      <Shell title={title}>
        <div className="flex h-full w-full items-center justify-center text-xs text-foreground-muted">
          暂无作品截图
        </div>
      </Shell>
    );
  }

  /* ---- skew: 斜切拼接（交替倾斜 + 重叠）---- */
  if (style === 'skew') {
    return (
      <Shell title={title}>
        <div className="flex h-full w-full flex-wrap items-center justify-center gap-1 overflow-hidden">
          {images.map((im, i) => {
            const angle = i % 2 === 0 ? -6 : 6;
            const mt = i % 2 === 0 ? 0 : 8;
            return (
              <div
                key={i}
                className="relative h-[42%] w-[46%] shrink-0 overflow-hidden rounded-lg shadow-md"
                style={{ transform: `rotate(${angle}deg)`, marginTop: mt }}
              >
                <Screenshot src={im?.src ?? ''} caption={im?.caption} captionHidden={im?.captionHidden} />
              </div>
            );
          })}
        </div>
      </Shell>
    );
  }

  /* ---- overlap: 重叠堆叠（扇形展开）---- */
  if (style === 'overlap') {
    const count = images.length;
    return (
      <Shell title={title}>
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
          {images.map((im, i) => {
            const offset = (i - (count - 1) / 2) * 28;
            const rot = (i - (count - 1) / 2) * 5;
            const z = count - Math.abs(i - (count - 1) / 2);
            return (
              <div
                key={i}
                className="absolute h-[60%] w-[44%] overflow-hidden rounded-lg shadow-lg"
                style={{
                  transform: `translateX(${offset}px) rotate(${rot}deg)`,
                  zIndex: z,
                }}
              >
                <Screenshot src={im?.src ?? ''} caption={im?.caption} captionHidden={im?.captionHidden} />
              </div>
            );
          })}
        </div>
      </Shell>
    );
  }

  /* ---- filmstrip: 胶片条（横向滚动 + 胶片穿孔装饰）---- */
  if (style === 'filmstrip') {
    return (
      <Shell title={title}>
        <div
          className="flex h-full w-full gap-2 overflow-hidden rounded-lg p-2"
          style={{
            background: 'color-mix(in srgb, var(--color-neutral-bg, #f5f5f5) 60%, #000 8%)',
          }}
        >
          {images.map((im, i) => (
            <div key={i} className="relative h-full w-[38%] shrink-0 overflow-hidden rounded">
              <Screenshot src={im?.src ?? ''} caption={im?.caption} captionHidden={im?.captionHidden} />
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  /* ---- diagonal: 规整网格 + 行间横向斜切衔接 ---- */
  if (style === 'diagonal') {
    // 按图片数自适应列数，尽量让网格平整
    const cols = images.length <= 3 ? images.length : images.length <= 6 ? 3 : 4;
    const rows = Math.ceil(images.length / cols);
    const cellGap = 2; // 斜切效果需要小间距
    return (
      <Shell title={title}>
        <div
          className="grid h-full w-full overflow-hidden"
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: `${cellGap}px`,
            // 每行用 clip-path 斜切：让行与行的衔接处形成锯齿状横向斜线
          }}
        >
          {images.map((im, i) => {
            const row = Math.floor(i / cols);
            // 偶数行 clip 上左下右，奇数行反方向，形成行间斜切衔接
            const clipEven =
              'polygon(0 0, 100% 0, 100% calc(100% - 14px), 0 100%)';
            const clipOdd =
              'polygon(0 14px, 100% 0, 100% 100%, 0 100%)';
            const clipPath = row % 2 === 0 ? clipEven : clipOdd;
            // 斜切行向上偏移 14px 以补偿 clip 空白，让图片紧密衔接
            const marginTop = row > 0 ? -14 : 0;
            return (
              <div
                key={i}
                className="relative overflow-hidden rounded-md"
                style={{ clipPath, marginTop: `${marginTop}px` }}
              >
                <Screenshot src={im?.src ?? ''} caption={im?.caption} captionHidden={im?.captionHidden} />
              </div>
            );
          })}
          {/* 如果最后一行不满，补满网格占位 */}
          {Array.from({ length: rows * cols - images.length }).map((_, i) => (
            <div
              key={`pad-${i}`}
              className="relative overflow-hidden rounded-md bg-surface-hover"
              style={{
                clipPath:
                  (rows - 1) % 2 === 0
                    ? 'polygon(0 0, 100% 0, 100% calc(100% - 14px), 0 100%)'
                    : 'polygon(0 14px, 100% 0, 100% 100%, 0 100%)',
                marginTop: rows > 1 ? -14 : 0,
              }}
            />
          ))}
        </div>
      </Shell>
    );
  }

  /* ---- grid (default): 标准网格马赛克 ---- */
  const layout = resolveLayout(variant, images.length);
  return (
    <Shell title={title}>
      <div className="h-full w-full" style={buildGridStyle(layout, gap)}>
        {layout.cells.map((cell, i) => {
          const im = images[i];
          return (
            <div key={i} style={cellStyle(cell)} className="bg-surface-hover">
              <Screenshot src={im?.src ?? ''} caption={im?.caption} captionHidden={im?.captionHidden} />
            </div>
          );
        })}
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
          暂无作品数据
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
                alt={workName ?? '作品封面'}
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
  pos: '#22C55E',
  neg: '#EF4444',
  neutral: '#9CA3AF',
};

/** 情感 → 辅助色（较低权重用浅色调）。 */
const SENTIMENT_LIGHT: Record<Sentiment, string> = {
  pos: '#86EFAC',
  neg: '#FCA5A5',
  neutral: '#D1D5DB',
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
        <div className="flex h-full w-full items-center justify-center text-xs text-foreground-muted">暂无数据</div>
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
