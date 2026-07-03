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

  return (
    <div className="flex h-full flex-col overflow-hidden">
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
