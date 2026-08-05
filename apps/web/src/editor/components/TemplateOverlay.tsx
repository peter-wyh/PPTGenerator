import { useMemo, useState } from 'react';
import type { Page } from '@mediakit/shared';
import { filterCategoriesByScenario, getTemplate, isSinglePageTemplate, type Template } from '../templates';
import { useEditorStore } from '../store';
import { PageThumbnail } from './PageThumbnail';

interface Props {
  onApply: (template: Template) => void;
  onClose: () => void;
}

/** 把模板的 components() 渲染成可用的 Page 形状（仅用于 PageThumbnail 预览，不落库）。 */
function useTemplateThumbPage(tpl: Template) {
  return useMemo<Page>(() => {
    // 模板 components() 返回的是 EditorComponent[]，id 为占位符（仅预览，不落库，不会被选中/保存）。
    return { id: `tpl-${tpl.id}`, name: tpl.name, components: tpl.components() };
  }, [tpl]);
}

/** 单个模板卡片：名称 + 缩略图 + 描述 + 预览按钮。 */
function TemplateCard({
  tpl,
  canvasWidth,
  canvasHeight,
  onApply,
  onPreview,
}: {
  tpl: Template;
  canvasWidth: number;
  canvasHeight: number;
  onApply: (tpl: Template) => void;
  onPreview: (tpl: Template) => void;
}) {
  const thumb = useTemplateThumbPage(tpl);
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border-default p-2 transition hover:border-accent-primary hover:bg-surface-hover">
      {/* 缩略图：按画布宽高比展示，最大高度 84px。 */}
      <div className="flex justify-center">
        <PageThumbnail
          page={thumb}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          width={Math.min(220, canvasWidth)}
          height={84}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-sm skin-fw-body text-foreground-primary">{tpl.name}</span>
        {isSinglePageTemplate(tpl) ? (
          <span className="rounded bg-accent-primary/10 px-1.5 py-0.5 text-[10px] skin-fw-body text-accent-primary">单页</span>
        ) : (
          <span className="rounded bg-surface-secondary px-1.5 py-0.5 text-[10px] skin-fw-body text-foreground-secondary">多页</span>
        )}
      </div>
      <div className="text-xs text-foreground-muted">{tpl.description}</div>
      <div className="mt-1 flex gap-1.5">
        <button
          onClick={() => onPreview(tpl)}
          className="flex-1 rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
        >
          👁 预览
        </button>
        <button
          onClick={() => onApply(tpl)}
          className="flex-1 rounded bg-accent-primary px-2 py-1 text-xs skin-fw-body text-white hover:bg-accent-primary/90"
        >
          应用
        </button>
      </div>
    </div>
  );
}

/** 全屏预览弹窗：以实际画布尺寸渲染模板。 */
function TemplatePreviewModal({
  tpl,
  canvasWidth,
  canvasHeight,
  onApply,
  onClose,
}: {
  tpl: Template;
  canvasWidth: number;
  canvasHeight: number;
  onApply: (tpl: Template) => void;
  onClose: () => void;
}) {
  const page = useTemplateThumbPage(tpl);
  // 计算预览缩放：最大宽度 900px，等比缩放
  const maxW = 900;
  const scale = Math.min(1, maxW / canvasWidth);
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-surface-primary p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* 标题栏 */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="font-headings text-lg skin-fw-heading text-foreground-primary">{tpl.name}</div>
            <div className="text-xs text-foreground-muted">{tpl.description}</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-foreground-secondary hover:bg-surface-hover"
          >
            ✕
          </button>
        </div>

        {/* 预览区域 */}
        <div className="flex-1 overflow-auto rounded-lg bg-surface-secondary p-4">
          <div
            style={{
              width: canvasWidth,
              height: canvasHeight,
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
            }}
            className="mx-auto"
          >
            <PageThumbnail
              page={page}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              width={canvasWidth}
              height={canvasHeight}
            />
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="mt-3 flex justify-end skin-gap-sm">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-1.5 text-sm text-foreground-secondary hover:bg-surface-hover"
          >
            返回
          </button>
          <button
            onClick={() => onApply(tpl)}
            className="rounded-lg bg-accent-primary px-4 py-1.5 text-sm skin-fw-body text-white hover:bg-accent-primary/90"
          >
            应用此模板
          </button>
        </div>
      </div>
    </div>
  );
}

/** 新建页面时的模板浮层：按分类分组陈列（含缩略图），内容区纵向滚动。 */
export function TemplateOverlay({ onApply, onClose }: Props) {
  const scenario = useEditorStore((s) => s.projectMeta?.scenario);
  const canvasWidth = useEditorStore((s) => s.canvasWidth);
  const canvasHeight = useEditorStore((s) => s.canvasHeight);
  const [previewTpl, setPreviewTpl] = useState<Template | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-surface-primary p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex-none">
          <div className="font-headings text-lg skin-fw-heading text-foreground-primary">新建页面</div>
          <p className="mb-4 text-sm text-foreground-secondary">选择一个模板开始</p>
        </div>

        <div className="-mr-2 flex-1 overflow-y-auto pr-2">
          {filterCategoriesByScenario(scenario).map((cat) => {
            const templates = cat.ids.map((id) => getTemplate(id)).filter((t): t is Template => !!t);
            if (templates.length === 0) return null;
            return (
              <section key={cat.category} className="mb-4">
                <div className="mb-2 text-[11px] skin-fw-heading uppercase tracking-wide text-foreground-muted">
                  {cat.category}
                </div>
                <div className="grid grid-cols-2 skin-gap-md">
                  {templates.map((tpl) => (
                    <TemplateCard
                      key={tpl.id}
                      tpl={tpl}
                      canvasWidth={canvasWidth}
                      canvasHeight={canvasHeight}
                      onApply={onApply}
                      onPreview={setPreviewTpl}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <div className="mt-2 flex flex-none justify-end border-t border-border-subtle pt-3">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-foreground-secondary hover:bg-surface-hover">
            取消
          </button>
        </div>
      </div>

      {previewTpl && (
        <TemplatePreviewModal
          tpl={previewTpl}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          onApply={onApply}
          onClose={() => setPreviewTpl(null)}
        />
      )}
    </div>
  );
}
