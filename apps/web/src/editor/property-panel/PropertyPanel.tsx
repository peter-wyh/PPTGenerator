import { useEditorStore } from '../store';
import { GEOMETRY_FIELDS, REGISTRY, type PropertyField } from '../registry';
import { Button } from '@/components/Button';
import { pageCategory } from '@mediakit/shared';
import { LABELS } from './constants';
import { FieldGroup, VariantSelector } from './helpers';
import { PageProperties } from './PageProperties';
import { MultiSelectPanel } from './MultiSelectPanel';
import { DataSourceSection } from './DataSourceSection';
import {
  ReportCreatorFanGenderImporter,
  ReportCreatorFanAgeImporter,
  CreatorLinkImporter,
  KpiImportButton,
} from './importers';
import {
  FieldEditor,
  KpiCompareLabelField,
  NumberField,
  TitleBlockFontSizeField,
} from './fields';
import {
  BusinessFields,
  CreatorStatsFields,
  CreatorAudienceProfileFields,
  KpiRowStyleField,
  KpiBoardFields,
  WorkScreenshotFields,
  StrategyBlockFields,
  ImageGroupFields,
  WorkMetricsFields,
  CommentWordcloudFields,
  ShapeFields,
} from './custom-fields';

/**
 * 标题块:序号/主色/底部分割线 三个字段按当前样式变体显隐(联动)。
 * 未列出的变体回退到空(三者皆隐)。text/subtitle/fontSize 始终显示。
 */
const TITLE_BLOCK_FIELDS_BY_VARIANT: Record<string, ('index' | 'color' | 'divider')[]> = {
  plain: ['divider'],
  'bar-left': ['color', 'divider'],
  underline: ['color'],
  gradient: ['color'],
  card: ['divider'],
  numbered: ['index', 'color', 'divider'],
  highlight: ['color'],
  'accent-tag': ['index', 'color'],
  'accent-underline': ['color'],
  'block-underline': ['divider'],  // 色块颜色跟标题颜色走，无需独立 color 字段
};

