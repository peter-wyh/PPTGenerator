import type { ComponentType, EditorComponent, Page } from '@mediakit/shared';
import { resolvePageBackground } from '../background';

/** demo 的缩略图配色：按组件类型映射。 */
const TYPE_COLOR: Partial<Record<ComponentType, string>> = {
  'indicator-card': '#FFF7F0',
  text: '#F9FAFB',
  'bar-chart': '#E8F0FE',
  table: '#F0FDF4',
};

interface Props {
  page: Page;
  canvasWidth: number;
  canvasHeight: number;
  width?: number;
  height?: number;
}

/**
 * 页面缩略图：把组件按比例缩放进固定盒子，每个组件渲染为一个彩色色块，
 * 盒子底色反映页面背景。忠实 demo.renderPageThumbPreview 的做法。
 */
export function PageThumbnail({ page, canvasWidth, canvasHeight, width = 184, height = 56 }: Props) {
  const scale = Math.min(width / canvasWidth, height / canvasHeight);
  const innerW = canvasWidth * scale;
  const innerH = canvasHeight * scale;
  const offX = (width - innerW) / 2;
  const offY = (height - innerH) / 2;

  return (
    <div className="relative rounded border border-border-subtle bg-surface-primary" style={{ width, height }}>
      <div className="absolute" style={{ left: offX, top: offY, width: innerW, height: innerH, background: resolvePageBackground(page) }}>
        {page.components.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-foreground-muted">空白页</div>
        ) : (
          page.components.map((c: EditorComponent) => (
            <div
              key={c.id}
              className="absolute rounded-[1px]"
              style={{
                left: c.x * scale,
                top: c.y * scale,
                width: Math.max(1, c.w * scale),
                height: Math.max(1, c.h * scale),
                background: TYPE_COLOR[c.type] ?? '#F3F4F6',
                border: '1px solid rgba(0,0,0,0.04)',
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
