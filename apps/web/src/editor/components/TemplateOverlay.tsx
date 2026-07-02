import { TEMPLATES, type Template } from '../templates';

interface Props {
  onApply: (template: Template) => void;
  onClose: () => void;
}

/** 新建页面时的模板浮层。 */
export function TemplateOverlay({ onApply, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-xl rounded-xl bg-surface-primary p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-1 font-headings text-lg font-semibold text-foreground-primary">新建页面</div>
        <p className="mb-4 text-sm text-foreground-secondary">选择一个模板开始</p>
        <div className="grid grid-cols-2 gap-3">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => onApply(tpl)}
              className="rounded-lg border border-border-default p-4 text-left transition hover:border-accent-primary hover:bg-surface-hover"
            >
              <div className="font-medium text-foreground-primary">{tpl.name}</div>
              <div className="mt-0.5 text-xs text-foreground-muted">{tpl.description}</div>
            </button>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-foreground-secondary hover:bg-surface-hover">
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
