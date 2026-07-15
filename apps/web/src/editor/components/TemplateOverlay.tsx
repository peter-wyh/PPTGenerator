import { filterCategoriesByScenario, getTemplate, type Template } from '../templates';
import { useEditorStore } from '../store';

interface Props {
  onApply: (template: Template) => void;
  onClose: () => void;
}

/** 新建页面时的模板浮层：按分类分组陈列，内容区纵向滚动。 */
export function TemplateOverlay({ onApply, onClose }: Props) {
  const scenario = useEditorStore((s) => s.projectMeta?.scenario);
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
                    <button
                      key={tpl.id}
                      onClick={() => onApply(tpl)}
                      className="rounded-lg border border-border-default p-3 text-left transition hover:border-accent-primary hover:bg-surface-hover"
                    >
                      <div className="text-sm font-medium text-foreground-primary">{tpl.name}</div>
                      <div className="mt-0.5 text-xs text-foreground-muted">{tpl.description}</div>
                    </button>
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
