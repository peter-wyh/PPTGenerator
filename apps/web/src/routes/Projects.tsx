import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsApi } from '@/api/projects';
import { createProjectFromTemplate } from '@/api/templates';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { CreateFromTemplateDialog } from '@/components/CreateFromTemplateDialog';
import { DuplicateProjectDialog } from '@/components/DuplicateProjectDialog';
import { SaveAsTemplateDialog } from '@/components/SaveAsTemplateDialog';
import {
  SCENARIOS,
  SCENARIO_LABELS,
  SCENARIO_SUB_LABELS,
} from '@/projectsMeta';
import { useBusinessLineCodes } from '@/editor/useBusinessLineLogo';
import type { ProjectMeta, ProjectSummary, Scenario } from '@mediakit/shared';
import { toast } from '../components/Toast';

export function Projects() {
  const navigate = useNavigate();
  const BUSINESS_LINES = useBusinessLineCodes(); // 数据库唯一来源
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // ★ 类型菜单（左侧 2 项：单页面类型已废弃下线；styleType 缺省视为 'ppt'）
  type StyleTab = 'ppt' | 'ai-html';
  const [activeTab, setActiveTab] = useState<StyleTab>('ppt');
  const TAB_LABELS: Record<StyleTab, string> = {
    ppt: 'PPT 多页',
    'ai-html': 'AI HTML',
  };
  const styleOf = (p: ProjectSummary) => (p.meta?.styleType === 'ai-html' ? 'ai-html' : 'ppt') as StyleTab;

  // 新建项目弹窗
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // 删除确认
  const [pendingDelete, setPendingDelete] = useState<ProjectSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 编辑项目弹窗
  const [editing, setEditing] = useState<ProjectSummary | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // 存为模版
  const [saveTplFor, setSaveTplFor] = useState<ProjectSummary | null>(null);

  // 复制报告（带周期）
  const [dupFor, setDupFor] = useState<ProjectSummary | null>(null);

  // ai-html 行的 HTML 操作:下拉开合 + 按行缓存 + busy
  const [htmlMenuFor, setHtmlMenuFor] = useState<string | null>(null);
  const [htmlCache, setHtmlCache] = useState<Record<string, string>>({});
  const [htmlBusy, setHtmlBusy] = useState<string | null>(null);

  async function ensureHtml(p: ProjectSummary): Promise<string | null> {
    if (htmlCache[p.id] !== undefined) return htmlCache[p.id];
    setHtmlBusy(p.id);
    try {
      const { html } = await projectsApi.getHtml(p.id);
      setHtmlCache((prev) => ({ ...prev, [p.id]: html }));
      return html;
    } catch {
      toast.error('读取 HTML 失败');
      return null;
    } finally {
      setHtmlBusy(null);
    }
  }

  async function handlePreviewHtml(p: ProjectSummary) {
    const html = await ensureHtml(p);
    if (html === null) return;
    if (!html) { toast.error('该报告暂无 HTML 内容'); return; }
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function handleDownloadHtml(p: ProjectSummary) {
    const html = await ensureHtml(p);
    if (html === null) return;
    if (!html) { toast.error('该报告暂无 HTML 内容'); return; }
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${p.name}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopyHtml(p: ProjectSummary) {
    const html = await ensureHtml(p);
    if (html === null) return;
    if (!html) { toast.error('该报告暂无 HTML 内容'); return; }
    try {
      await navigator.clipboard.writeText(html);
      toast.success('已复制 HTML 源码');
    } catch {
      toast.error('复制失败，请手动复制');
    }
  }

  // 列表筛选
  const [filterBL, setFilterBL] = useState<string>('');
  const [filterScenario, setFilterScenario] = useState<Scenario | ''>('');

  // 从模板新建
  const [showFromTemplate, setShowFromTemplate] = useState(false);
  const [fromTplLoading, setFromTplLoading] = useState(false);
  const [fromTplError, setFromTplError] = useState<string | null>(null);

  const filtered = projects.filter(
    (p) =>
      styleOf(p) === activeTab &&
      (!filterBL || p.meta?.businessLine === filterBL) &&
      (!filterScenario || p.meta?.scenario === filterScenario),
  );

  async function refresh() {
    setLoading(true);
    try {
      setProjects(await projectsApi.list());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreate(values: { name: string; width: number; height: number; meta: import('@mediakit/shared').ProjectMeta; templateId?: string }) {
    setCreating(true);
    setCreateError(null);
    try {
      // 模版模式：走 createProjectFromTemplate
      if (values.templateId) {
        const p = await createProjectFromTemplate(values.templateId, values.name);
        setShowCreate(false);
        navigate(`/projects/${p.id}`);
        return;
      }
      const { project: p, seeded } = await projectsApi.create(values.name, values.width, values.height, values.meta);
      setShowCreate(false);
      // AI 生成 HTML：直接进入沉浸式 AI HTML 工作台（原 ⚡生成 overlay 已废弃）。
      if (values.meta.styleType === 'ai-html') {
        navigate(`/projects/${p.id}/html-studio`);
        return;
      }
      navigate(`/projects/${p.id}`, { state: { seeded } });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setCreateError(e.response?.data?.error?.message ?? '创建失败，请重试');
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateFromTemplate(values: {
    templateId: string;
    name: string;
    reportPeriod?: { startDate?: string; endDate?: string };
  }) {
    setFromTplLoading(true);
    setFromTplError(null);
    try {
      const p = await createProjectFromTemplate(values.templateId, values.name, values.reportPeriod);
      setShowFromTemplate(false);
      // html 模板建出的报告是 AI HTML 类型：直接进 HTML 工作台，而不是可视化编辑器。
      navigate(p.meta?.styleType === 'ai-html' ? `/projects/${p.id}/html-studio` : `/projects/${p.id}`);
    } catch {
      setFromTplError('创建失败，模板可能已下架，请重试');
    } finally {
      setFromTplLoading(false);
    }
  }

  async function handleEdit(values: { name: string; width: number; height: number; meta: import('@mediakit/shared').ProjectMeta }) {
    if (!editing) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      const updated = await projectsApi.update(editing.id, values);
      setProjects((prev) =>
        prev.map((p) =>
          p.id === editing.id
            ? { ...p, name: updated.name, width: updated.width, height: updated.height, meta: updated.meta }
            : p,
        ),
      );
      setEditing(null);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setEditError(e.response?.data?.error?.message ?? '保存失败，请重试');
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await projectsApi.remove(pendingDelete.id);
      setProjects((prev) => prev.filter((p) => p.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch {
      toast.error('删除失败');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* 左侧类型菜单（2 种报告类型，与数据管理的左侧菜单布局对齐） */}
      <aside className="flex w-52 shrink-0 flex-col border-r border-border-default bg-surface-primary">
        <div className="px-4 py-4">
          <h1 className="font-headings text-lg font-semibold text-foreground-primary">报告管理</h1>
          <p className="mt-0.5 text-xs text-foreground-secondary">
            管理 · 筛选 · 创建报告
          </p>
        </div>
        <nav className="flex-1 overflow-auto px-2">
          {(['ppt', 'ai-html'] as const).map((t) => {
            const count = projects.filter((p) => styleOf(p) === t).length;
            const active = activeTab === t;
            return (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`mb-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-accent-primary/10 font-medium text-accent-primary'
                    : 'text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary'
                }`}
              >
                <span>{TAB_LABELS[t]}</span>
                <span className="text-xs text-foreground-muted">{count}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* 右侧内容区 */}
      <main className="min-w-0 flex-1 overflow-auto p-6">
        {/* ★ 工具条：新建 + 筛选都放表格上方 */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setShowFromTemplate(true)}>
            从模板新建
          </Button>
          <Button onClick={() => setShowCreate(true)}>+ 新建报告</Button>
          <span className="mx-1 h-5 w-px bg-border-default" />
          <select
            value={filterBL}
            onChange={(e) => setFilterBL(e.target.value)}
            className="rounded-md border border-border-default bg-surface-primary px-2 py-1.5 text-xs text-foreground-secondary"
          >
            <option value="">全部业务线</option>
            {BUSINESS_LINES.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select
            value={filterScenario}
            onChange={(e) => setFilterScenario(e.target.value as Scenario | '')}
            className="rounded-md border border-border-default bg-surface-primary px-2 py-1.5 text-xs text-foreground-secondary"
          >
            <option value="">全部场景</option>
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          {(filterBL || filterScenario) && (
            <button
              onClick={() => { setFilterBL(''); setFilterScenario(''); }}
              className="text-[10px] text-foreground-muted hover:text-foreground-primary"
            >
              ✕ 清除筛选
            </button>
          )}
          <span className="ml-auto text-xs text-foreground-muted">
            {filtered.length} / {projects.filter((p) => styleOf(p) === activeTab).length} 个{TAB_LABELS[activeTab]}报告
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-foreground-muted">加载中…</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-foreground-muted">还没有报告，点击上方「+ 新建报告」开始吧。</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-foreground-muted">没有符合筛选条件的报告。</p>
        ) : (
          <div className="overflow-auto rounded-lg border border-border-default">
            <table className="w-full min-w-[960px] border-collapse text-sm">
              <thead>
                <tr className="bg-surface-hover text-left text-xs text-foreground-muted">
                  <th className="px-3 py-2 font-medium">报告名称</th>
                  <th className="px-3 py-2 font-medium">业务线</th>
                  <th className="px-3 py-2 font-medium">场景</th>
                  <th className="px-3 py-2 font-medium">广告主</th>
                  <th className="px-3 py-2 font-medium">创建人</th>
                  <th className="px-3 py-2 font-medium">尺寸</th>
                  <th className="px-3 py-2 font-medium">页数</th>
                  {activeTab === 'ai-html' && (
                    <th className="px-3 py-2 font-medium">HTML 状态</th>
                  )}
                  <th className="px-3 py-2 font-medium">更新时间</th>
                  <th className="px-3 py-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t border-border-subtle hover:bg-surface-hover/50">
                    <td className="px-3 py-2">
                      <button
                        className="font-medium text-foreground-primary hover:text-accent-primary"
                        onClick={() => navigate(`/projects/${p.id}`)}
                      >
                        {p.name}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-foreground-secondary">{p.meta?.businessLine ?? '—'}</td>
                    <td className="px-3 py-2 text-foreground-secondary">{scenarioText(p.meta)}</td>
                    <td className="px-3 py-2 text-foreground-secondary">{p.meta?.advertiser ?? '—'}</td>
                    <td className="px-3 py-2 text-foreground-secondary">{p.meta?.creator ?? '—'}</td>
                    <td className="px-3 py-2 text-foreground-muted">{p.width}×{p.height}</td>
                    <td className="px-3 py-2 text-foreground-muted">{p.pageCount}</td>
                    {activeTab === 'ai-html' && (
                      <td className="px-3 py-2">
                        {(() => {
                          const status = p.meta?.aiHtmlStatus;
                          const hasHtml = p.hasHtml;
                          if (status === 'generating') {
                            return (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                                生成中
                              </span>
                            );
                          }
                          if (hasHtml || status === 'generated') {
                            return (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                已生成
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                              未生成
                            </span>
                          );
                        })()}
                      </td>
                    )}
                    <td className="px-3 py-2 text-foreground-muted">{new Date(p.updatedAt).toLocaleDateString()}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button
                        onClick={() => {
                          if (p.meta?.styleType === 'ai-html') {
                            navigate(`/projects/${p.id}/html-studio`);
                            return;
                          }
                          navigate(`/projects/${p.id}`);
                        }}
                        className="mr-1 rounded bg-accent-primary px-2.5 py-1 text-xs font-medium text-foreground-inverse hover:bg-accent-secondary"
                        title={p.meta?.styleType === 'ai-html' ? '进入 AI HTML 工作台' : '进入可视化编辑器'}
                      >
                        {p.meta?.styleType === 'ai-html' ? '⚡ AI生成' : '可视化编辑'}
                      </button>
                      {p.meta?.styleType === 'ai-html' && (
                        <span className="relative ml-1 inline-block">
                          <button
                            onClick={() => setHtmlMenuFor(htmlMenuFor === p.id ? null : p.id)}
                            className="rounded px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary"
                          >
                            HTML ▾
                          </button>
                          {htmlMenuFor === p.id && (
                            <>
                              {/* 点击外部关闭 */}
                              <button
                                aria-label="关闭菜单"
                                className="fixed inset-0 z-10 cursor-default"
                                tabIndex={-1}
                                onClick={() => setHtmlMenuFor(null)}
                              />
                              <span className="absolute right-0 z-20 mt-1 w-28 rounded-md border border-border-default bg-surface-primary py-1 shadow-lg">
                                <button
                                  disabled={htmlBusy === p.id}
                                  onClick={() => { setHtmlMenuFor(null); void handlePreviewHtml(p); }}
                                  className="block w-full px-3 py-1.5 text-left text-xs text-foreground-primary hover:bg-surface-hover disabled:opacity-50"
                                >
                                  预览
                                </button>
                                <button
                                  disabled={htmlBusy === p.id}
                                  onClick={() => { setHtmlMenuFor(null); void handleDownloadHtml(p); }}
                                  className="block w-full px-3 py-1.5 text-left text-xs text-foreground-primary hover:bg-surface-hover disabled:opacity-50"
                                >
                                  下载
                                </button>
                                <button
                                  disabled={htmlBusy === p.id}
                                  onClick={() => { setHtmlMenuFor(null); void handleCopyHtml(p); }}
                                  className="block w-full px-3 py-1.5 text-left text-xs text-foreground-primary hover:bg-surface-hover disabled:opacity-50"
                                >
                                  复制源码
                                </button>
                              </span>
                            </>
                          )}
                        </span>
                      )}
                      <button
                        onClick={() => { setEditError(null); setEditing(p); }}
                        className="rounded px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => setDupFor(p)}
                        className="rounded px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary"
                        title="复制报告"
                      >
                        复制
                      </button>
                      <button
                        onClick={() => setSaveTplFor(p)}
                        className="rounded px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary"
                        title="将报告保存为可复用模板"
                      >
                        存模版
                      </button>
                      <button
                        onClick={() => setPendingDelete(p)}
                        className="rounded px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover hover:text-red"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* 弹窗 */}
      <ConfirmDialog
        open={!!pendingDelete}
        title="删除报告？"
        description={`「${pendingDelete?.name ?? ''}」将被永久删除，此操作不可撤销。`}
        confirmText="删除"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <CreateProjectDialog
        open={showCreate}
        loading={creating}
        error={createError}
        onCancel={() => !creating && setShowCreate(false)}
        onSubmit={handleCreate}
      />

      <CreateFromTemplateDialog
        open={showFromTemplate}
        loading={fromTplLoading}
        error={fromTplError}
        onCancel={() => !fromTplLoading && setShowFromTemplate(false)}
        onSubmit={handleCreateFromTemplate}
      />

      <CreateProjectDialog
        open={!!editing}
        loading={editSubmitting}
        error={editError}
        title="编辑报告"
        submitLabel="保存"
        lockScenario
        initial={editing ? { name: editing.name, width: editing.width, height: editing.height, meta: editing.meta } : null}
        onCancel={() => !editSubmitting && setEditing(null)}
        onSubmit={handleEdit}
      />

      {/* 存为模版对话框 */}
      {saveTplFor && (
        <SaveAsTemplateDialog
          project={saveTplFor}
          onClose={() => setSaveTplFor(null)}
        />
      )}

      {/* 复制报告对话框 */}
      {dupFor && (
        <DuplicateProjectDialog
          project={dupFor}
          onClose={() => setDupFor(null)}
          onDone={() => {
            setDupFor(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}

/** 场景列文本：场景 + 子类。 */
function scenarioText(meta?: ProjectMeta): string {
  if (!meta?.scenario) return '—';
  const base = SCENARIO_LABELS[meta.scenario];
  return meta.scenarioSub ? `${base}·${SCENARIO_SUB_LABELS[meta.scenarioSub]}` : base;
}
