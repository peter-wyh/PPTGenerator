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
  WorkScreenshotItem,
} from '@mediakit/shared';

/* ------------------------------ shared shell ------------------------------ */

/** 卡片外壳：可选标题 + 主体区。 */
function Shell({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col rounded-xl border border-border-default bg-surface-primary p-3">
      {title && <div className="mb-2 text-sm font-semibold text-foreground-primary">{title}</div>}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

/* ------------------------------ work screenshot ------------------------------ */

/** 单张截图：有 src 渲染图片，无 src 渲染占位；可选底部说明条。 */
function Screenshot({ src, caption, cls }: { src: string; caption?: string; cls?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-lg ${cls ?? ''}`}>
      {src ? (
        <img src={src} alt={caption ?? '作品截图'} draggable={false} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full min-h-[64px] w-full items-center justify-center bg-surface-hover text-[10px] text-foreground-muted">
          作品截图
        </div>
      )}
      {caption && (
        <div className="absolute inset-x-0 bottom-0 truncate bg-black/40 px-1 py-0.5 text-[10px] text-white">
          {caption}
        </div>
      )}
    </div>
  );
}

/** 作品截图墙：4 种组图版式，由 data.variant 切换；缺省 'grid'。 */
export function WorkScreenshot({ data }: { data: WorkScreenshotData }) {
  const { variant = 'grid', title, images = [] } = data;

  if (images.length === 0) {
    return (
      <Shell title={title}>
        <div className="flex h-full w-full items-center justify-center text-xs text-foreground-muted">
          暂无作品截图
        </div>
      </Shell>
    );
  }
  if (variant === 'masonry') return <MasonryGallery title={title} images={images} />;
  if (variant === 'hero') return <HeroGallery title={title} images={images} />;
  if (variant === 'skew') return <SkewGallery title={title} images={images} />;
  return <GridGallery title={title} images={images} />;
}

function GridGallery({ title, images }: { title?: string; images: WorkScreenshotItem[] }) {
  return (
    <Shell title={title}>
      <div className="grid h-full w-full grid-cols-3 gap-2">
        {images.map((im, i) => (
          <Screenshot key={i} src={im.src} caption={im.caption} cls="aspect-square w-full" />
        ))}
      </div>
    </Shell>
  );
}

function MasonryGallery({ title, images }: { title?: string; images: WorkScreenshotItem[] }) {
  return (
    <Shell title={title}>
      <div className="h-full w-full columns-3 gap-2">
        {images.map((im, i) => (
          <div key={i} className="mb-2 break-inside-avoid">
            <Screenshot src={im.src} caption={im.caption} cls="aspect-[4/5] w-full" />
          </div>
        ))}
      </div>
    </Shell>
  );
}

function HeroGallery({ title, images }: { title?: string; images: WorkScreenshotItem[] }) {
  const [main, ...rest] = images;
  return (
    <Shell title={title}>
      <div className="flex h-full w-full flex-col gap-2">
        <div className="min-h-0 flex-1">
          <Screenshot src={main.src} caption={main.caption} />
        </div>
        {rest.length > 0 && (
          <div className="flex flex-none gap-2 overflow-x-auto">
            {rest.map((im, i) => (
              <Screenshot key={i} src={im.src} caption={im.caption} cls="h-16 w-16 flex-none" />
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

function SkewGallery({ title, images }: { title?: string; images: WorkScreenshotItem[] }) {
  return (
    <Shell title={title}>
      <div className="grid h-full w-full content-center grid-cols-3 gap-3 p-2">
        {images.map((im, i) => (
          <div
            key={i}
            className="aspect-square w-full shadow-md"
            style={{ transform: `rotate(${i % 2 === 0 ? -3 : 3}deg)` }}
          >
            <Screenshot src={im.src} caption={im.caption} />
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

/** 情感 → 颜色。 */
const SENTIMENT_COLOR: Record<Sentiment, string> = {
  pos: '#22C55E',
  neg: '#EF4444',
  neutral: '#9CA3AF',
};

const WC_MIN_PX = 12;
const WC_MAX_PX = 40;

/** 权重 → 字号（按当前词集 min/max 线性映射，clamp 到 12–40px）。等权时取中值。 */
function wordFontSize(weight: number, min: number, max: number): number {
  if (max <= min) return Math.round((WC_MIN_PX + WC_MAX_PX) / 2);
  const t = (weight - min) / (max - min);
  return Math.round(WC_MIN_PX + t * (WC_MAX_PX - WC_MIN_PX));
}

/** 评论词云：弹性流排版，字号 ∝ 权重，颜色按情感。 */
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
  const span = max - min || 1;

  return (
    <Shell title={title}>
      <div className="flex h-full w-full flex-col">
        {subtitle && <div className="mb-1 text-[11px] text-foreground-secondary">{subtitle}</div>}
        <div className="flex min-h-0 flex-1 flex-wrap items-center justify-center gap-x-3 gap-y-1 overflow-auto">
          {words.map((w, i) => {
            const size = wordFontSize(w.weight, min, max);
            const opacity = 0.7 + 0.3 * ((w.weight - min) / span);
            return (
              <span
                key={i}
                className="font-semibold leading-relaxed"
                style={{ fontSize: size, color: SENTIMENT_COLOR[w.sentiment], opacity }}
              >
                {w.text}
              </span>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}
