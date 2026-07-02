import type { EditorComponent } from '@mediakit/shared';
import { REGISTRY } from '../registry';
import { useEditorStore } from '../store';
import { resolveData } from '../datasource/resolve';

/** 按 comp.type 分发到 REGISTRY 中注册的组件；若绑定数据源则用解析后的 data 渲染。 */
export function ComponentRenderer({ comp }: { comp: EditorComponent }) {
  const Comp = REGISTRY[comp.type].Component;
  const datasources = useEditorStore((s) => s.datasources);
  const data = resolveData(comp, datasources);
  return <Comp data={data} />;
}
