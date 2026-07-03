import { useEffect } from 'react';
import type { ProjectDetail } from '@mediakit/shared';
import { useEditorStore } from './store';
import { EditorTopbar } from './EditorTopbar';
import { PageSidebar } from './PageSidebar';
import { ComponentPanel } from './ComponentPanel';
import { Canvas } from './Canvas';
import { PropertyPanel } from './PropertyPanel';
import { PreviewOverlay } from './preview/PreviewOverlay';
import { useAutosave } from './useAutosave';
import { useEditorKeyboard } from './useEditorKeyboard';

interface EditorProps {
  detail: ProjectDetail;
}

/** 编辑器工作区：顶栏 + 页面栏 + 组件库 + 画布 + 属性面板。 */
export function Editor({ detail }: EditorProps) {
  useEffect(() => {
    useEditorStore.getState().loadProject(detail, detail.name);
  }, [detail]);

  useAutosave();
  useEditorKeyboard();

  // 报告维度主题（品牌色）→ 覆盖 CSS 变量，子树 accent 自动换肤。
  const theme = useEditorStore((s) => s.projectMeta?.theme);
  const themeStyle = {
    ...(theme?.primary ? { '--accent-primary': theme.primary } : {}),
    ...(theme?.secondary ? { '--accent-secondary': theme.secondary } : {}),
    ...(theme?.fontFamily ? { fontFamily: theme.fontFamily } : {}),
  } as React.CSSProperties;

  return (
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
  );
}
