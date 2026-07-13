import { useEffect, useMemo } from 'react';
import type { ProjectDetail } from '@mediakit/shared';
import { DEFAULT_THEME } from '@mediakit/shared';
import { useEditorStore } from './store';
import { EditorTopbar } from './EditorTopbar';
import { PageSidebar } from './PageSidebar';
import { ComponentPanel } from './ComponentPanel';
import { Canvas } from './Canvas';
import { PropertyPanel } from './property-panel';
import { PreviewOverlay } from './preview/PreviewOverlay';
import { useAutosave } from './useAutosave';
import { useEditorKeyboard } from './useEditorKeyboard';
import { ThemeContext, injectFontLinks } from './theme';
import { ErrorBoundary } from './components/ErrorBoundary';

interface EditorProps {
  detail: ProjectDetail;
  /** 编辑模式：'template' 时 save() 落库到 templates。默认 'project'。 */
  mode?: 'project' | 'template';
}

/** 编辑器工作区：顶栏 + 页面栏 + 组件库 + 画布 + 属性面板。 */
export function Editor({ detail, mode }: EditorProps) {
  useEffect(() => {
    const st = useEditorStore.getState();
    const m = mode ?? 'project';
    // HMR 重挂载 Editor 时，若已是同一项目+同模式且已加载，不要用旧 detail 覆盖正在编辑的内存状态。
    if (st.loaded && st.projectId === detail.id && st.saveMode === m) return;
    useEditorStore.getState().loadProject(detail, detail.name, mode);
  }, [detail, mode]);

  useAutosave();
  useEditorKeyboard();

  // 报告维度主题（品牌色 / 字体 / 密度 / 圆角）→ CSS 变量 + Context 整树换肤。
  const theme = useEditorStore((s) => s.projectMeta?.theme ?? DEFAULT_THEME);

  // 字体 <link> 按需注入 <head>（去重，旧 link 保留）。
  useEffect(() => {
    injectFontLinks(theme);
  }, [theme]);

  // Context 值：chartPalette 供图表组件按 index 取色。
  const ctxValue = useMemo(
    () => ({ chartPalette: theme.color.chartPalette, theme }),
    [theme],
  );

  return (
    <ThemeContext.Provider value={ctxValue}>
      <div className="flex h-full flex-col overflow-hidden">
        <EditorTopbar />
        <div className="flex min-h-0 flex-1">
          <PageSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <ComponentPanel />
            <ErrorBoundary label="画布" compact>
              <Canvas />
            </ErrorBoundary>
          </div>
          <ErrorBoundary label="属性面板" compact>
            <PropertyPanel />
          </ErrorBoundary>
        </div>
        <ErrorBoundary label="预览" compact>
          <PreviewOverlay />
        </ErrorBoundary>
      </div>
    </ThemeContext.Provider>
  );
}