export function PropertyPanel() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const comp = useEditorStore((s) => {
    if (selectedIds.length !== 1) return null;
    return s.currentComponents().find((c) => c.id === selectedIds[0]) ?? null;
  });
  const currentPage = useEditorStore((s) => s.pages.find((p) => p.id === s.currentPageId));
  const restoreReportTitle = useEditorStore((s) => s.restoreReportTitle);

  if (selectedIds.length > 1) {
    return <MultiSelectPanel ids={selectedIds} />;
  }

  if (!comp) {
    return <PageProperties />;
  }

  const def = REGISTRY[comp.type];

  // 当前激活变体定义（用于图标门控）。
  const activeVariant = (() => {
    const vs = def.variants;
    if (!vs || vs.length === 0) return undefined;
    const currentId = (comp.data as { variant?: string }).variant ?? vs[0].id;
    return vs.find((v) => v.id === currentId);
  })();

  // 变体声明了 icon 即注入一个 icon 字段（不放进 registry.propertySchema，保持通用）。
  const fields: PropertyField[] = [...def.propertySchema];
  // kpi-board 用自定义 KpiBoardFields 取代通用表格编辑器，避免两套行编辑器并存。
  if (comp.type === 'kpi-board') {
    const filtered = fields.filter((f) => f.kind !== 'table');
    fields.length = 0;
    fields.push(...filtered);
  }
  // title-block:按当前变体显隐 index/color/divider(联动)。
  if (comp.type === 'title-block') {
    const v = (comp.data as { variant?: string }).variant ?? 'bar-left';
    const allowed = new Set<string>(TITLE_BLOCK_FIELDS_BY_VARIANT[v] ?? []);
    const conditional = new Set(['index', 'color', 'divider']);
    for (let i = fields.length - 1; i >= 0; i--) {
      if (conditional.has(fields[i].key) && !allowed.has(fields[i].key)) fields.splice(i, 1);
    }
  }
  if (activeVariant?.icon) {
    fields.push({ key: 'icon', label: '图标', kind: 'icon' });
  }

  return (
    <div className="flex h-full w-[300px] flex-col gap-4 overflow-auto border-l border-border-default bg-surface-primary p-4">
      <div className="font-headings text-sm font-semibold text-foreground-primary">
        {LABELS[comp.type] ?? comp.type}
      </div>

      {pageCategory(currentPage?.pageType ?? 'blank') === 'media-report' &&
        currentPage?.titleComponentId === comp.id &&
        currentPage?.titleOverridden && (
          <button
            onClick={() => restoreReportTitle(currentPage.id)}
            className="rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            🔄 恢复自动标题
          </button>
        )}

      {/* ── ① 位置与尺寸 ── */}
      <FieldGroup title="📐 位置与尺寸">
        <div className="grid grid-cols-2 gap-2">
          {GEOMETRY_FIELDS.map((f) => (
            <NumberField key={f.key} comp={comp} field={f} />
          ))}
        </div>
      </FieldGroup>

      {/* ── ② 数据来源（有 dataSource 配置时显示）── */}
      {def.dataSource && (
        <DataSourceSection comp={comp} config={def.dataSource} />
      )}

      {/* ── ③ 样式（变体 + 图标）── */}
      {def.variants && def.variants.length > 0 && comp.type !== 'work-screenshot' && (
        <FieldGroup title="🎨 样式">
          <VariantSelector comp={comp} variants={def.variants} />
        </FieldGroup>
      )}

      {/* ── ④ 内容（字段编辑 + 自定义字段）── */}
      <FieldGroup title="✏️ 内容">
        {fields.map((f) =>
          // title-block 字号:用专用字段回显「全局字号 / 单组件覆盖」,避免落到 0。
          comp.type === 'title-block' && f.key === 'fontSize' ? (
            <TitleBlockFontSizeField key="fontSize" comp={comp} />
          ) : (
            <FieldEditor key={f.key + f.kind} comp={comp} field={f} />
          ),
        )}
        {fields.length === 0 && (def.variants?.length ?? 0) === 0 && (
          <p className="text-xs text-foreground-muted">该组件无可编辑属性。</p>
        )}
      </FieldGroup>

      {comp.type === 'creator-avatar-card' && <CreatorLinkImporter comp={comp} />}
      {comp.type === 'business-block' && <BusinessFields comp={comp} />}
      {comp.type === 'creator-stats-strip' && <CreatorStatsFields comp={comp} />}
      {comp.type === 'creator-audience-profile' && <CreatorAudienceProfileFields comp={comp} />}
      {comp.type === 'creator-fan-gender' && <ReportCreatorFanGenderImporter comp={comp} />}
      {comp.type === 'creator-fan-age' && <ReportCreatorFanAgeImporter comp={comp} />}
      {comp.type === 'kpi-board' && <KpiImportButton comp={comp} />}
      {comp.type === 'kpi-board' && <KpiCompareLabelField comp={comp} />}
      {comp.type === 'kpi-board' && <KpiRowStyleField comp={comp} />}
      {comp.type === 'kpi-board' && <KpiBoardFields comp={comp} />}
      {comp.type === 'work-screenshot' && <WorkScreenshotFields comp={comp} />}
      {comp.type === 'work-metrics' && <WorkMetricsFields comp={comp} />}
      {comp.type === 'comment-wordcloud' && <CommentWordcloudFields comp={comp} />}
      {comp.type === 'shape' && <ShapeFields comp={comp} />}
      {comp.type === 'image-group' && <ImageGroupFields comp={comp} />}
      {comp.type === 'strategy-block' && <StrategyBlockFields comp={comp} />}

      <div className="mt-auto border-t border-border-subtle pt-3">
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            useEditorStore.getState().select(comp.id);
            useEditorStore.getState().deleteSelected();
          }}
        >
          删除组件
        </Button>
      </div>
    </div>
  );
}
