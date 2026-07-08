import { useEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { ProjectDetail } from '@mediakit/shared';
import { DEFAULT_THEME } from '@mediakit/shared';
import { useEditorStore } from './store';
import { EditorTopbar } from './EditorTopbar';
import { PageSidebar } from './PageSidebar';
import { ComponentPanel } from './ComponentPanel';
import { Canvas } from './Canvas';
import { PropertyPanel } from './PropertyPanel';
import { PreviewOverlay } from './preview/PreviewOverlay';
import { useAutosave } from './useAutosave';
import { useEditorKeyboard } from './useEditorKeyboard';
import { ThemeContext, injectFontLinks, themeToCssVars } from './theme';

interface EditorProps {
  detail: ProjectDetail;
  /** 编辑模式：'template' 时 save() 落库到 templates。默认 'project'。 */
  mode?: 'project' | 'template';
}

/** 编辑器工作区：顶栏 + 页面栏 + 组件库 + 画布 + 属性面板。 */
export function Editor({ detail, mode }: EditorProps) {
  useEffect(() => {
    useEditorStore.getState().loadProject(detail, detail.name, mode);
  }, [detail, mode]);

  useAutosave();
  useEditorKeyboard();

  // 报告维度主题（品牌色 / 字体 / 密度 / 圆角）→ CSS 变量 + Context 整树换肤。
  const theme = useEditorStore((s) => s.projectMeta?.theme ?? DEFAULT_THEME);

  // 派生 CSS 变量（颜色/字体/圆角/间距），挂在根节点。
  const themeStyle = useMemo<CSSProperties>(() => themeToCssVars(theme), [theme]);

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
      <div className="flex h-full flex-col overflow-hidden" style={themeStyle}>
        <EditorTopbar />
        <div className="flex min-h-0 flex-1">
          <PageSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <ComponentPanel />
            <Canvas />
          </div>
          <PropertyPanel />
        </div>
        <PreviewOverlay />
      </div>
    </ThemeContext.Provider>
  );
}
