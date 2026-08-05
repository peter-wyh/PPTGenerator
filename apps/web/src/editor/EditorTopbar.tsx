import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditorStore } from './store';
import { ExportMenu } from './components/ExportMenu';
import { ReportSettingsOverlay } from './components/ReportSettingsOverlay';
import { DataConfigOverlay } from './components/DataConfigOverlay';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { projectsApi } from '@/api/projects';
import { templatesApi } from '@/api/templates';
import { toast } from '@/components/Toast';
import { SCENARIO_LABELS, SCENARIO_SUB_LABELS } from '@/projectsMeta';

/** 顶栏：返回 + 项目名（可编辑）+ meta 标签、撤销/重做、报告设置、预览、导出/分享（M6）。 */
export function EditorTopbar() {
  const navigate = useNavigate();
  const projectName = useEditorStore((s) => s.projectName);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const meta = useEditorStore((s) => s.projectMeta);
  const canUndo = useEditorStore((s) => s.canUndo());
  const canRedo = useEditorStore((s) => s.canRedo());
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const enterPreview = useEditorStore((s) => s.enterPreview);
  const hasPages = useEditorStore((s) => s.pages.length > 0);
  const dirty = useEditorStore((s) => s.dirty);
  const saving = useEditorStore((s) => s.saving);
  const saveError = useEditorStore((s) => s.saveError);
  const save = useEditorStore((s) => s.save);
  const projectId = useEditorStore((s) => s.projectId);
  const canvasWidth = useEditorStore((s) => s.canvasWidth);
  const canvasHeight = useEditorStore((s) => s.canvasHeight);
  const isTemplate = useEditorStore((s) => s.saveMode === 'template');
  const [showSettings, setShowSettings] = useState(false);
  const [showDataConfig, setShowDataConfig] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const hasReportData = useEditorStore((s) => {
    const rd = s.reportData;
    return !!rd.campaign || (rd.creators?.length ?? 0) > 0;
  });

  const metaTags: string[] = [];
  if (meta?.businessLine) metaTags.push(meta.businessLine);
  if (meta?.creator) metaTags.push(meta.creator);
  if (meta?.advertiser) metaTags.push(meta.advertiser);
  if (meta?.scenario)
    metaTags.push(SCENARIO_LABELS[meta.scenario] + (meta.scenarioSub ? `·${SCENARIO_SUB_LABELS[meta.scenarioSub]}` : ''));

  const handleBack = () => {
    if (useEditorStore.getState().dirty) {
      if (!window.confirm('有未保存的更改，确定离开吗？')) return;
    }
    navigate(isTemplate ? '/templates' : '/projects');
  };

  async function handleEdit(values: { name: string; width: number; height: number; meta: import('@mediakit/shared').ProjectMeta }) {
    if (!projectId) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      if (isTemplate) {
        await templatesApi.update(projectId, values);
      } else {
        await projectsApi.update(projectId, values);
      }
      // 更新 store 中的 name/meta
      useEditorStore.getState().setProjectName(values.name);
      useEditorStore.setState({ projectMeta: values.meta });
      if (values.width !== canvasWidth || values.height !== canvasHeight) {
        useEditorStore.setState({ canvasWidth: values.width, canvasHeight: values.height });
      }
      setShowEdit(false);
      toast.success(isTemplate ? '模板信息已更新' : '报告信息已更新');
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      console.error('[handleEdit] 保存失败:', err);
      const msg =
        e?.response?.data?.message ??
        e?.response?.data?.error?.message ??
        e?.message ??
        '保存失败，请重试';
      setEditError(typeof msg === 'string' ? msg : '保存失败，请重试');
    } finally {
      setEditSubmitting(false);
    }
  }

  return (
    <header className="flex h-12 items-center justify-between border-b border-border-default bg-surface-primary px-3">
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={handleBack}
          className="flex items-center gap-1 rounded px-2 py-1 text-sm text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary"
          title={isTemplate ? '返回模板列表' : '返回报告列表'}
        >
          ← 返回
        </button>
        <span className="h-4 w-px bg-border-default" />
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="w-56 rounded px-1.5 py-0.5 text-sm text-foreground-primary outline-none hover:bg-surface-hover focus:bg-surface-hover"
        />
        {isTemplate && (
          <span className="rounded bg-accent-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-primary">
            模板
          </span>
        )}
        {metaTags.map((t, i) => (
          <span
            key={i}
            className="hidden rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-secondary md:inline"
          >
            {t}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => undo()}
          disabled={!canUndo}
          className="rounded px-2 py-1 text-sm text-foreground-secondary hover:bg-surface-hover disabled:opacity-40"
          title="撤销 (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          onClick={() => redo()}
          disabled={!canRedo}
          className="rounded px-2 py-1 text-sm text-foreground-secondary hover:bg-surface-hover disabled:opacity-40"
          title="重做 (Ctrl+Shift+Z)"
        >
          ↷
        </button>
        <span className="mx-1 h-4 w-px bg-border-default" />
        <div className="flex items-center gap-1.5">
          <span
            className="text-[11px] text-foreground-muted"
            title={saveError ? `保存失败: ${saveError}` : '保存状态'}
            style={saveError ? { color: 'var(--red)' } : undefined}
          >
            {saving
              ? '保存中…'
              : saveError
                ? '保存失败'
                : dirty
                  ? '未保存'
                  : '已保存'}
          </span>
          <button
            onClick={() => void save()}
            disabled={!dirty || saving}
            className="rounded border border-accent-primary bg-accent-primary px-2 py-1 text-sm text-white hover:opacity-90 disabled:border-border-default disabled:bg-transparent disabled:text-foreground-muted"
            title="保存 (Ctrl/Cmd+S)"
          >
            保存
          </button>
        </div>
        <span className="mx-1 h-4 w-px bg-border-default" />
        {!isTemplate && (
          <button
            onClick={() => setShowDataConfig(true)}
            className={
              hasReportData
                ? 'rounded px-2 py-1 text-sm text-accent-primary hover:bg-surface-hover'
                : 'rounded px-2 py-1 text-sm text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary'
            }
            title="配置 Campaign 和达人数据"
          >
            数据配置{hasReportData ? ' ●' : ''}
          </button>
        )}
        <button
          onClick={() => { setEditError(null); setShowEdit(true); }}
          className="rounded px-2 py-1 text-sm text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary"
          title={isTemplate ? '编辑模板信息（名称 / 尺寸 / 场景 / 业务线）' : '编辑报告信息（名称 / 尺寸 / 场景 / 业务线）'}
        >
          编辑
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className={
            (meta?.headerConfig?.enabled || meta?.footerConfig?.enabled)
              ? 'rounded px-2 py-1 text-sm text-accent-primary hover:bg-surface-hover'
              : 'rounded px-2 py-1 text-sm text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary'
          }
          title="全局样式设置（风格 / 布局 / 页眉页脚）"
        >
          全局样式设置{(meta?.headerConfig?.enabled || meta?.footerConfig?.enabled) ? ' ●' : ''}
        </button>
        <button
          onClick={() => enterPreview()}
          disabled={!hasPages}
          className="rounded px-2 py-1 text-sm text-foreground-secondary hover:bg-surface-hover disabled:opacity-40"
          title="预览 (←/→ 翻页, Esc 关闭)"
        >
          预览
        </button>
        <ExportMenu />
      </div>
      {showSettings && <ReportSettingsOverlay onClose={() => setShowSettings(false)} />}
      {showDataConfig && <DataConfigOverlay onClose={() => setShowDataConfig(false)} />}
      {showEdit && (
        <CreateProjectDialog
          open={showEdit}
          loading={editSubmitting}
          error={editError}
          title={isTemplate ? '编辑模板' : '编辑报告'}
          submitLabel="保存"
          lockScenario
          initial={{
            name: projectName,
            width: canvasWidth,
            height: canvasHeight,
            meta: meta ?? undefined,
          }}
          onCancel={() => !editSubmitting && setShowEdit(false)}
          onSubmit={handleEdit}
        />
      )}
    </header>
  );
}
