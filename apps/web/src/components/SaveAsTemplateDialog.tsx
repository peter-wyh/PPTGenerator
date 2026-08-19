/**
 * SaveAsTemplateDialog — 将报告保存为模板的弹窗。
 * 渲染类型/业务线/场景/模版类型从来源报告自动回填，只读不可修改。
 * 仅模板名称和备注可编辑。
 */
import { useState, useEffect } from 'react';
import { templatesApi } from '@/api/templates';
import type { ProjectSummary, ProjectMeta, Scenario } from '@mediakit/shared';
import { SCENARIO_LABELS, TEMPLATE_TYPE_LABELS } from '@/projectsMeta';
import { toast } from './Toast';

interface SaveAsTemplateDialogProps {
  project: ProjectSummary;
  onClose: () => void;
  onSaved?: (templateId: string) => void;
}

type RenderType = 'multi-page' | 'html-report';

const RENDER_TYPE_LABELS: Record<RenderType, string> = {
  'multi-page': '多页 PPT',
  'html-report': 'HTML 报告',
};

/**
 * 根据来源项目的 styleType + 宽高推断渲染类型。
 * 优先用 styleType（权威字段），旧数据无 styleType 时回退到宽高推断。
 */
function inferRenderType(
  styleType: 'ppt' | 'ai-html' | undefined,
  w: number,
  h: number,
): RenderType {
  if (styleType === 'ai-html') return 'html-report';
  if (styleType === 'ppt') return 'multi-page';
  // 旧数据无 styleType（或残留的 single）时用宽高推断（长图海报已裁撤，竖版归 HTML 报告）
  if (h > w) return 'html-report';
  const ratio = w / h;
  if (ratio >= 1.5) return 'multi-page';
  return 'html-report';
}

