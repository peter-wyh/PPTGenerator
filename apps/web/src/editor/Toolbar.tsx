import { BusinessLibrary } from './components/BusinessLibrary';
import { DatasourceMenu } from './components/DatasourceMenu';

/**
 * 顶栏（精简）：legacy 业务组件下拉 + 数据源。
 * 通用 / 业务组件已移至画布左侧的 ComponentPanel（有机分组）。
 */
export function Toolbar() {
  return (
    <div className="flex h-11 items-center gap-1 border-b border-border-default bg-surface-primary px-3">
      <BusinessLibrary />
      <span className="mx-1 h-4 w-px bg-border-default" />
      <DatasourceMenu />
    </div>
  );
}
