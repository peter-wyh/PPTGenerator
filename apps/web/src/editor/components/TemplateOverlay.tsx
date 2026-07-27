import { useMemo } from 'react';
import type { Page } from '@mediakit/shared';
import { filterCategoriesByScenario, getTemplate, type Template } from '../templates';
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

/** 单个模板卡片：名称 + 缩略图 + 描述。 */
function TemplateCard({
  tpl,
  canvasWidth,
  canvasHeight,
  onApply,
}: {
  tpl: Template;
  canvasWidth: number;
  canvasHeight: number;
  onApply: (tpl: Template) => void;
}) {
  const thumb = useTemplateThumbPage(tpl);
  return (
    <button
      onClick={() => onApply(tpl)}
      className="flex flex-col gap-1.5 rounded-lg border border-border-default p-2 text-left transition hover:border-accent-primary hover:bg-surface-hover"
    >
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
      <div className="text-sm font-medium text-foreground-primary">{tpl.name}</div>
      <div className="text-xs text-foreground-muted">{tpl.description}</div>
    </button>
  );
}

/** 新建页面时的模板浮层：按分类分组陈列（含缩略图），内容区纵向滚动。 */
export function TemplateOverlay({ onApply, onClose }: Props) {
  const scenario = useEditorStore((s) => s.projectMeta?.scenario);
  const canvasWidth = useEditorStore((s) => s.canvasWidth);
  const canvasHeight = useEditorStore((s) => s.canvasHeight);

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
          <div className="font-headings text-lg font-semibold text-foreground-primary">新建页面</div>
          <p className="mb-4 text-sm text-foreground-secondary">选择一个模板开始</p>
        </div>

        <div className="-mr-2 flex-1 overflow-y-auto pr-2">
          {filterCategoriesByScenario(scenario).map((cat) => {
            const templates = cat.ids.map((id) => getTemplate(id)).filter((t): t is Template => !!t);
            if (templates.length === 0) return null;
            return (
              <section key={cat.category} className="mb-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                  {cat.category}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {templates.map((tpl) => (
                    <TemplateCard
                      key={tpl.id}
                      tpl={tpl}
                      canvasWidth={canvasWidth}
                      canvasHeight={canvasHeight}
                      onApply={onApply}
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
    </div>
  );
}
