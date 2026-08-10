/**
 * SaveAsTemplateDialog — 将报告保存为模板的弹窗。
 * 表单字段与 TemplateFormDialog 保持一致（渲染类型/尺寸/业务线/场景/模版类型/备注），
 * 默认从来源项目回填，保存时调用 createFromProject（支持冲突覆盖）。
 */
import { useState, useEffect } from 'react';
import { templatesApi } from '@/api/templates';
import type { ProjectSummary, ProjectMeta, Scenario } from '@mediakit/shared';
import { BUSINESS_LINES, SCENARIOS, TEMPLATE_TYPES } from '@/projectsMeta';
import { toast } from './Toast';

interface SaveAsTemplateDialogProps {
  project: ProjectSummary;
  onClose: () => void;
  onSaved?: (templateId: string) => void;
}

type RenderType = 'multi-page' | 'long-poster' | 'html-report';

const RENDER_TYPES: { value: RenderType; label: string; desc: string }[] = [
  { value: 'multi-page', label: '多页 PPT', desc: '16:9 幻灯片，多页编辑' },
  { value: 'long-poster', label: '长图海报', desc: '单页竖版长图，适合社媒传播' },
  { value: 'html-report', label: 'HTML 报告', desc: '可交互网页，支持嵌入链接' },
];

const RENDER_DEFAULT_SIZE: Record<RenderType, { w: number; h: number }> = {
  'multi-page': { w: 1920, h: 1080 },
  'long-poster': { w: 1080, h: 1920 },
  'html-report': { w: 1280, h: 0 },
};

interface SizePreset {
  id: string;
  label: string;
  hint: string;
  w: number;
  h: number;
}

const PRESETS: SizePreset[] = [
  { id: '1280x720', label: '1280 × 720', hint: '横版 · 投放报告', w: 1280, h: 720 },
  { id: '1920x1080', label: '1920 × 1080', hint: '宽屏', w: 1920, h: 1080 },
  { id: '1024x768', label: '1024 × 768', hint: '标准 4:3', w: 1024, h: 768 },
  { id: '1080x1920', label: '1080 × 1920', hint: '竖版', w: 1080, h: 1920 },
];

const selectCls =
  'w-full rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-foreground-primary outline-none focus:border-accent-primary';

/** 根据宽高推断渲染类型（兼容旧数据）。 */
function inferRenderType(w: number, h: number): RenderType {
  if (h > w) return 'long-poster';
  const ratio = w / h;
  if (ratio >= 1.5) return 'multi-page';
  return 'html-report';
}

export function SaveAsTemplateDialog({ project, onClose, onSaved }: SaveAsTemplateDialogProps) {
  const [name, setName] = useState(`${project.name} 模板`);
  const [renderType, setRenderType] = useState<RenderType | ''>('');
  const [presetId, setPresetId] = useState('');
  const [businessLine, setBusinessLine] = useState('');
  const [scenario, setScenario] = useState<Scenario | ''>('');
  const [templateType, setTemplateType] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 从来源项目回填表单
  useEffect(() => {
    const meta = project.meta ?? {};
    const rt = (meta.renderType as RenderType | undefined) ?? inferRenderType(project.width, project.height);
    setRenderType(rt);
    const matched = PRESETS.find((p) => p.w === project.width && p.h === project.height);
    setPresetId(matched?.id ?? '');
    setBusinessLine(meta.businessLine ?? '');
    setScenario(meta.scenario ?? '');
    setTemplateType(meta.templateType ?? '');
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
      const renderSize = renderType ? RENDER_DEFAULT_SIZE[renderType] : null;
      const preset = PRESETS.find((p) => p.id === presetId);
      const meta: ProjectMeta = {};
      if (businessLine) meta.businessLine = businessLine;
      if (scenario) meta.scenario = scenario as Scenario;
      if (templateType) meta.templateType = templateType;
      if (renderType) meta.renderType = renderType;

      await templatesApi.createFromProject({
        projectId: project.id,
        name: name.trim(),
        meta,
        note: note.trim() || undefined,
        overwrite,
      });
      // createFromProject 不改尺寸（沿用来源项目），但 meta 需传给后端
      // 宽高通过 preset/renderSize 可在未来扩展——目前 API 不接受 width/height
      void renderSize;
      void preset;
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

  const canSubmit = name.trim().length > 0 && !!renderType && !saving;

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
              {/* 模板名称 */}
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

              {/* 渲染类型选择器 */}
              <div>
                <span className="mb-2 block text-sm font-medium text-foreground-secondary">渲染类型</span>
                <div className="grid grid-cols-3 gap-2">
                  {RENDER_TYPES.map((rt) => (
                    <button
                      key={rt.value}
                      type="button"
                      onClick={() => setRenderType(rt.value)}
                      className={`rounded-lg border p-3 text-left transition ${
                        renderType === rt.value
                          ? 'border-accent-primary bg-accent-primary/5'
                          : 'border-border-default hover:border-accent-secondary/50'
                      }`}
                    >
                      <div className={`text-sm font-medium ${renderType === rt.value ? 'text-accent-primary' : 'text-foreground-primary'}`}>
                        {rt.label}
                      </div>
                      <div className="mt-1 text-xs text-foreground-muted">{rt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 渲染类型选定后才展示分类 / 备注 */}
              {renderType && (
                <>
                  {renderType === 'multi-page' ? (
                    <div className="rounded-lg bg-surface-hover px-3 py-2 text-xs text-foreground-secondary">
                      固定 16:9（1920×1080），多页编辑
                    </div>
                  ) : (
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-foreground-secondary">尺寸</span>
                      <select value={presetId} onChange={(e) => setPresetId(e.target.value)} className={selectCls}>
                        <option value="">沿用来源项目尺寸（{project.width}×{project.height}）</option>
                        {PRESETS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label} · {p.hint}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-foreground-secondary">业务线</span>
                      <select value={businessLine} onChange={(e) => setBusinessLine(e.target.value)} className={selectCls}>
                        <option value="">不指定</option>
                        {BUSINESS_LINES.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-foreground-secondary">场景</span>
                      <select
                        value={scenario}
                        onChange={(e) => {
                          setScenario(e.target.value as Scenario | '');
                          setTemplateType('');
                        }}
                        className={selectCls}
                      >
                        <option value="">不指定</option>
                        {SCENARIOS.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {scenario && (
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-foreground-secondary">模版类型</span>
                      <select
                        value={templateType}
                        onChange={(e) => setTemplateType(e.target.value)}
                        className={selectCls}
                      >
                        <option value="">不指定</option>
                        {TEMPLATE_TYPES[scenario].map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

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
                </>
              )}
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
