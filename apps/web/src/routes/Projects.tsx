import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsApi } from '@/api/projects';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
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

  // 改名内联
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // 列表筛选
  const [filterBL, setFilterBL] = useState<string>('');
  const [filterScenario, setFilterScenario] = useState<Scenario | ''>('');

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
      const p = await projectsApi.create(values.name, values.width, values.height, values.meta);
      setShowCreate(false);
      navigate(`/projects/${p.id}`);
    } catch {
      setCreateError('创建失败，请重试');
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(id: string) {
    const name = editName.trim();
    if (!name) {
      setEditingId(null);
      return;
    }
    const updated = await projectsApi.rename(id, name);
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name: updated.name } : p)));
    setEditingId(null);
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
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headings text-xl font-semibold text-foreground-primary">我的项目</h1>
        <Button onClick={() => setShowCreate(true)}>+ 新建项目</Button>
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
        <ul className="mt-4 space-y-2">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-primary px-4 py-3 transition hover:border-accent-primary/40"
            >
              {editingId === p.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleRename(p.id);
                  }}
                >
                  <Input
                    name="editName"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                  />
                  <Button type="submit" variant="secondary">
                    保存
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>
                    取消
                  </Button>
                </form>
              ) : (
                <>
                  <button
                    className="flex-1 text-left"
                    onClick={() => navigate(`/projects/${p.id}`)}
                  >
                    <div className="font-medium text-foreground-primary">{p.name}</div>
                    <div className="text-xs text-foreground-muted">
                      {p.pageCount} 页 · {p.width}×{p.height} · 更新于{' '}
                      {new Date(p.updatedAt).toLocaleString()}
                    </div>
                    <ProjectMetaTags meta={p.meta} />
                  </button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditingId(p.id);
                      setEditName(p.name);
                    }}
                  >
                    改名
                  </Button>
                  <Button variant="ghost" onClick={() => setPendingDelete(p)}>
                    删除
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
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
    </div>
  );
}

/** 项目元数据标签（业务线 / 创建人 / 场景 / 广告主）。 */
function ProjectMetaTags({ meta }: { meta?: ProjectMeta }) {
  if (!meta) return null;
  const tags: string[] = [];
  if (meta.businessLine) tags.push(meta.businessLine);
  if (meta.creator) tags.push(meta.creator);
  if (meta.advertiser) tags.push(meta.advertiser);
  if (meta.scenario) {
    tags.push(SCENARIO_LABELS[meta.scenario] + (meta.scenarioSub ? `·${SCENARIO_SUB_LABELS[meta.scenarioSub]}` : ''));
  }
  if (tags.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {tags.map((t, i) => (
        <span key={i} className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-secondary">
          {t}
        </span>
      ))}
    </div>
  );
}
