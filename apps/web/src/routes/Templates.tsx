import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { templatesApi } from '@/api/templates';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  TemplateFormDialog,
  type TemplateFormInitial,
  type TemplateFormValues,
} from '@/components/TemplateFormDialog';
import { BUSINESS_LINES, SCENARIOS, SCENARIO_LABELS, SCENARIO_SUB_LABELS, TEMPLATE_TYPES, TEMPLATE_TYPE_LABELS } from '@/projectsMeta';
import type { ProjectMeta, Scenario, TemplateStatus, TemplateSummary } from '@mediakit/shared';

/** 模板管理（管理后台）：仅 ADMIN 可见。列表 / 筛选 / 新建 / 编辑 / 发布·取消 / 复制 / 删除。 */
export function Templates() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // 新建
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // 编辑
  const [editing, setEditing] = useState<TemplateSummary | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // 删除
  const [pendingDelete, setPendingDelete] = useState<TemplateSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 发布/取消发布进行中的 id
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // 筛选
  const [filterStatus, setFilterStatus] = useState<TemplateStatus | ''>('');
  const [filterBL, setFilterBL] = useState<string>('');
  const [filterScenario, setFilterScenario] = useState<Scenario | ''>('');
  const [filterTemplateType, setFilterTemplateType] = useState<string>('');

  // 非 ADMIN 重定向回项目列表。
  if (user && user.role !== 'ADMIN') {
    return <Navigate to="/projects" replace />;
  }

  const filtered = templates.filter(
    (t) =>
      (!filterStatus || t.status === filterStatus) &&
      (!filterBL || t.meta?.businessLine === filterBL) &&
      (!filterScenario || t.meta?.scenario === filterScenario) &&
      (!filterTemplateType || t.meta?.templateType === filterTemplateType),
  );

  async function refresh() {
    setLoading(true);
    try {
      setTemplates(await templatesApi.list());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreate(values: TemplateFormValues) {
    setCreating(true);
    setCreateError(null);
    try {
      const t = await templatesApi.create({
        name: values.name,
        width: values.width,
        height: values.height,
        meta: values.meta,
        note: values.note,
      });
      setShowCreate(false);
      navigate(`/templates/${t.id}`);
    } catch {
      setCreateError('创建失败，请重试');
    } finally {
      setCreating(false);
    }
  }

  async function handleEdit(values: TemplateFormValues) {
    if (!editing) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      const updated = await templatesApi.update(editing.id, {
        name: values.name,
        width: values.width,
        height: values.height,
        meta: values.meta,
        note: values.note ?? null,
        status: values.status,
      });
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editing.id
            ? {
                ...t,
                name: updated.name,
                width: updated.width,
                height: updated.height,
                meta: updated.meta,
                status: updated.status,
                note: updated.note,
              }
            : t,
        ),
      );
      setEditing(null);
    } catch {
      setEditError('保存失败，请重试');
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleToggleStatus(t: TemplateSummary) {
    const next: TemplateStatus = t.status === 'DRAFT' ? 'PUBLISHED' : 'DRAFT';
    setTogglingId(t.id);
    try {
      const updated = await templatesApi.setStatus(t.id, next);
      setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: updated.status } : x)));
    } catch {
      /* 失败静默；可按需加 toast */
    } finally {
      setTogglingId(null);
    }
  }

  async function handleSetDefault(t: TemplateSummary, value: boolean) {
    setTogglingId(t.id);
    try {
      const updated = await templatesApi.setDefault(t.id, value);
      setTemplates((prev) =>
        prev.map((x) => {
          if (x.id === t.id) return { ...x, meta: updated.meta };
          // 设为默认时,服务端已清同格其它默认;本地同步清掉它们的徽标,避免重影。
          if (
            value &&
            x.meta?.businessLine === t.meta?.businessLine &&
            x.meta?.scenario === t.meta?.scenario &&
            x.meta?.templateType === t.meta?.templateType
          ) {
            return { ...x, meta: { ...x.meta, isDefault: false } };
          }
          return x;
        }),
      );
    } catch {
      /* 失败静默 */
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDuplicate(t: TemplateSummary) {
    try {
      await templatesApi.duplicate(t.id);
      await refresh();
    } catch {
      /* 复制失败静默 */
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await templatesApi.remove(pendingDelete.id);
      setTemplates((prev) => prev.filter((t) => t.id !== pendingDelete.id));
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* 左侧侧栏 */}
      <aside className="flex w-52 shrink-0 flex-col border-r border-border-default bg-surface-primary">
        <div className="px-4 py-4">
          <h1 className="font-headings text-lg font-semibold text-foreground-primary">模板管理</h1>
          <p className="mt-0.5 text-xs text-foreground-secondary">
            设计师维护模板，发布后可基于模板创建报告。
          </p>
        </div>
        <div className="px-3 pb-3">
          <Button onClick={() => setShowCreate(true)} className="w-full">+ 新建模板</Button>
        </div>

        {/* 筛选器 */}
        <div className="border-t border-border-subtle px-3 py-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-foreground-muted">筛选</p>
          <div className="flex flex-col gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as TemplateStatus | '')}
              className="w-full rounded-md border border-border-default bg-surface-primary px-2 py-1.5 text-xs text-foreground-secondary"
            >
              <option value="">全部状态</option>
              <option value="DRAFT">草稿</option>
              <option value="PUBLISHED">已发布</option>
            </select>
            <select
              value={filterBL}
              onChange={(e) => setFilterBL(e.target.value)}
              className="w-full rounded-md border border-border-default bg-surface-primary px-2 py-1.5 text-xs text-foreground-secondary"
            >
              <option value="">全部业务线</option>
              {BUSINESS_LINES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <select
              value={filterScenario}
              onChange={(e) => {
                const v = e.target.value as Scenario | '';
                setFilterScenario(v);
                if (!v) setFilterTemplateType('');
              }}
              className="w-full rounded-md border border-border-default bg-surface-primary px-2 py-1.5 text-xs text-foreground-secondary"
            >
              <option value="">全部场景</option>
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            {filterScenario && (
              <select
                value={filterTemplateType}
                onChange={(e) => setFilterTemplateType(e.target.value)}
                className="w-full rounded-md border border-border-default bg-surface-primary px-2 py-1.5 text-xs text-foreground-secondary"
              >
                <option value="">全部模版类型</option>
                {TEMPLATE_TYPES[filterScenario].map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            )}
            {(filterStatus || filterBL || filterScenario || filterTemplateType) && (
              <button
                onClick={() => {
                  setFilterStatus('');
                  setFilterBL('');
                  setFilterScenario('');
                  setFilterTemplateType('');
                }}
                className="text-left text-[10px] text-foreground-muted hover:text-foreground-primary"
              >
                ✕ 清除筛选
              </button>
            )}
            <span className="text-[10px] text-foreground-muted">
              {filtered.length} / {templates.length} 个模板
            </span>
          </div>
        </div>
      </aside>

      {/* 右侧内容区 */}
      <main className="min-w-0 flex-1 overflow-auto p-6">
        {loading ? (
          <p className="text-sm text-foreground-muted">加载中…</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-foreground-muted">还没有模板，点击左侧「新建模板」开始吧。</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-foreground-muted">没有符合筛选条件的模板。</p>
        ) : (
          <div className="overflow-auto rounded-lg border border-border-default">
            <table className="w-full min-w-[1000px] border-collapse text-sm">
              <thead>
                <tr className="bg-surface-hover text-left text-xs text-foreground-muted">
                  <th className="px-3 py-2 font-medium">模板名称</th>
                  <th className="px-3 py-2 font-medium">业务线</th>
                  <th className="px-3 py-2 font-medium">场景</th>
                  <th className="px-3 py-2 font-medium">模版类型</th>
                  <th className="px-3 py-2 font-medium">状态</th>
                  <th className="px-3 py-2 font-medium">尺寸</th>
                  <th className="px-3 py-2 font-medium">页数</th>
                  <th className="px-3 py-2 font-medium">备注</th>
                  <th className="px-3 py-2 font-medium">更新时间</th>
                  <th className="px-3 py-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-t border-border-subtle hover:bg-surface-hover/50">
                    <td className="px-3 py-2">
                      <button
                        className="font-medium text-foreground-primary hover:text-accent-primary"
                        onClick={() => navigate(`/templates/${t.id}`)}
                      >
                        {t.name}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-foreground-secondary">{t.meta?.businessLine ?? '—'}</td>
                    <td className="px-3 py-2 text-foreground-secondary">{scenarioText(t.meta)}</td>
                    <td className="px-3 py-2 text-foreground-secondary">
                      {t.meta?.templateType ? (TEMPLATE_TYPE_LABELS[t.meta.templateType] ?? t.meta.templateType) : '—'}
                      {t.meta?.isDefault && (
                        <span className="ml-1 inline-block rounded-full bg-accent-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-primary">
                          默认
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2"><StatusBadge status={t.status} /></td>
                    <td className="px-3 py-2 text-foreground-muted">{t.width}×{t.height}</td>
                    <td className="px-3 py-2 text-foreground-muted">{t.pageCount}</td>
                    <td className="max-w-[180px] truncate px-3 py-2 text-foreground-muted" title={t.note ?? ''}>
                      {t.note ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-foreground-muted">{new Date(t.updatedAt).toLocaleDateString()}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button
                        onClick={() => navigate(`/templates/${t.id}`)}
                        className="mr-1 rounded bg-accent-primary px-2.5 py-1 text-xs font-medium text-foreground-inverse hover:bg-accent-secondary"
                        title="进入可视化编辑器"
                      >
                        可视化编辑
                      </button>
                      <button
                        onClick={() => { setEditError(null); setEditing(t); }}
                        className="rounded px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => void handleToggleStatus(t)}
                        disabled={togglingId === t.id}
                        className="rounded px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary disabled:opacity-50"
                        title={t.status === 'DRAFT' ? '发布：BD 可基于此模板创建项目' : '取消发布'}
                      >
                        {t.status === 'DRAFT' ? '发布' : '取消发布'}
                      </button>
                      {t.status === 'PUBLISHED' && t.meta?.businessLine && t.meta?.scenario && t.meta?.templateType && (
                        <button
                          onClick={() => void handleSetDefault(t, !t.meta?.isDefault)}
                          disabled={togglingId === t.id}
                          className="rounded px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary disabled:opacity-50"
                          title={t.meta?.isDefault ? '取消默认模板' : '设为该业务线×场景×模版类型的默认模板'}
                        >
                          {t.meta?.isDefault ? '取消默认' : '设为默认'}
                        </button>
                      )}
                      <button
                        onClick={() => void handleDuplicate(t)}
                        className="rounded px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary"
                        title="复制模板"
                      >
                        复制
                      </button>
                      <button
                        onClick={() => setPendingDelete(t)}
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
        title="删除模板？"
        description={`「${pendingDelete?.name ?? ''}」将被永久删除，此操作不可撤销。`}
        confirmText="删除"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <TemplateFormDialog
        open={showCreate}
        loading={creating}
        error={createError}
        onCancel={() => !creating && setShowCreate(false)}
        onSubmit={handleCreate}
      />

      <TemplateFormDialog
        open={!!editing}
        loading={editSubmitting}
        error={editError}
        title="编辑模板"
        submitLabel="保存"
        initial={editing ? toInitial(editing) : null}
        onCancel={() => !editSubmitting && setEditing(null)}
        onSubmit={handleEdit}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: TemplateStatus }) {
  const published = status === 'PUBLISHED';
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
        published
          ? 'bg-green/10 text-green'
          : 'bg-surface-hover text-foreground-secondary'
      }`}
    >
      {published ? '已发布' : '草稿'}
    </span>
  );
}

function toInitial(t: TemplateSummary): TemplateFormInitial {
  return {
    name: t.name,
    width: t.width,
    height: t.height,
    businessLine: t.meta?.businessLine,
    scenario: t.meta?.scenario,
    templateType: t.meta?.templateType,
    note: t.note,
    status: t.status,
  };
}

/** 场景列文本：场景 + 子类。 */
function scenarioText(meta?: ProjectMeta): string {
  if (!meta?.scenario) return '—';
  const base = SCENARIO_LABELS[meta.scenario];
  return meta.scenarioSub ? `${base}·${SCENARIO_SUB_LABELS[meta.scenarioSub]}` : base;
}
