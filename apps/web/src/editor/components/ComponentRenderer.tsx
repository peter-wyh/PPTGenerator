import { memo } from 'react';
import type { EditorComponent } from '@mediakit/shared';
import { REGISTRY } from '../registry';

/** 按 comp.type 分发到 REGISTRY 中注册的组件，直接用 comp.data 渲染。
 *  memo 阻断：当父级 CanvasComponent 仅因 selected 变化而重渲染时，
 *  comp 引用不变 → 跳过实际组件内容渲染。
 */
export const ComponentRenderer = memo(function ComponentRenderer({
  comp,
}: {
  comp: EditorComponent;
}) {
  const Comp = REGISTRY[comp.type].Component;
  return <Comp data={comp.data} />;
});
