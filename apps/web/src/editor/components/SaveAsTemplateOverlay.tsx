import { useState } from 'react';
import { templatesApi } from '@/api/templates';
import { useAuthStore } from '@/stores/auth';
import {
  BUSINESS_LINES,
  SCENARIOS,
  SCENARIO_SUB_LABELS,
  TEMPLATE_TYPES,
} from '@/projectsMeta';
import type { Scenario, ScenarioSub, ProjectMeta } from '@mediaket/shared';

interface SaveAsTemplateOverlayProps {
  open: boolean;
  projectId: string;
  pageId: string;
  pageName: string;
  canvasWidth: number;
  canvasHeight: number;
  projectMeta?: ProjectMeta | null;
  onClose: () => void;
}

/**
 * 将项目中的某页保存为模板。
 * 自动回显当前项目的业务线 / 场景 / 模版类型，ADMIN 可在弹窗中修改后保存。
 */
export function SaveAsTemplateOverlay({
  open,
  projectId,
  pageId,
  pageName,
  canvasWidth,
  canvasHeight,
  projectMeta,
  onClose,
}: SaveAsTemplateOverlayProps) {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  // 回显项目 meta
  const [name, setName] = useState(`${pageName} 模板`);
  const [businessLine, setBusinessLine] = useState(projectMeta?.businessLine ?? '');
  const [scenario, setScenario] = useState<Scenario | ''>(projectMeta?.scenario ?? '');
  const [scenarioSub, setScenarioSub] = useState<ScenarioSub | ''>(
    (projectMeta?.scenarioSub as ScenarioSub | undefined) ?? '',
  );
  const [templateType, setTemplateType] = useState(projectMeta?.templateType ?? '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!open) return null;

  // 当前选中场景下可用的模版类型列表
  const tplTypeOptions: [string, string][] =
    scenario && TEMPLATE_TYPES[scenario] ? TEMPLATE_TYPES[scenario] : [];

  async function handleSave() {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const meta: Partial<ProjectMeta> = {};
      if (businessLine) meta.businessLine = businessLine;
      if (scenario) meta.scenario = scenario;
      if (scenarioSub) meta.scenarioSub = scenarioSub;
      if (templateType) meta.templateType = templateType;

      const tpl = await templatesApi.createFromProjectPage({
        projectId,
        pageId,
        name,
        width: canvasWidth,
        height: canvasHeight,
        meta: meta as ProjectMeta,
        note: note || undefined,
      });
      setSuccess(`已保存为模板「${tpl.name}」，可在模板管理中查看和发布。`);
    } catch {
      setError('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-[480px] max-h-[90vh] overflow-auto rounded-xl bg-surface-primary shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-default px-5 py-3">
          <h2 className="text-base font-semibold text-foreground-primary">保存为模板</h2>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground-primary">✕</button>
        </div>

        {!isAdmin && (
          <div className="px-5 py-6 text-sm text-foreground-muted">
            仅管理员可将页面保存为模板。请联系管理员操作。
          </div>
        )}

        {isAdmin && (
          <div className="space-y-4 px-5 py-4">
            {success ? (
              <div className="space-y-3">
                <p className="rounded-lg bg-green/10 px-3 py-2 text-sm text-green">{success}</p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-border-default px-4 py-2 text-sm hover:bg-surface-hover"
                  >
                    关闭
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground-secondary">模板名称</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm"
                    placeholder="模板名称"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground-secondary">业务线</label>
                    <select
                      value={businessLine}
                      onChange={(e) => setBusinessLine(e.target.value)}
                      className="w-full rounded-lg border border-border-default bg-surface-primary px-2 py-2 text-sm"
                    >
                      <option value="">不指定</option>
                      {BUSINESS_LINES.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground-secondary">场景</label>
                    <select
                      value={scenario}
                      onChange={(e) => {
                        const v = e.target.value as Scenario | '';
                        setScenario(v);
                        setScenarioSub('');
                        setTemplateType('');
                      }}
                      className="w-full rounded-lg border border-border-default bg-surface-primary px-2 py-2 text-sm"
                    >
                      <option value="">不指定</option>
                      {SCENARIOS.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 场景子类：ScenarioSub 有 3 个固定值 */}
                {scenario && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground-secondary">场景子类</label>
                    <select
                      value={scenarioSub}
                      onChange={(e) => setScenarioSub(e.target.value as ScenarioSub | '')}
                      className="w-full rounded-lg border border-border-default bg-surface-primary px-2 py-2 text-sm"
                    >
                      <option value="">不指定</option>
                      {(Object.keys(SCENARIO_SUB_LABELS) as ScenarioSub[]).map((k) => (
                        <option key={k} value={k}>{SCENARIO_SUB_LABELS[k]}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 模版类型：按场景动态 */}
                {scenario && tplTypeOptions.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground-secondary">模版类型</label>
                    <select
                      value={templateType}
                      onChange={(e) => setTemplateType(e.target.value)}
                      className="w-full rounded-lg border border-border-default bg-surface-primary px-2 py-2 text-sm"
                    >
                      <option value="">不指定</option>
                      {tplTypeOptions.map(([id, label]) => (
                        <option key={id} value={id}>{label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground-secondary">备注（可选）</label>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm"
                    placeholder="模板用途说明"
                  />
                </div>

                <div className="rounded-lg bg-surface-hover px-3 py-2 text-xs text-foreground-muted">
                  📐 画布尺寸：{canvasWidth}×{canvasHeight} · 组件布局/样式将被保留，数据绑定将被清除。
                </div>

                {error && (
                  <p className="text-sm text-red">{error}</p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={onClose}
                    disabled={saving}
                    className="rounded-lg border border-border-default px-4 py-2 text-sm hover:bg-surface-hover disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !name.trim()}
                    className="rounded-lg bg-accent-primary px-4 py-2 text-sm font-medium text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50"
                  >
                    {saving ? '保存中…' : '保存模板'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
