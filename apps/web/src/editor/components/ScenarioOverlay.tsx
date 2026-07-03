import { SCENARIO_TEMPLATES, getTemplate, type ScenarioTemplate } from '../templates';
import { useEditorStore } from '../store';

interface Props {
  onClose: () => void;
}

/** 把场景模板（多页序列）展开成一批页面，一次性生成。 */
function applyScenario(scenario: ScenarioTemplate) {
  const pages = scenario.pages.map((sp) => ({
    name: sp.name,
    components: getTemplate(sp.templateId)?.components() ?? [],
  }));
  useEditorStore.getState().addPagesBatch(pages);
}

/** 新建完整报告（场景模板）浮层：双周报 / 月报。 */
export function ScenarioOverlay({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-xl bg-surface-primary p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-1 font-headings text-lg font-semibold text-foreground-primary">新建完整报告</div>
        <p className="mb-4 text-sm text-foreground-secondary">一键生成多页报告骨架，可在其上增删改</p>
        <div className="space-y-3">
          {SCENARIO_TEMPLATES.map((sc) => (
            <button
              key={sc.id}
              onClick={() => {
                applyScenario(sc);
                onClose();
              }}
              className="block w-full rounded-lg border border-border-default p-4 text-left transition hover:border-accent-primary hover:bg-surface-hover"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground-primary">{sc.name}</span>
                <span className="text-xs text-foreground-muted">{sc.pages.length} 页</span>
              </div>
              <div className="mt-0.5 text-xs text-foreground-muted">{sc.description}</div>
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
