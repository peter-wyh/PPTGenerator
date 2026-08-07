/**
 * SaveAsTemplateDialog — 将报告保存为模板的弹窗。
 * 类似新建项目弹窗，但默认回填来源项目信息。
 * 支持编辑：模板名称、备注。
 */
import { useState, useEffect } from 'react';
import { templatesApi } from '@/api/templates';
import type { ProjectSummary, ProjectMeta } from '@mediakit/shared';
import { toast } from './Toast';

interface SaveAsTemplateDialogProps {
  project: ProjectSummary;
  onClose: () => void;
  onSaved?: (templateId: string) => void;
}

export function SaveAsTemplateDialog({ project, onClose, onSaved }: SaveAsTemplateDialogProps) {
  const [name, setName] = useState(`${project.name} 模板`);
  const [note, setNote] = useState('');
  const [meta, setMeta] = useState<ProjectMeta | undefined>(project.meta);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 回填 meta 信息
  useEffect(() => {
    setMeta(project.meta);
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
      const tpl = await templatesApi.createFromProject({
        projectId: project.id,
        name: name.trim(),
        meta,
        note: note.trim() || undefined,
        overwrite,
      });
      setSuccess(true);
      toast.success('已保存为模板');
      onSaved?.(tpl.id);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !saving && onClose()}>
      <div
        className="w-[460px] rounded-xl bg-surface-primary shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border-default px-5 py-3">
          <h2 className="text-base font-semibold text-foreground-primary">存为模板</h2>
          <button
            onClick={() => !saving && onClose()}
            className="text-foreground-muted hover:text-foreground-primary"
          >✕</button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {success ? (
            <div className="space-y-3">
              <p className="rounded-lg bg-green/10 px-3 py-2 text-sm text-green">
                模板「{name}」已保存，可在模板管理中查看和发布。
              </p>
              <div className="flex justify-end">
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
              {/* 来源信息 */}
              <div className="rounded-lg bg-surface-hover/50 px-3 py-2 text-xs text-foreground-muted">
                <div className="flex items-center gap-1.5">
                  <span>📄</span>
                  <span>来源报告：<span className="font-medium text-foreground-secondary">{project.name}</span></span>
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <span>尺寸 {project.width}×{project.height}</span>
                  <span>· {project.pageCount} 页</span>
                  {project.meta?.scenario && <span>· {project.meta.scenario}</span>}
                </div>
              </div>

              {/* 模板名称 */}
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground-secondary">模板名称</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="输入模板名称"
                  className="w-full rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-foreground-primary focus:border-accent-primary focus:outline-none"
                />
              </div>

              {/* 备注 */}
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground-secondary">备注（可选）</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="模板用途、适用场景等说明"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-foreground-primary focus:border-accent-primary focus:outline-none"
                />
              </div>

              {/* 说明 */}
              <p className="rounded-lg bg-surface-hover px-3 py-2 text-xs text-foreground-muted">
                💡 组件布局和样式将被保留，数据绑定将被清除。保存后可在模板管理中发布。
              </p>

              {error && <p className="text-sm text-red">{error}</p>}
              {conflict && (
                <div className="space-y-2 rounded-lg border border-orange/30 bg-orange/10 px-3 py-2">
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
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={onClose}
                    disabled={saving}
                    className="rounded-lg border border-border-default px-4 py-2 text-sm hover:bg-surface-hover disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => void handleSave(false)}
                    disabled={saving || !name.trim()}
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
    </div>
  );
}
