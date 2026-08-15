import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { schemesApi } from '@/api/schemesApi';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  SchemeFormDialog,
  toCreateInput,
  toFormInitial,
  toUpdateInput,
  type SchemeFormValues,
} from '@/components/SchemeFormDialog';

import { STYLE_PRESETS, type ReportScheme } from '@mediakit/shared';
import { toast } from '../components/Toast';
import { useBusinessLineCodes } from '@/editor/useBusinessLineLogo';

/** 风格预设 key → 名称查找表。 */
const PRESET_LABEL: Record<string, string> = Object.fromEntries(
  STYLE_PRESETS.map((p) => [p.key, p.name]),
);

/** 方案管理页面（管理后台）：仅 ADMIN 可见。列表 / 筛选 / 新建 / 编辑 / 启停 / 删除。 */
export function SchemesPage() {
  const user = useAuthStore((s) => s.user);

  const BUSINESS_LINES = useBusinessLineCodes(); // 数据库唯一来源

  const [schemes, setSchemes] = useState<ReportScheme[]>([]);
  const [loading, setLoading] = useState(true);

  // 新建
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // 编辑
  const [editing, setEditing] = useState<ReportScheme | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // 删除
  const [pendingDelete, setPendingDelete] = useState<ReportScheme | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 启停进行中
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // 筛选
  const [filterBL, setFilterBL] = useState<string>('');
  const [filterEnabled, setFilterEnabled] = useState<'' | 'true' | 'false'>('');

  // 非 ADMIN 重定向。
  if (user && user.role !== 'ADMIN') {
    return <Navigate to="/projects" replace />;
  }

  async function refresh() {
    setLoading(true);
    try {
      setSchemes(await schemesApi.list());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreate(values: SchemeFormValues) {
    setCreating(true);
    setCreateError(null);
    try {
      await schemesApi.create(toCreateInput(values));
      setShowCreate(false);
      await refresh();
    } catch {
      setCreateError('创建失败，请检查 code 是否已存在');
    } finally {
      setCreating(false);
    }
  }

  async function handleEdit(values: SchemeFormValues) {
    if (!editing) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      await schemesApi.update(editing.id, toUpdateInput(values));
      setEditing(null);
      await refresh();
    } catch {
      setEditError('保存失败，请检查 code 是否已存在');
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleToggleEnabled(s: ReportScheme) {
    setTogglingId(s.id);
    try {
      const updated = await schemesApi.update(s.id, { enabled: !s.enabled });
      setSchemes((prev) => prev.map((x) => (x.id === s.id ? updated : x)));
    } catch {
      toast.error('操作失败');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await schemesApi.remove(pendingDelete.id);
      setSchemes((prev) => prev.filter((s) => s.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch {
      toast.error('删除失败');
    } finally {
      setDeleting(false);
    }
  }

  const filtered = schemes.filter(
    (s) =>
      (!filterBL || s.businessLineCode === filterBL) &&
      (filterEnabled === '' || String(s.enabled) === filterEnabled),
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* 左侧侧栏 */}
      <aside className="flex w-52 shrink-0 flex-col border-r border-border-default bg-surface-primary">
        <div className="px-4 py-4">
          <h1 className="font-headings text-lg font-semibold text-foreground-primary">报告方案</h1>
          <p className="mt-0.5 text-xs text-foreground-secondary">
            可扩展的报告类型目录，用于驱动报告创建入口与默认配置。
          </p>
        </div>
        <div className="px-3 pb-3">
          <Button onClick={() => setShowCreate(true)} className="w-full">
            + 新建方案
          </Button>
        </div>

        {/* 筛选器 */}
        <div className="border-t border-border-subtle px-3 py-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-foreground-muted">
            筛选
          </p>
          <div className="flex flex-col gap-2">
            <select
              value={filterBL}
              onChange={(e) => setFilterBL(e.target.value)}
              className="w-full rounded-md border border-border-default bg-surface-primary px-2 py-1.5 text-xs text-foreground-secondary"
            >
              <option value="">全部业务线</option>
              {BUSINESS_LINES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <select
              value={filterEnabled}
              onChange={(e) => setFilterEnabled(e.target.value as '' | 'true' | 'false')}
              className="w-full rounded-md border border-border-default bg-surface-primary px-2 py-1.5 text-xs text-foreground-secondary"
            >
              <option value="">全部状态</option>
              <option value="true">已启用</option>
              <option value="false">已停用</option>
            </select>
            {(filterBL || filterEnabled) && (
              <button
                onClick={() => {
                  setFilterBL('');
                  setFilterEnabled('');
                }}
                className="text-left text-[10px] text-foreground-muted hover:text-foreground-primary"
              >
                ✕ 清除筛选
              </button>
            )}
            <span className="text-[10px] text-foreground-muted">
              {filtered.length} / {schemes.length} 个方案
            </span>
          </div>
        </div>
      </aside>

      {/* 右侧内容区 */}
      <main className="min-w-0 flex-1 overflow-auto p-6">
        {loading ? (
          <p className="text-sm text-foreground-muted">加载中…</p>
        ) : schemes.length === 0 ? (
          <p className="text-sm text-foreground-muted">还没有方案，点击左侧「新建方案」开始吧。</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-foreground-muted">没有符合筛选条件的方案。</p>
        ) : (
          <div className="overflow-auto rounded-lg border border-border-default">
            <table className="w-full min-w-[960px] border-collapse text-sm">
              <thead>
                <tr className="bg-surface-hover text-left text-xs text-foreground-muted">
                  <th className="px-3 py-2 font-medium">编码</th>
                  <th className="px-3 py-2 font-medium">名称</th>
                  <th className="px-3 py-2 font-medium">业务线</th>
                  <th className="px-3 py-2 font-medium">页数</th>
                  <th className="px-3 py-2 font-medium">默认风格</th>
                  <th className="px-3 py-2 font-medium">排序</th>
                  <th className="px-3 py-2 font-medium">状态</th>
                  <th className="px-3 py-2 font-medium">更新时间</th>
                  <th className="px-3 py-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-t border-border-subtle hover:bg-surface-hover/50">
                    <td className="px-3 py-2 font-mono text-xs text-foreground-secondary">{s.code}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground-primary">{s.name}</div>
                      {s.description && (
                        <div className="max-w-[280px] truncate text-xs text-foreground-muted" title={s.description}>
                          {s.description}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-foreground-secondary">
                      {s.businessLineCode ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-foreground-muted">{s.pageCount}</td>
                    <td className="px-3 py-2 text-foreground-secondary">
                      {s.defaultStyle ? PRESET_LABEL[s.defaultStyle] ?? s.defaultStyle : '—'}
                    </td>
                    <td className="px-3 py-2 text-foreground-muted">{s.sortOrder}</td>
                    <td className="px-3 py-2">
                      <EnabledBadge enabled={s.enabled} />
                    </td>
                    <td className="px-3 py-2 text-foreground-muted">
                      {new Date(s.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button
                        onClick={() => {
                          setEditError(null);
                          setEditing(s);
                        }}
                        className="rounded px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => void handleToggleEnabled(s)}
                        disabled={togglingId === s.id}
                        className="rounded px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary disabled:opacity-50"
                      >
                        {s.enabled ? '停用' : '启用'}
                      </button>
                      <button
                        onClick={() => setPendingDelete(s)}
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
        title="删除方案？"
        description={`「${pendingDelete?.name ?? ''}」（${pendingDelete?.code ?? ''}）将被永久删除，此操作不可撤销。`}
        confirmText="删除"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <SchemeFormDialog
        open={showCreate}
        loading={creating}
        error={createError}
        onCancel={() => !creating && setShowCreate(false)}
        onSubmit={handleCreate}
      />

      <SchemeFormDialog
        open={!!editing}
        loading={editSubmitting}
        error={editError}
        title="编辑方案"
        submitLabel="保存"
        initial={editing ? toFormInitial(editing) : null}
        onCancel={() => !editSubmitting && setEditing(null)}
        onSubmit={handleEdit}
      />
    </div>
  );
}

function EnabledBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
        enabled ? 'bg-green/10 text-green' : 'bg-surface-hover text-foreground-secondary'
      }`}
    >
      {enabled ? '已启用' : '已停用'}
    </span>
  );
}
