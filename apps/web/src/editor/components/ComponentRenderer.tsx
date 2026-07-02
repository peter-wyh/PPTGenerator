import type { EditorComponent } from '@mediakit/shared';
import { REGISTRY } from '../registry';

/** 按 comp.type 分发到 REGISTRY 中注册的组件。 */
export function ComponentRenderer({ comp }: { comp: EditorComponent }) {
  const Comp = REGISTRY[comp.type].Component;
  return <Comp data={comp.data} />;
}
