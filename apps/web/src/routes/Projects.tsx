import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProjectSummary } from '@mediakit/shared';
import { projectsApi } from '@/api/projects';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  // 删除确认
  const [pendingDelete, setPendingDelete] = useState<ProjectSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 改名内联
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const p = await projectsApi.create(name);
      setNewName('');
      navigate(`/projects/${p.id}`);
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
      </div>

      <form onSubmit={handleCreate} className="mt-4 flex gap-2">
        <Input
          name="newName"
          placeholder="新项目名称"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button type="submit" loading={creating}>
          新建
        </Button>
      </form>

      {loading ? (
        <p className="mt-8 text-sm text-foreground-muted">加载中…</p>
      ) : projects.length === 0 ? (
        <p className="mt-8 text-sm text-foreground-muted">还没有项目，新建一个开始吧。</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {projects.map((p) => (
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
    </div>
  );
}