export function SaveAsTemplateDialog({ project, onClose, onSaved }: SaveAsTemplateDialogProps) {
  const [name, setName] = useState(`${project.name} 模板`);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 从来源项目 meta 计算只读字段（一次计算，不再变化）
  const meta = project.meta ?? {};
  const renderType =
    (meta.renderType as RenderType | undefined) ??
    inferRenderType(meta.styleType, project.width, project.height);
  const businessLine = meta.businessLine ?? '';
  const scenario = meta.scenario ?? '';
  const templateType = meta.templateType ?? '';

  // 初始化模板名称
  useEffect(() => {
    setName(`${project.name} 模板`);
    setNote('');
  }, [project]);

  async function handleSave(overwrite = false) {
    if (!name.trim()) {
      setError('请输入模板名称');
      return;
    }
    setSaving(true);
    setError(null);
    setConflict(null);
    try {
      const metaPayload: ProjectMeta = {};
      if (businessLine) metaPayload.businessLine = businessLine;
      if (scenario) metaPayload.scenario = scenario as Scenario;
      if (templateType) metaPayload.templateType = templateType;
      if (renderType) metaPayload.renderType = renderType;

      await templatesApi.createFromProject({
        projectId: project.id,
        name: name.trim(),
        meta: metaPayload,
        note: note.trim() || undefined,
        overwrite,
      });
      setSuccess(true);
      toast.success('已保存为模板');
      onSaved?.('');
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: { message?: string } } } };
      if (e.response?.status === 409) {
        setConflict(e.response?.data?.error?.message ?? '已存在同名模板，是否覆盖？');
      } else {
        setError(e.response?.data?.error?.message ?? '保存失败，请重试');
      }
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = name.trim().length > 0 && !saving;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => !saving && !success && onClose()}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-xl bg-surface-primary p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {success ? (
          <>
            <h3 className="font-headings text-base font-semibold text-foreground-primary">已保存</h3>
            <p className="mt-4 rounded-lg bg-green/10 px-3 py-3 text-sm text-green">
              模板「{name}」已保存，可在模板管理中查看和发布。
            </p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={onClose}
                className="rounded-lg border border-border-default px-4 py-2 text-sm hover:bg-surface-hover"
              >
                关闭
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="font-headings text-base font-semibold text-foreground-primary">存为模板</h3>

            {/* 来源信息 */}
            <div className="mt-3 rounded-lg bg-surface-hover/50 px-3 py-2 text-xs text-foreground-muted">
              <div className="flex items-center gap-1.5">
                <span>📄</span>
                <span>来源报告：<span className="font-medium text-foreground-secondary">{project.name}</span></span>
              </div>
              <div className="mt-1 flex items-center gap-3">
                <span>尺寸 {project.width}×{project.height}</span>
                <span>· {project.pageCount} 页</span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {/* 模板名称（可编辑） */}
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-foreground-secondary">模板名称</span>
                <input
                  type="text"
                  value={name}
                  autoFocus
                  onChange={(e) => setName(e.target.value)}
                  placeholder="如：投放周报 · 通用模板"
                  className="w-full rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-foreground-primary outline-none focus:border-accent-primary"
                />
              </label>

              {/* 只读字段：渲染类型 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border-subtle bg-surface-hover/30 px-3 py-2">
                  <span className="mb-0.5 block text-[11px] font-medium text-foreground-muted">渲染类型</span>
                  <span className="text-sm text-foreground-secondary">{RENDER_TYPE_LABELS[renderType] ?? renderType}</span>
                </div>
                <div className="rounded-lg border border-border-subtle bg-surface-hover/30 px-3 py-2">
                  <span className="mb-0.5 block text-[11px] font-medium text-foreground-muted">业务线</span>
                  <span className="text-sm text-foreground-secondary">{businessLine || '—'}</span>
                </div>
                <div className="rounded-lg border border-border-subtle bg-surface-hover/30 px-3 py-2">
                  <span className="mb-0.5 block text-[11px] font-medium text-foreground-muted">场景</span>
                  <span className="text-sm text-foreground-secondary">
                    {scenario ? (SCENARIO_LABELS[scenario] ?? scenario) : '—'}
                  </span>
                </div>
                <div className="rounded-lg border border-border-subtle bg-surface-hover/30 px-3 py-2">
                  <span className="mb-0.5 block text-[11px] font-medium text-foreground-muted">模版类型</span>
                  <span className="text-sm text-foreground-secondary">
                    {templateType ? (TEMPLATE_TYPE_LABELS[templateType] ?? templateType) : '—'}
                  </span>
                </div>
              </div>

              {/* 备注（可编辑） */}
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-foreground-secondary">
                  设计师备注（可选）
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="仅管理后台可见，如适用场景说明"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-foreground-primary outline-none focus:border-accent-primary"
                />
              </label>
            </div>

            <p className="mt-3 rounded-lg bg-surface-hover px-3 py-2 text-xs text-foreground-muted">
              💡 组件布局和样式将被保留，数据绑定将被清除。保存后可在模板管理中发布。
            </p>

            {error && <p className="mt-3 text-xs text-red">{error}</p>}
            {conflict && (
              <div className="mt-3 space-y-2 rounded-lg border border-orange/30 bg-orange/10 px-3 py-2">
                <p className="text-sm text-orange-dark">{conflict}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => void handleSave(true)}
                    disabled={saving}
                    className="rounded-lg bg-orange px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-dark disabled:opacity-50"
                  >
                    {saving ? '覆盖中…' : '覆盖已有模板'}
                  </button>
                  <button
                    onClick={() => setConflict(null)}
                    disabled={saving}
                    className="rounded-lg border border-border-default px-3 py-1.5 text-xs hover:bg-surface-hover disabled:opacity-50"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {!conflict && (
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={onClose}
                  disabled={saving}
                  className="rounded-lg border border-border-default px-4 py-2 text-sm hover:bg-surface-hover disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={() => void handleSave(false)}
                  disabled={!canSubmit}
                  className="rounded-lg bg-accent-primary px-4 py-2 text-sm font-medium text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50"
                >
                  {saving ? '保存中…' : '保存模板'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
