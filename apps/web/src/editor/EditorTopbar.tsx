import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditorStore } from './store';
import { ExportMenu } from './components/ExportMenu';
import { ReportSettingsOverlay } from './components/ReportSettingsOverlay';
import { DataConfigOverlay } from './components/DataConfigOverlay';
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
  const save = useEditorStore((s) => s.save);
  const [showSettings, setShowSettings] = useState(false);
  const [showDataConfig, setShowDataConfig] = useState(false);
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

  return (
    <header className="flex h-12 items-center justify-between border-b border-border-default bg-surface-primary px-3">
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-1 rounded px-2 py-1 text-sm text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary"
          title="返回项目列表"
        >
          ← 返回
        </button>
        <span className="h-4 w-px bg-border-default" />
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="w-56 rounded px-1.5 py-0.5 text-sm text-foreground-primary outline-none hover:bg-surface-hover focus:bg-surface-hover"
        />
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
          <span className="text-[11px] text-foreground-muted" title="保存状态">
            {saving ? '保存中…' : dirty ? '未保存' : '已保存'}
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
        <button
          onClick={() => setShowSettings(true)}
          className="rounded px-2 py-1 text-sm text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary"
          title="全局样式设置（风格 / 布局）"
        >
          全局样式设置
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
    </header>
  );
}
