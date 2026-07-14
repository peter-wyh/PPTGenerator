import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsApi } from '@/api/projects';
import { createProjectFromTemplate } from '@/api/templates';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { CreateFromTemplateDialog } from '@/components/CreateFromTemplateDialog';
import { BUSINESS_LINES, SCENARIOS, SCENARIO_LABELS, SCENARIO_SUB_LABELS } from '@/projectsMeta';
import type { ProjectMeta, ProjectSummary, Scenario } from '@mediakit/shared';

export function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

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

  // 列表筛选
  const [filterBL, setFilterBL] = useState<string>('');
  const [filterScenario, setFilterScenario] = useState<Scenario | ''>('');

  // 从模板新建
  const [showFromTemplate, setShowFromTemplate] = useState(false);
  const [fromTplLoading, setFromTplLoading] = useState(false);
  const [fromTplError, setFromTplError] = useState<string | null>(null);

  const filtered = projects.filter(
    (p) =>
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

  async function handleCreate(values: { name: string; width: number; height: number; meta: import('@mediakit/shared').ProjectMeta }) {
    setCreating(true);
    setCreateError(null);
    try {
      const { project: p, seeded } = await projectsApi.create(values.name, values.width, values.height, values.meta);
      setShowCreate(false);
      navigate(`/projects/${p.id}`, { state: { seeded } });
    } catch {
      setCreateError('创建失败，请重试');
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateFromTemplate(values: { templateId: string; name: string }) {
    setFromTplLoading(true);
    setFromTplError(null);
    try {
      const p = await createProjectFromTemplate(values.templateId, values.name);
      setShowFromTemplate(false);
      navigate(`/projects/${p.id}`);
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
    } catch {
      setEditError('保存失败，请重试');
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDuplicate(p: ProjectSummary) {
    try {
      await projectsApi.duplicate(p.id);
      await refresh();
    } catch {
      /* 复制失败静默；可按需加 toast */
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await projectsApi.remove(pendingDelete.id);
      setProjects((prev) => prev.filter((p) => p.id !== pendingDelete.id));
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headings text-xl font-semibold text-foreground-primary">我的项目</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setShowFromTemplate(true)}>
            从模板新建
          </Button>
          <Button onClick={() => setShowCreate(true)}>+ 新建项目</Button>
        </div>
      </div>

      {projects.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select
            value={filterBL}
            onChange={(e) => setFilterBL(e.target.value)}
            className="rounded-lg border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-secondary"
          >
            <option value="">全部业务线</option>
            {BUSINESS_LINES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <select
            value={filterScenario}
            onChange={(e) => setFilterScenario(e.target.value as Scenario | '')}
            className="rounded-lg border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-secondary"
          >
            <option value="">全部场景</option>
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {(filterBL || filterScenario) && (
            <button
              onClick={() => {
                setFilterBL('');
                setFilterScenario('');
              }}
              className="text-xs text-foreground-muted hover:text-foreground-primary"
            >
              清除筛选
            </button>
          )}
          <span className="text-xs text-foreground-muted">{filtered.length} / {projects.length}</span>
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-foreground-muted">加载中…</p>
      ) : projects.length === 0 ? (
        <p className="mt-8 text-sm text-foreground-muted">还没有项目，新建一个开始吧。</p>
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-sm text-foreground-muted">没有符合筛选条件的项目。</p>
      ) : (
        <div className="mt-4 overflow-auto rounded-lg border border-border-default">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="bg-surface-hover text-left text-xs text-foreground-muted">
                <th className="px-3 py-2 font-medium">项目名称</th>
                <th className="px-3 py-2 font-medium">业务线</th>
                <th className="px-3 py-2 font-medium">场景</th>
                <th className="px-3 py-2 font-medium">广告主</th>
                <th className="px-3 py-2 font-medium">创建人</th>
                <th className="px-3 py-2 font-medium">尺寸</th>
                <th className="px-3 py-2 font-medium">页数</th>
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
                  <td className="px-3 py-2 text-foreground-muted">
                    {p.width}×{p.height}
                  </td>
                  <td className="px-3 py-2 text-foreground-muted">{p.pageCount}</td>
                  <td className="px-3 py-2 text-foreground-muted">
                    {new Date(p.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button
                      onClick={() => navigate(`/projects/${p.id}`)}
                      className="mr-1 rounded bg-accent-primary px-2.5 py-1 text-xs font-medium text-foreground-inverse hover:bg-accent-secondary"
                      title="进入可视化编辑器"
                    >
                      可视化编辑
                    </button>
                    <button
                      onClick={() => {
                        setEditError(null);
                        setEditing(p);
                      }}
                      className="rounded px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => void handleDuplicate(p)}
                      className="rounded px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary"
                      title="复制项目"
                    >
                      复制
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

      <ConfirmDialog
        open={!!pendingDelete}
        title="删除项目？"
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
        title="编辑项目"
        submitLabel="保存"
        lockScenario
        initial={
          editing
            ? { name: editing.name, width: editing.width, height: editing.height, meta: editing.meta }
            : null
        }
        onCancel={() => !editSubmitting && setEditing(null)}
        onSubmit={handleEdit}
      />
    </div>
  );
}

/** 场景列文本：场景 + 子类。 */
function scenarioText(meta?: ProjectMeta): string {
  if (!meta?.scenario) return '—';
  const base = SCENARIO_LABELS[meta.scenario];
  return meta.scenarioSub ? `${base}·${SCENARIO_SUB_LABELS[meta.scenarioSub]}` : base;
}
