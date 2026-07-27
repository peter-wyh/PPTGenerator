import type { Page } from '@mediakit/shared';
import { ComponentRenderer } from '../components/ComponentRenderer';
import { resolvePageBackground } from '../background';
import { useEditorStore } from '../store';
import { BUSINESS_LINE_META } from '@/projectsMeta';

/**
 * 只读单页渲染（M6 预览 / 分享页 / PDF 共用）。
 * 复用 REGISTRY 真实组件，但用独立精简定位壳（无手柄/hover/选中），
 * 不污染 CanvasComponent 的编辑交互。
 *
 * 渲染策略：内层用原始画布尺寸定位组件，外层 transform: scale() 整体缩放，
 * 字体/边框按比例缩放，比逐组件 x*scale 更准确。
 * 图表数据直接来自 comp.data（导入/手动编辑都写入 comp.data，预览/分享/PDF 同源）。
 */
interface Props {
  page: Page;
  canvasWidth: number;
  canvasHeight: number;
  scale: number;
}

export function PageView({ page, canvasWidth, canvasHeight, scale }: Props) {
  const sorted = [...page.components].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  // 背景与编辑器 Canvas 一致：统一走 resolvePageBackground（图 > 渐变 > 纯色 > 白）。
  const background = resolvePageBackground(page);

  // 业务线 Logo（与编辑器 Canvas 同步渲染，右上角）
  const businessLine = useEditorStore((s) => s.projectMeta?.businessLine);
  const blLogo = businessLine ? BUSINESS_LINE_META[businessLine]?.logo : undefined;

  return (
    <div
      style={{
        position: 'relative',
        width: canvasWidth * scale,
        height: canvasHeight * scale,
        overflow: 'hidden',
        background,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: canvasWidth,
          height: canvasHeight,
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
        }}
      >
        {sorted.map((comp) => (
          <div
            key={comp.id}
            style={{ position: 'absolute', left: comp.x, top: comp.y, width: comp.w, height: comp.h }}
          >
            <ComponentRenderer comp={comp} />
          </div>
        ))}
        {/* 业务线 Logo（右上角，预览/导出同步） */}
        {blLogo && !page.suppressLogo && (
          <img
            src={blLogo}
            alt={BUSINESS_LINE_META[businessLine!]?.name ?? ''}
            style={{
              position: 'absolute',
              right: 24,
              top: 24,
              width: 40,
              height: 40,
              objectFit: 'contain',
              opacity: 0.8,
              pointerEvents: 'none',
              zIndex: 50,
              borderRadius: 8,
            }}
            draggable={false}
          />
        )}
      </div>
    </div>
  );
}

/** 计算缩放：把画布适配进给定视口（contain）。 */
export function fitScale(canvasWidth: number, canvasHeight: number, viewportW: number, viewportH: number): number {
  if (canvasWidth <= 0 || canvasHeight <= 0) return 1;
  return Math.min(viewportW / canvasWidth, viewportH / canvasHeight);
}
