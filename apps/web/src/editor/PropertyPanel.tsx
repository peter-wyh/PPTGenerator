import { useEffect, useRef, useState } from 'react';
import type {
  CommentWordcloudData,
  CreatorAvatarCardData,
  EditorComponent,
  ComponentData,
  CreatorStatItem,
  CreatorStatsStripData,
  ImageGroupData,
  KpiBoardData,
  KpiColorToken,
  Page,
  PageGradient,
  GradientStop,
  Sentiment,
  ShapeData,
  ShapeKind,
  StrategyBlockData,
  WorkMetricsData,
  WorkScreenshotData,
} from '@mediakit/shared';
import { CREATOR_METRIC_CATALOG } from '@mediakit/shared';
import { useEditorStore } from './store';
import { backgroundType, buildBackgroundTypePatch, type BackgroundType } from './background';
import { GEOMETRY_FIELDS, REGISTRY, type PropertyField, type VariantOption } from './registry';
import type { Alignment } from './store';
import { getStyleOptions, type VariantId } from './business/catalog';
import { Button } from '@/components/Button';
import { ImageInput } from '@/components/ImageInput';
import { parseCreatorLink } from './creatorLink';
import { IconPickerOverlay, ICON_WEIGHT_OPTIONS } from './icons/IconPickerOverlay';
import { findIcon } from './icons/catalog';
import { sanitizeRichText } from './richText';
import { KPI_COLOR_OPTIONS, KPI_COLOR_TOKENS } from './kpiTokens';
import { IconKit } from './icons/IconKit';
import type { IconWeight } from '@mediakit/shared';
import { ImportDataModal } from './components/ImportDataModal';
import { ImportCampaignModal } from './components/ImportCampaignModal';
import { metricsToRows } from './campaignMetrics';
import type { ChartData } from './datasource/resolve';
import { parseFile } from './datasource/parse';

/** 读取组件某字段值（data 字段 vs 几何字段）。 */
function readValue(comp: EditorComponent, field: PropertyField): unknown {
  if (field.inData === false) {
    return (comp as unknown as Record<string, unknown>)[field.key];
  }
  return (comp.data as unknown as Record<string, unknown>)[field.key];
}

export function PropertyPanel() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const comp = useEditorStore((s) => {
    if (selectedIds.length !== 1) return null;
    return s.currentComponents().find((c) => c.id === selectedIds[0]) ?? null;
  });

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
  if (activeVariant?.icon) {
    fields.push({ key: 'icon', label: '图标', kind: 'icon' });
  }

  return (
    <div className="flex h-full w-[300px] flex-col gap-4 overflow-auto border-l border-border-default bg-surface-primary p-4">
      <div className="font-headings text-sm font-semibold text-foreground-primary">
        {LABELS[comp.type] ?? comp.type}
      </div>

      {(comp.type === 'bar-chart' ||
        comp.type === 'line-chart' ||
        comp.type === 'pie-chart') && <ChartImportButton comp={comp} />}

      {comp.type === 'kpi-board' && (
        <>
          <KpiImportButton comp={comp} />
          <ImportCampaignButton comp={comp} />
        </>
      )}

      {comp.type === 'creator-avatar-card' && <ReportCreatorAvatarImporter comp={comp} />}
      {comp.type === 'creator-avatar-card' && <CreatorLinkImporter comp={comp} />}
      {comp.type === 'creator-list' && <ReportCreatorListImporter comp={comp} />}
      {comp.type === 'creator-works-list' && <ReportCreatorWorksImporter comp={comp} />}

      <FieldGroup title="位置与尺寸">
        <div className="grid grid-cols-2 gap-2">
          {GEOMETRY_FIELDS.map((f) => (
            <NumberField key={f.key} comp={comp} field={f} />
          ))}
        </div>
      </FieldGroup>

      <FieldGroup title="属性">
        {def.variants && def.variants.length > 0 && (
          <VariantSelector comp={comp} variants={def.variants} />
        )}
        {fields.map((f) => (
          <FieldEditor key={f.key + f.kind} comp={comp} field={f} />
        ))}
        {fields.length === 0 && (def.variants?.length ?? 0) === 0 && (
          <p className="text-xs text-foreground-muted">该组件无可编辑属性。</p>
        )}
      </FieldGroup>

      {comp.type === 'business-block' && <BusinessFields comp={comp} />}

      {comp.type === 'creator-stats-strip' && <ReportCreatorStatsImporter comp={comp} />}
      {comp.type === 'creator-stats-strip' && <CreatorStatsFields comp={comp} />}

      {comp.type === 'kpi-board' && <KpiRowStyleField comp={comp} />}

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

const LABELS: Record<string, string> = {
  text: '文本',
  image: '图片',
  'indicator-card': '指标卡',
  'bar-chart': '柱状图',
  'line-chart': '折线图',
  'pie-chart': '饼图',
  table: '表格',
  'business-block': '业务组件',
  'strategy-block': '策略块',
  'meta-strip': '基础信息',
  'creator-avatar-card': '达人头像卡',
  'creator-stats-strip': '达人数据条',
  'creator-works-list': '达人作品列表',
  'creator-list': '达人列表',
  'creator-fan-gender': '性别占比',
  'creator-fan-city': '城市分布',
  'creator-fan-age': '年龄段',
  'creator-fan-interest': '兴趣标签',
  'brand-wall': '品牌墙',
  'package-card': '套餐卡',
  'kpi-board': '业绩看板',
  'timeline-compare': '周期对比表',
  'product-performance': '商品表现',
  'placement-display': '广告位展示',
  'post-list': 'Post 列表',
  'work-screenshot': '作品截图',
  'work-metrics': '作品数据',
  'comment-wordcloud': '评论词云',
  'shape': '图形',
  'image-group': '组图',
};

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/* ------------------------------ 页面属性 ------------------------------ */
// 未选中组件时展示：页面名 + 背景色/图（页面维度编辑）。

function PageProperties() {
  const page = useEditorStore((s) => s.currentPage());
  const updatePage = useEditorStore((s) => s.updatePage);
  const patchPageLive = useEditorStore((s) => s.patchPageLive);

  // 本地 state 缓冲：色板拖动/文本输入时实时更新视觉，但只在 onBlur 时落 history。
  // 避免拖动一次选色器推几十次 history 快照、清空 redo 栈。
  const [bgColorDraft, setBgColorDraft] = useState<string>(page?.bgColor ?? '');
  const [nameDraft, setNameDraft] = useState<string>(page?.name ?? '');
  // 背景类型派生自数据（撤销/重做后立即同步）；imagePending 仅覆盖「选了图片但还没给 URL」这一瞬态，
  // 让「图片」chip 保持高亮、显示 ImageInput。
  const [imagePending, setImagePending] = useState(false);

  // 切换页面时把本地缓冲同步成最新 store 值。
  useEffect(() => {
    setBgColorDraft(page?.bgColor ?? '');
    setNameDraft(page?.name ?? '');
    setImagePending(false);
  }, [page?.id, page?.bgColor, page?.name]);

  if (!page) {
    return (
      <div className="flex h-full w-[300px] items-center justify-center border-l border-border-default bg-surface-primary p-4 text-center text-sm text-foreground-muted">
        选中组件以编辑属性
      </div>
    );
  }

  // 色板拖动 / 文本输入：实时写本地 + live 预览（不落 history）。
  const onBgColorInput = (v: string) => {
    setBgColorDraft(v);
    patchPageLive(page.id, { bgColor: v || undefined });
  };
  // 失焦提交：落一次 history（可撤销）+ 标脏（触发 autosave）。
  const commitBgColor = () => updatePage(page.id, { bgColor: bgColorDraft || undefined });

  const onNameInput = (v: string) => {
    setNameDraft(v);
    patchPageLive(page.id, { name: v });
  };
  const commitName = () => updatePage(page.id, { name: nameDraft });

  const set = (patch: Partial<Pick<Page, 'name' | 'bgColor' | 'bgGradient' | 'bgImage'>>) =>
    updatePage(page.id, patch);

  // 类型派生自数据；imagePending 覆盖「图片待选 URL」瞬态。
  const derived = backgroundType(page);
  const bgType: BackgroundType = imagePending && derived === 'none' ? 'image' : derived;

  const switchType = (t: BackgroundType) => {
    setImagePending(t === 'image');
    updatePage(page.id, buildBackgroundTypePatch(page, t));
  };

  const TYPE_LABELS: Record<Exclude<BackgroundType, 'none'>, string> = {
    color: '纯色',
    gradient: '渐变',
    image: '图片',
  };

  return (
    <div className="flex h-full w-[300px] flex-col gap-4 overflow-auto border-l border-border-default bg-surface-primary p-4">
      <div className="font-headings text-sm font-semibold text-foreground-primary">页面属性</div>

      <FieldGroup title="页面名">
        <input
          value={nameDraft}
          onChange={(e) => onNameInput(e.target.value)}
          onBlur={commitName}
          className="w-full rounded border border-border-default px-2 py-1 text-sm text-foreground-primary"
        />
      </FieldGroup>

      <FieldGroup title="背景">
        <div className="flex flex-wrap gap-1">
          {(['color', 'gradient', 'image'] as const).map((t) => (
            <button
              key={t}
              onClick={() => switchType(t)}
              className={`rounded border px-2 py-1 text-xs ${
                bgType === t
                  ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                  : 'border-border-default text-foreground-secondary hover:bg-surface-hover'
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {bgType === 'color' && (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={bgColorDraft || '#ffffff'}
              onChange={(e) => onBgColorInput(e.target.value)}
              onBlur={commitBgColor}
              className="h-8 w-10 rounded border border-border-default p-1"
            />
            <input
              value={bgColorDraft}
              placeholder="#FFFFFF（留空=白）"
              onChange={(e) => onBgColorInput(e.target.value)}
              onBlur={commitBgColor}
              className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
            />
          </div>
        )}

        {bgType === 'gradient' && <GradientFields page={page} />}

        {bgType === 'image' && (
          <ImageInput value={page.bgImage ?? ''} onChange={(url) => set({ bgImage: url || undefined })} />
        )}

        {(page.bgColor || page.bgGradient || page.bgImage) && (
          <button
            onClick={() => {
              setImagePending(false);
              set({ bgColor: undefined, bgGradient: undefined, bgImage: undefined });
            }}
            className="mt-1 text-xs text-foreground-muted hover:text-red"
          >
            清除背景
          </button>
        )}
      </FieldGroup>

      <p className="mt-auto text-xs text-foreground-muted">提示：点选画布上的组件以编辑组件属性。</p>
    </div>
  );
}

/* ------------------------------ 渐变背景 ------------------------------ */

const GRADIENT_ANGLE_PRESETS: { angle: number; label: string }[] = [
  { angle: 0, label: '→' },
  { angle: 45, label: '↘' },
  { angle: 90, label: '↓' },
  { angle: 135, label: '↙' },
  { angle: 180, label: '←' },
  { angle: 225, label: '↖' },
  { angle: 270, label: '↑' },
  { angle: 315, label: '↗' },
];

function clampAngle(a: number): number {
  return Math.max(0, Math.min(360, Math.round(a) || 0));
}
function clampPos(p: number): number {
  return Math.max(0, Math.min(100, Math.round(p) || 0));
}

/**
 * 渐变背景编辑器：子类型 + （线性）角度 + 预览条 + 色标增删。
 * 离散动作每次 updatePage 落一次 history，与 PageProperties.bgColor / ListField 一致。
 */
function GradientFields({ page }: { page: Page }) {
  const updatePage = useEditorStore((s) => s.updatePage);
  const grad = page.bgGradient;
  if (!grad) return null;

  const set = (next: PageGradient) => updatePage(page.id, { bgGradient: next });
  const setType = (type: 'linear' | 'radial') => set({ ...grad, type });
  const setAngle = (angle: number) => set({ ...grad, angle: clampAngle(angle) });
  const setStop = (i: number, patch: Partial<GradientStop>) =>
    set({ ...grad, stops: grad.stops.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
  const addStop = () => {
    if (grad.stops.length >= 6) return;
    const last = grad.stops[grad.stops.length - 1];
    const pos = clampPos((last?.position ?? 0) + (100 - (last?.position ?? 0)) / 2);
    set({ ...grad, stops: [...grad.stops, { color: last?.color ?? '#FFFFFF', position: pos }] });
  };
  const removeStop = (i: number) => {
    if (grad.stops.length <= 2) return;
    set({ ...grad, stops: grad.stops.filter((_, idx) => idx !== i) });
  };

  const angle = grad.angle ?? 180;
  const stopStr = grad.stops
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${s.position}%`)
    .join(', ');
  const preview =
    grad.type === 'radial'
      ? `radial-gradient(circle at center, ${stopStr})`
      : `linear-gradient(${angle}deg, ${stopStr})`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {(['linear', 'radial'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded border px-2 py-1 text-xs ${
              grad.type === t
                ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                : 'border-border-default text-foreground-secondary hover:bg-surface-hover'
            }`}
          >
            {t === 'linear' ? '线性' : '径向'}
          </button>
        ))}
      </div>

      <div className="h-6 w-full rounded border border-border-default" style={{ background: preview }} />

      {grad.type === 'linear' && (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1">
            {GRADIENT_ANGLE_PRESETS.map((p) => (
              <button
                key={p.angle}
                onClick={() => setAngle(p.angle)}
                className={`h-7 w-7 rounded border text-xs ${
                  angle === p.angle ? 'border-accent-primary bg-accent-primary/10' : 'border-border-default hover:bg-surface-hover'
                }`}
                title={`${p.angle}°`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-foreground-secondary">
            <span>角度</span>
            <input
              type="number"
              min={0}
              max={360}
              value={angle}
              onChange={(e) => setAngle(Number(e.target.value))}
              className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
            />
          </label>
        </div>
      )}

      <div className="space-y-1">
        <div className="text-xs text-foreground-secondary">色标</div>
        {grad.stops.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              type="color"
              value={s.color}
              onChange={(e) => setStop(i, { color: e.target.value })}
              className="h-6 w-6 rounded border border-border-default"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={s.position}
              onChange={(e) => setStop(i, { position: clampPos(Number(e.target.value)) })}
              className="w-14 rounded border border-border-default px-1 py-0.5 text-xs text-foreground-primary"
            />
            <button
              onClick={() => removeStop(i)}
              disabled={grad.stops.length <= 2}
              className="text-foreground-muted hover:text-red disabled:opacity-30"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addStop}
        disabled={grad.stops.length >= 6}
        className="text-xs text-accent-primary hover:underline disabled:opacity-30"
      >
        + 添加色标
      </button>
    </div>
  );
}

/* --------------------------- 通用样式变体 ---------------------------- */

/** 通用变体 chip 选择器：任何 BlockDef 声明了 variants 的组件都生效，写入 data.variant。 */
function VariantSelector({ comp, variants }: { comp: EditorComponent; variants: VariantOption[] }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const current = (comp.data as { variant?: string }).variant ?? variants[0]?.id ?? '';
  return (
    <div className="flex flex-wrap gap-1">
      {variants.map((v) => (
        <button
          key={v.id}
          onClick={() => updateComponentData(comp.id, { variant: v.id })}
          className={`rounded border px-2 py-1 text-xs ${
            current === v.id
              ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
              : 'border-border-default text-foreground-secondary hover:bg-surface-hover'
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------- 达人链接解析 ---------------------------- */

/** 达人头像卡：粘贴达人链接 → 自动解析填充 handle/粉丝/获赞/互动等字段。 */
function CreatorLinkImporter({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const data = comp.data as CreatorAvatarCardData;
  const [url, setUrl] = useState(data.sourceUrl ?? '');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    setUrl(data.sourceUrl ?? '');
  }, [data.sourceUrl]);

  const onParse = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setStatus('error');
      setError('请粘贴达人链接');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const parsed = await parseCreatorLink(trimmed);
      updateComponentData(comp.id, parsed);
      commit();
      setStatus('idle');
    } catch {
      setStatus('error');
      setError('暂仅支持 TikTok / Instagram / YouTube / 微博 链接');
    }
  };

  return (
    <FieldGroup title="达人链接解析">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="粘贴达人主页/视频链接…"
        className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
      />
      <button
        onClick={onParse}
        disabled={status === 'loading'}
        className="mt-1 rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover disabled:opacity-50"
      >
        {status === 'loading' ? '解析中…' : '解析'}
      </button>
      {status === 'error' && <div className="mt-1 text-xs text-red">{error}</div>}
    </FieldGroup>
  );
}

/* --------------------------- 业务组件字段 ---------------------------- */

function BusinessFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const data = comp.data as {
    businessKind: string;
    variant: VariantId;
    details: string[];
  };
  const options = getStyleOptions(data.businessKind);

  const setDetail = (i: number, v: string) => {
    const next = [...(data.details ?? [])];
    next[i] = v;
    updateComponentData(comp.id, { details: next });
  };
  const addDetail = () => updateComponentData(comp.id, { details: [...(data.details ?? []), '新条目'] });
  const removeDetail = (i: number) =>
    updateComponentData(comp.id, { details: (data.details ?? []).filter((_, idx) => idx !== i) });

  return (
    <>
      <FieldGroup title="变体">
        <div className="flex flex-wrap gap-1">
          {options.map(([id, label]) => (
            <button
              key={id}
              onClick={() => updateComponentData(comp.id, { variant: id })}
              className={`rounded border px-2 py-1 text-xs ${
                data.variant === id
                  ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                  : 'border-border-default text-foreground-secondary hover:bg-surface-hover'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup title="条目">
        <div className="space-y-1">
          {(data.details ?? []).map((d, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                value={d}
                onChange={(e) => setDetail(i, e.target.value)}
                className="w-full rounded border border-border-default px-1.5 py-1 text-xs"
              />
              <button onClick={() => removeDetail(i)} className="text-foreground-muted hover:text-red">
                ✕
              </button>
            </div>
          ))}
        </div>
        <button onClick={addDetail} className="mt-1 text-xs text-accent-primary hover:underline">
          + 添加条目
        </button>
      </FieldGroup>
    </>
  );
}

/* ----------------------------- 多选对齐面板 ----------------------------- */

const ALIGN_BUTTONS: { label: string; alignment: Alignment }[] = [
  { label: '左对齐', alignment: 'left' },
  { label: '水平居中', alignment: 'center-h' },
  { label: '右对齐', alignment: 'right' },
  { label: '顶对齐', alignment: 'top' },
  { label: '垂直居中', alignment: 'middle-v' },
  { label: '底对齐', alignment: 'bottom' },
];

function MultiSelectPanel({ ids }: { ids: string[] }) {
  const align = useEditorStore((s) => s.alignComponents);
  const distributeH = useEditorStore((s) => s.distributeH);
  const distributeV = useEditorStore((s) => s.distributeV);
  const equalWidth = useEditorStore((s) => s.equalWidth);
  const equalHeight = useEditorStore((s) => s.equalHeight);
  const deleteSelected = useEditorStore((s) => s.deleteSelected);

  return (
    <div className="flex h-full w-[300px] flex-col gap-4 overflow-auto border-l border-border-default bg-surface-primary p-4">
      <div className="font-headings text-sm font-semibold text-foreground-primary">
        已选中 {ids.length} 个组件
      </div>

      <FieldGroup title="对齐">
        <div className="grid grid-cols-3 gap-1">
          {ALIGN_BUTTONS.map((b) => (
            <button
              key={b.alignment}
              onClick={() => align(ids, b.alignment)}
              className="rounded border border-border-default px-1 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover"
            >
              {b.label}
            </button>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup title="分布">
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => distributeH(ids)}
            className="rounded border border-border-default px-1 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            水平分布
          </button>
          <button
            onClick={() => distributeV(ids)}
            className="rounded border border-border-default px-1 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            垂直分布
          </button>
        </div>
      </FieldGroup>

      <FieldGroup title="等尺寸">
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => equalWidth(ids)}
            className="rounded border border-border-default px-1 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            等宽
          </button>
          <button
            onClick={() => equalHeight(ids)}
            className="rounded border border-border-default px-1 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            等高
          </button>
        </div>
      </FieldGroup>

      <div className="mt-auto border-t border-border-subtle pt-3">
        <Button variant="danger" className="w-full" onClick={() => deleteSelected()}>
          删除选中
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------- 字段编辑器 ------------------------------- */

/** 数值字段（几何 + 字号等）。onChange 实时更新不进 history，onBlur commit。 */
function NumberField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  const updateComponent = useEditorStore((s) => s.updateComponent);
  const sanitizeComponent = useEditorStore((s) => s.sanitizeComponent);
  const commit = useEditorStore((s) => s.commit);
  const value = readValue(comp, field) as number;
  const [v, setV] = useState(String(value ?? 0));

  useEffect(() => setV(String(value ?? 0)), [value]);

  return (
    <label className="flex items-center gap-1 text-xs text-foreground-secondary">
      <span className="w-4">{field.label}</span>
      <input
        type="number"
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          if (field.inData === false) {
            updateComponent(comp.id, { [field.key]: Number(e.target.value) } as Partial<EditorComponent>);
          }
        }}
        onBlur={() => {
          if (field.inData === false) sanitizeComponent(comp.id); // 几何字段失焦夹进安全区
          commit();
        }}
        className="w-full rounded border border-border-default px-1.5 py-1 text-foreground-primary"
      />
    </label>
  );
}

export function FieldEditor({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  switch (field.kind) {
    case 'text':
    case 'color':
      return <TextField comp={comp} field={field} type={field.kind === 'color' ? 'color' : 'text'} />;
    case 'image-url':
      return <ImageUrlField comp={comp} field={field} />;
    case 'textarea':
      return <TextareaField comp={comp} field={field} />;
    case 'number':
      return <DataNumberField comp={comp} field={field} />;
    case 'select':
      return <SelectField comp={comp} field={field} />;
    case 'list':
      return <ListField comp={comp} field={field} />;
    case 'table':
      return <TableField comp={comp} />;
    case 'icon':
      return <IconPickerField comp={comp} />;
    default:
      return null;
  }
}

function useDataUpdate(comp: EditorComponent) {
  const updateComponent = useEditorStore((s) => s.updateComponent);
  const commit = useEditorStore((s) => s.commit);
  return (key: string, value: unknown) => {
    updateComponent(comp.id, {
      data: { ...(comp.data as object), [key]: value } as unknown as ComponentData,
    });
    commit();
  };
}

function TextField({ comp, field, type }: { comp: EditorComponent; field: PropertyField; type: 'text' | 'color' }) {
  const update = useDataUpdate(comp);
  const value = (readValue(comp, field) as string) ?? '';
  return (
    <label className="block text-xs text-foreground-secondary">
      <span className="mb-1 block">{field.label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => update(field.key, e.target.value)}
        className={`w-full rounded border border-border-default px-2 py-1 text-foreground-primary ${
          type === 'color' ? 'h-8 p-1' : ''
        }`}
      />
    </label>
  );
}

/** 图片 URL 字段：文本 + 上传(裁剪)，复用 ImageInput。 */
function ImageUrlField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  const update = useDataUpdate(comp);
  const value = (readValue(comp, field) as string) ?? '';
  return (
    <div className="text-xs text-foreground-secondary">
      <div className="mb-1">{field.label}</div>
      <ImageInput value={value} onChange={(url) => update(field.key, url)} />
    </div>
  );
}

/** 图标字段：预览 + 选择(overlay) + 清除 + weight 下拉。仅用于启用图标的变体。 */
function IconPickerField({ comp }: { comp: EditorComponent }) {
  const update = useDataUpdate(comp);
  const data = comp.data as { icon?: string; iconWeight?: IconWeight };
  const def = REGISTRY[comp.type];
  const currentVariantId = (comp.data as { variant?: string }).variant ?? def.variants?.[0]?.id;
  const variantDef = def.variants?.find((v) => v.id === currentVariantId);
  const variantIconCfg = variantDef?.icon;

  // 回退顺序：data.iconWeight → variant.defaultWeight → 'regular'
  const weight: IconWeight = data.iconWeight ?? variantIconCfg?.defaultWeight ?? 'regular';
  // 显示的图标：data.icon → variant.defaultKey
  const effectiveKey = data.icon ?? variantIconCfg?.defaultKey;
  const [open, setOpen] = useState(false);

  return (
    <div className="block text-xs text-foreground-secondary">
      <div className="mb-1">图标</div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-default text-foreground-primary hover:bg-surface-hover"
          title="选择图标"
        >
          <IconKit name={effectiveKey} weight={weight} size={20} />
        </button>
        <button
          onClick={() => setOpen(true)}
          className="rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
        >
          选择
        </button>
        {data.icon && (
          <button
            onClick={() => update('icon', undefined)}
            className="rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            清除
          </button>
        )}
        <select
          value={weight}
          onChange={(e) => update('iconWeight', e.target.value)}
          className="ml-auto rounded border border-border-default px-1 py-1 text-xs text-foreground-primary"
          title="图标风格"
        >
          {ICON_WEIGHT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      {open && (
        <IconPickerOverlay
          value={data.icon}
          weight={weight}
          onPick={(key) => {
            update('icon', key);
            setOpen(false);
          }}
          onClear={() => {
            update('icon', undefined);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function TextareaField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  const update = useDataUpdate(comp);
  const value = (readValue(comp, field) as string) ?? '';
  return (
    <label className="block text-xs text-foreground-secondary">
      <span className="mb-1 block">{field.label}</span>
      <textarea
        value={value}
        onChange={(e) => update(field.key, e.target.value)}
        rows={3}
        className="w-full resize-y rounded border border-border-default px-2 py-1 text-foreground-primary"
      />
    </label>
  );
}

/**
 * 轻量富文本字段：toolbar（加粗/斜体/列表）+ contentEditable。
 * 不受控：挂载时以 sanitize 后的 HTML 初始化；onBlur 时清洗并写回。
 * contentEditable / execCommand 在 jsdom 不可用，编辑交互不单测。
 */
function RichTextField({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  // 同步外部 value → contentEditable：仅在未聚焦时写入，避免覆盖用户正在编辑的光标。
  // 这样删除/重排行（index key 复用实例）或 undo 时，正文也能正确跟随 data。
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return; // 聚焦中：不干预编辑。
    const sanitized = sanitizeRichText(value);
    if (el.innerHTML !== sanitized) el.innerHTML = sanitized;
  }, [value]);

  const exec = (cmd: string) => {
    document.execCommand(cmd);
    ref.current?.focus();
  };

  const commit = () => {
    if (!ref.current) return;
    const next = sanitizeRichText(ref.current.innerHTML);
    if (next !== sanitizeRichText(value)) onChange(next);
  };

  return (
    <div className="rounded border border-border-default">
      <div className="flex gap-1 border-b border-border-subtle px-1 py-0.5">
        <button
          type="button"
          title="加粗"
          onMouseDown={(e) => {
            e.preventDefault();
            exec('bold');
          }}
          className="font-bold px-1.5 text-xs text-foreground-secondary hover:bg-surface-hover rounded"
        >
          B
        </button>
        <button
          type="button"
          title="斜体"
          onMouseDown={(e) => {
            e.preventDefault();
            exec('italic');
          }}
          className="italic px-1.5 text-xs text-foreground-secondary hover:bg-surface-hover rounded"
        >
          I
        </button>
        <button
          type="button"
          title="列表"
          onMouseDown={(e) => {
            e.preventDefault();
            exec('insertUnorderedList');
          }}
          className="px-1.5 text-xs text-foreground-secondary hover:bg-surface-hover rounded"
        >
          •
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onBlur={commit}
        className="min-h-[60px] px-2 py-1 text-xs text-foreground-primary focus:outline-none [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4"
      />
    </div>
  );
}

function DataNumberField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  const update = useDataUpdate(comp);
  const value = Number(readValue(comp, field) ?? 0);
  return (
    <label className="block text-xs text-foreground-secondary">
      <span className="mb-1 block">{field.label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => update(field.key, Number(e.target.value))}
        className="w-full rounded border border-border-default px-2 py-1 text-foreground-primary"
      />
    </label>
  );
}

function SelectField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  const update = useDataUpdate(comp);
  const value = String(readValue(comp, field) ?? '');
  return (
    <label className="block text-xs text-foreground-secondary">
      <span className="mb-1 block">{field.label}</span>
      <select
        value={value}
        onChange={(e) => {
          // trendUp 存布尔；其余存原值。
          const raw = readValue(comp, field);
          const v = typeof raw === 'boolean' ? e.target.value === 'true' : e.target.value;
          update(field.key, v);
        }}
        className="w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-foreground-primary"
      >
        {field.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** {label,value,color}[] 列表编辑器（柱状图 bars / 饼图 slices）。 */
function ListField({ comp, field }: { comp: EditorComponent; field: PropertyField }) {
  const update = useDataUpdate(comp);
  const items = (readValue(comp, field) as { label: string; value: number; color: string }[]) ?? [];
  const key = field.key;

  const setItem = (i: number, patch: Partial<{ label: string; value: number; color: string }>) => {
    const next = items.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
    update(key, next);
  };
  const add = () => update(key, [...items, { label: '新', value: 50, color: '#FF5C00' }]);
  const remove = (i: number) => update(key, items.filter((_, idx) => idx !== i));

  return (
    <div className="text-xs text-foreground-secondary">
      <div className="mb-1">{field.label}</div>
      <div className="space-y-1">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              value={it.label}
              onChange={(e) => setItem(i, { label: e.target.value })}
              className="w-16 rounded border border-border-default px-1 py-0.5"
            />
            <input
              type="number"
              value={it.value}
              onChange={(e) => setItem(i, { value: Number(e.target.value) })}
              className="w-14 rounded border border-border-default px-1 py-0.5"
            />
            <input
              type="color"
              value={it.color}
              onChange={(e) => setItem(i, { color: e.target.value })}
              className="h-6 w-6 rounded border border-border-default"
            />
            <button onClick={() => remove(i)} className="text-foreground-muted hover:text-red">
              ✕
            </button>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-1 text-accent-primary hover:underline">
        + 添加
      </button>
    </div>
  );
}

/** 表格编辑器：表头 + 行。 */
function TableField({ comp }: { comp: EditorComponent }) {
  const update = useDataUpdate(comp);
  const data = comp.data as { headers: string[]; rows: string[][] };
  const headers = data.headers;
  const rows = data.rows;

  /** 判断某列是否为图标列（列名匹配 icon/Icon/iconKey）。 */
  const isIconCol = (ci: number) => {
    const h = (headers[ci] ?? '').toLowerCase();
    return h === 'icon' || h === 'iconkey' || h === 'icon-key' || h === '图标';
  };

  const setHeader = (i: number, v: string) => {
    const headers2 = headers.map((h, idx) => (idx === i ? v : h));
    update('headers', headers2);
  };
  const setCell = (r: number, c: number, v: string) => {
    const rows2 = rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row));
    update('rows', rows2);
  };
  const addRow = () => update('rows', [...rows, headers.map(() => '--')]);
  const removeRow = (r: number) => update('rows', rows.filter((_, idx) => idx !== r));
  const addCol = () => {
    update('headers', [...headers, `列${headers.length + 1}`]);
    update('rows', rows.map((r) => [...r, '--']));
  };
  const removeCol = (c: number) => {
    update('headers', headers.filter((_, idx) => idx !== c));
    update('rows', rows.map((r) => r.filter((_, idx) => idx !== c)));
  };

  return (
    <div className="text-xs text-foreground-secondary">
      <div className="mb-1">表格内容</div>
      <div className="space-y-1">
        <div className="flex gap-1">
          {headers.map((h, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <input
                value={h}
                onChange={(e) => setHeader(i, e.target.value)}
                className="w-16 rounded border border-border-default px-1 py-0.5"
              />
              <button
                onClick={() => removeCol(i)}
                title="删除该列"
                className="text-[10px] text-foreground-muted hover:text-red"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {rows.map((row, ri) => (
          <div key={ri} className="flex items-center gap-1">
            {row.map((cell, ci) =>
              isIconCol(ci) ? (
                <TableCellIconPicker
                  key={ci}
                  value={cell}
                  onChange={(v) => setCell(ri, ci, v)}
                />
              ) : (
                <input
                  key={ci}
                  value={cell}
                  onChange={(e) => setCell(ri, ci, e.target.value)}
                  className="w-16 rounded border border-border-default px-1 py-0.5"
                />
              ),
            )}
            <button
              onClick={() => removeRow(ri)}
              title="删除该行"
              className="text-foreground-muted hover:text-red"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-3">
        <button onClick={addRow} className="text-accent-primary hover:underline">
          + 行
        </button>
        <button onClick={addCol} className="text-accent-primary hover:underline">
          + 列
        </button>
      </div>
    </div>
  );
}

/** 表格单元格内的图标选择器：点击弹出 IconPickerOverlay，选中后写入 cell。 */
function TableCellIconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const Icon = value ? findIcon(value)?.Comp : null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={value ? (findIcon(value)?.label ?? '选择图标') : '选择图标'}
        className="flex h-6 w-16 items-center justify-center rounded border border-border-default text-foreground-primary hover:bg-surface-hover"
      >
        {Icon ? <Icon size={16} /> : <span className="text-[10px] text-foreground-muted">选图标</span>}
      </button>
      {open && (
        <IconPickerOverlay
          value={value || undefined}
          weight="regular"
          onPick={(key) => {
            onChange(key);
            setOpen(false);
          }}
          onClear={() => {
            onChange('');
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/* --------------------------- 达人数据条字段 ---------------------------- */

/** 达人数据条：指标库勾选筛选 + 已选指标文案编辑。 */
function CreatorStatsFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const data = comp.data as CreatorStatsStripData;
  const stats = data.stats ?? [];

  const write = (next: CreatorStatItem[]) => {
    updateComponentData(comp.id, { stats: next } as Partial<CreatorStatsStripData>);
    commit();
  };

  // 命中指标库：存在同 key 且 selected !== false 视为启用。
  const isEnabled = (key: string) => stats.some((s) => s.key === key && s.selected !== false);

  const toggle = (key: string) => {
    const meta = CREATOR_METRIC_CATALOG.find((m) => m.key === key)!;
    const existing = stats.find((s) => s.key === key);
    if (existing) {
      // 切换 selected（保留文案）。
      write(stats.map((s) => (s.key === key ? { ...s, selected: s.selected === false } : s)));
    } else {
      // 首次启用：用指标库默认 label/color，value 留空待用户填。
      write([...stats, { key, label: meta.label, value: '', color: meta.color, selected: true }]);
    }
  };

  const setItem = (i: number, patch: Partial<CreatorStatItem>) =>
    write(stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const visible = stats.filter((s) => s.selected !== false);

  return (
    <FieldGroup title="达人数据">
      <div className="text-xs text-foreground-secondary">
        <div className="mb-1">筛选指标</div>
        <div className="grid grid-cols-2 gap-1">
          {CREATOR_METRIC_CATALOG.map((m) => (
            <label key={m.key} className="flex items-center gap-1">
              <input type="checkbox" checked={isEnabled(m.key)} onChange={() => toggle(m.key)} className="h-3 w-3" />
              <span>{m.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="text-xs text-foreground-secondary">
        <div className="mb-1">文案修改</div>
        {visible.length === 0 && <p className="text-foreground-muted">请先勾选要展示的指标。</p>}
        <div className="space-y-1">
          {visible.map((s) => {
            const idx = stats.indexOf(s);
            return (
              <div key={s.key ?? idx} className="flex items-center gap-1">
                <input
                  value={s.label}
                  onChange={(e) => setItem(idx, { label: e.target.value })}
                  className="w-16 rounded border border-border-default px-1 py-0.5"
                />
                <input
                  value={s.value}
                  placeholder={CREATOR_METRIC_CATALOG.find((m) => m.key === s.key)?.placeholder ?? ''}
                  onChange={(e) => setItem(idx, { value: e.target.value })}
                  className="w-16 rounded border border-border-default px-1 py-0.5"
                />
                <input
                  type="color"
                  value={s.color}
                  onChange={(e) => setItem(idx, { color: e.target.value })}
                  className="h-6 w-6 rounded border border-border-default"
                />
              </div>
            );
          })}
        </div>
      </div>
    </FieldGroup>
  );
}

/* ----------------------------- 图表数据导入 ----------------------------- */

/** 柱/折/饼图：导入 Excel/CSV → 映射列 → 写入 comp.data。 */
function ChartImportButton({ comp }: { comp: EditorComponent }) {
  const setComponentData = useEditorStore((s) => s.setComponentData);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const chartType = comp.type as 'bar-chart' | 'line-chart' | 'pie-chart';
  const prevTitle = (comp.data as { title?: string }).title;

  return (
    <FieldGroup title="数据导入">
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
      >
        导入 Excel/CSV
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setFile(f);
          if (fileRef.current) fileRef.current.value = '';
        }}
      />
      {file && (
        <ImportDataModal
          file={file}
          chartType={chartType}
          prevTitle={prevTitle}
          onConfirm={(data: ChartData) => {
            setComponentData(comp.id, data);
            setFile(null);
          }}
          onCancel={() => setFile(null)}
        />
      )}
    </FieldGroup>
  );
}

/** kpi-board：导入 Excel/CSV → 首行表头、其余数据行，直接覆盖 headers/rows。 */
function KpiImportButton({ comp }: { comp: EditorComponent }) {
  const setComponentData = useEditorStore((s) => s.setComponentData);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    try {
      const sheets = await parseFile(file);
      const sheet = sheets[0];
      if (!sheet || sheet.columns.length === 0) {
        setError('文件为空或无表头');
        return;
      }
      const headers = sheet.columns;
      const rows = sheet.rows.map((r) => headers.map((h) => r[h] ?? ''));
      setComponentData(comp.id, { ...comp.data, headers, rows });
    } catch {
      setError('解析失败，请检查文件格式');
    }
  }

  return (
    <FieldGroup title="数据导入">
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
      >
        导入 Excel/CSV
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          if (fileRef.current) fileRef.current.value = '';
        }}
      />
      {error && <div className="text-xs text-red-500">{error}</div>}
      <div className="text-[11px] text-foreground-muted">
        首行作为表头，其余作为数据行；仅覆盖表格内容。
      </div>
    </FieldGroup>
  );
}

/** kpi-board：从 Campaign 导入投放表现指标 → 覆盖 headers/rows、重置 icons/valueColors、保留 variant。 */
function ImportCampaignButton({ comp }: { comp: EditorComponent }) {
  const setComponentData = useEditorStore((s) => s.setComponentData);
  const defaultCampaignId = useEditorStore((s) => s.projectMeta?.campaignId);
  const boundCampaign = useEditorStore((s) => s.reportData.campaign);
  const [open, setOpen] = useState(false);

  /** 一键从已绑定 Campaign 导入（无需弹模态框）。 */
  function quickImport() {
    if (!boundCampaign?.metrics?.length) return;
    const patch = metricsToRows(boundCampaign.metrics);
    setComponentData(comp.id, { ...comp.data, ...patch });
  }

  return (
    <FieldGroup title="从 Campaign 导入">
      {/* 已绑定 Campaign 时，显示一键导入快捷按钮 */}
      {boundCampaign && boundCampaign.metrics && boundCampaign.metrics.length > 0 ? (
        <>
          <button
            onClick={quickImport}
            className="w-full rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white hover:opacity-90"
          >
            ⚡ 导入「{boundCampaign.name}」
          </button>
          <div className="text-[11px] text-foreground-muted">
            从「数据配置」绑定的 Campaign 一键导入 {boundCampaign.metrics.length} 项指标。
          </div>
          <button
            onClick={() => setOpen(true)}
            className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            换一个 Campaign…
          </button>
        </>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
        >
          选择 Campaign 导入
        </button>
      )}
      <div className="text-[11px] text-foreground-muted">
        导入选中 campaign 的投放表现指标（花费/展示/点击/转化/CTR/ROAS），覆盖当前表格。
      </div>
      {open && (
        <ImportCampaignModal
          defaultCampaignId={defaultCampaignId ?? boundCampaign?.id}
          onConfirm={(metrics) => {
            const patch = metricsToRows(metrics);
            setComponentData(comp.id, { ...comp.data, ...patch });
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </FieldGroup>
  );
}

/** kpi-board：每行配图标 + 数值主题色（写 data.icons / data.valueColors）。 */
function KpiRowStyleField({ comp }: { comp: EditorComponent }) {
  const update = useDataUpdate(comp);
  const data = comp.data as KpiBoardData;
  const rows = data.rows ?? [];
  const icons = data.icons ?? [];
  const valueColors = data.valueColors ?? [];
  const weight: IconWeight = data.iconWeight ?? 'regular';
  const [pickingRow, setPickingRow] = useState<number | null>(null);

  function ensureLen<T>(arr: T[]): T[] {
    const next = [...arr];
    while (next.length < rows.length) next.push(null as unknown as T);
    return next;
  }
  function setIcon(i: number, key: string | null) {
    update('icons', withAt(ensureLen(icons), i, key));
  }
  function setColor(i: number, token: KpiColorToken | null) {
    update('valueColors', withAt(ensureLen(valueColors), i, token));
  }

  return (
    <FieldGroup title="卡片样式（每行）">
      <div className="text-[11px] text-foreground-muted">图标仅在「卡片」变体下显示。</div>
      {rows.map((r, i) => {
        const iconKey = icons[i] ?? null;
        const Icon = findIcon(iconKey ?? undefined)?.Comp;
        const color = valueColors[i] ?? null;
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="w-20 truncate text-[11px] text-foreground-secondary">{r[0] ?? `行${i + 1}`}</span>
            <button
              onClick={() => setPickingRow(i)}
              title={iconKey ? (findIcon(iconKey)?.label ?? '选图标') : '选图标'}
              className="flex h-7 w-7 items-center justify-center rounded border border-border-default hover:bg-surface-hover"
            >
              {Icon ? <Icon size={16} /> : <span className="text-[10px] text-foreground-muted">+</span>}
            </button>
            {iconKey && (
              <button
                onClick={() => setIcon(i, null)}
                className="text-[10px] text-foreground-muted hover:text-foreground-primary"
              >
                清除
              </button>
            )}
            <div className="ml-auto flex gap-1">
              {KPI_COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.token}
                  title={opt.label}
                  onClick={() => setColor(i, color === opt.token ? null : opt.token)}
                  className={`h-4 w-4 rounded-full border ${
                    color === opt.token ? 'border-foreground-primary' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: KPI_COLOR_TOKENS[opt.token].fg }}
                />
              ))}
            </div>
          </div>
        );
      })}
      {pickingRow !== null && (
        <IconPickerOverlay
          value={icons[pickingRow] ?? undefined}
          weight={weight}
          onPick={(key) => {
            setIcon(pickingRow, key);
            setPickingRow(null);
          }}
          onClear={() => {
            setIcon(pickingRow, null);
            setPickingRow(null);
          }}
          onClose={() => setPickingRow(null)}
        />
      )}
    </FieldGroup>
  );
}

/** 不可变写入：返回新数组，index i 置为 v。 */
function withAt<T>(arr: T[], i: number, v: T): T[] {
  const next = [...arr];
  next[i] = v;
  return next;
}

/* --------------------------- 业绩·商品 自定义字段 ---------------------------- */

/** 作品截图：每张图 ImageInput + 说明 + 删除，底部添加。 */
function WorkScreenshotFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const data = comp.data as WorkScreenshotData;
  const images = data.images ?? [];

  const write = (next: WorkScreenshotData['images']) => {
    updateComponentData(comp.id, { images: next } as Partial<WorkScreenshotData>);
    commit();
  };
  const setItem = (i: number, patch: Partial<{ src: string; caption: string }>) =>
    write(images.map((im, idx) => (idx === i ? { ...im, ...patch } : im)));
  const add = () => write([...images, { src: '', caption: '' }]);
  const remove = (i: number) => write(images.filter((_, idx) => idx !== i));

  return (
    <FieldGroup title="作品截图">
      <div className="space-y-2">
        {images.map((im, i) => (
          <div key={i} className="space-y-1 rounded border border-border-subtle p-1.5">
            <ImageInput value={im.src} onChange={(url) => setItem(i, { src: url })} />
            <div className="flex items-center gap-1">
              <input
                value={im.caption ?? ''}
                placeholder="说明"
                onChange={(e) => setItem(i, { caption: e.target.value })}
                className="w-full rounded border border-border-default px-1.5 py-1 text-xs text-foreground-primary"
              />
              <button onClick={() => remove(i)} className="text-foreground-muted hover:text-red">
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={add} className="text-xs text-accent-primary hover:underline">
        + 添加图片
      </button>
    </FieldGroup>
  );
}

/** strategy-block 专属编辑：每行 = 图标 key + 标题 + 富文本内容；可增删行。 */
function StrategyBlockFields({ comp }: { comp: EditorComponent }) {
  const update = useDataUpdate(comp);
  const data = comp.data as StrategyBlockData;
  const rows = data.rows ?? [];

  const setRow = (i: number, next: string[]) => {
    update('rows', rows.map((r, idx) => (idx === i ? next : r)));
  };
  const addRow = () => update('rows', [...rows, ['', '', '']]);
  const removeRow = (i: number) => update('rows', rows.filter((_, idx) => idx !== i));

  return (
    <FieldGroup title="策略块">
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="space-y-1 rounded border border-border-subtle p-1">
            <div className="flex items-center gap-1">
              <TableCellIconPicker
                value={row[0] ?? ''}
                onChange={(key) => setRow(i, [key, row[1] ?? '', row[2] ?? ''])}
              />
              <input
                value={row[1] ?? ''}
                onChange={(e) => setRow(i, [row[0] ?? '', e.target.value, row[2] ?? ''])}
                placeholder="标题"
                className="flex-1 rounded border border-border-default px-1 py-0.5 text-xs"
              />
              <button
                onClick={() => removeRow(i)}
                title="删除该项"
                className="text-foreground-muted hover:text-red"
              >
                ✕
              </button>
            </div>
            <RichTextField
              value={row[2] ?? ''}
              onChange={(html) => setRow(i, [row[0] ?? '', row[1] ?? '', html])}
            />
          </div>
        ))}
      </div>
      <button onClick={addRow} className="mt-1 text-xs text-accent-primary hover:underline">
        + 添加项
      </button>
    </FieldGroup>
  );
}

/** 组图：每张图 ImageInput + 删除，底部添加；数量自由，版式自适应或手动锁定。 */
function ImageGroupFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const data = comp.data as ImageGroupData;
  const images = data.images ?? [];

  const write = (next: ImageGroupData['images']) => {
    updateComponentData(comp.id, { images: next } as Partial<ImageGroupData>);
    commit();
  };
  const setSrc = (i: number, src: string) =>
    write(images.map((im, idx) => (idx === i ? { ...im, src } : im)));
  const add = () => write([...images, { src: '' }]);
  const remove = (i: number) => write(images.filter((_, idx) => idx !== i));

  return (
    <FieldGroup title="图片">
      <div className="space-y-2">
        {images.map((im, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="flex-1">
              <ImageInput value={im.src} onChange={(url) => setSrc(i, url)} />
            </div>
            <button onClick={() => remove(i)} className="text-foreground-muted hover:text-red">
              ✕
            </button>
          </div>
        ))}
      </div>
      <button onClick={add} className="text-xs text-accent-primary hover:underline">
        + 添加图片
      </button>
    </FieldGroup>
  );
}

/** 作品数据：每个指标 label + value + color + 删除，底部添加。 */
function WorkMetricsFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const data = comp.data as WorkMetricsData;
  const metrics = data.metrics ?? [];

  const write = (next: WorkMetricsData['metrics']) => {
    updateComponentData(comp.id, { metrics: next } as Partial<WorkMetricsData>);
    commit();
  };
  const setItem = (i: number, patch: Partial<{ label: string; value: string; color: string }>) =>
    write(metrics.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const add = () => write([...metrics, { label: '新指标', value: '--', color: '#FF5C00' }]);
  const remove = (i: number) => write(metrics.filter((_, idx) => idx !== i));

  return (
    <FieldGroup title="作品指标">
      <div className="space-y-1">
        {metrics.map((m, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              value={m.label}
              placeholder="指标"
              onChange={(e) => setItem(i, { label: e.target.value })}
              className="w-16 rounded border border-border-default px-1.5 py-0.5 text-xs text-foreground-primary"
            />
            <input
              value={m.value}
              placeholder="数值"
              onChange={(e) => setItem(i, { value: e.target.value })}
              className="w-16 rounded border border-border-default px-1.5 py-0.5 text-xs text-foreground-primary"
            />
            <input
              type="color"
              value={m.color ?? '#FF5C00'}
              onChange={(e) => setItem(i, { color: e.target.value })}
              className="h-6 w-6 rounded border border-border-default"
            />
            <button onClick={() => remove(i)} className="text-foreground-muted hover:text-red">
              ✕
            </button>
          </div>
        ))}
      </div>
      <button onClick={add} className="text-xs text-accent-primary hover:underline">
        + 添加指标
      </button>
    </FieldGroup>
  );
}

const WORDCLOUD_SENTIMENT_OPTIONS: { value: Sentiment; label: string }[] = [
  { value: 'pos', label: '正面' },
  { value: 'neg', label: '负面' },
  { value: 'neutral', label: '中性' },
];

/** 评论词云：每个词 text + weight + 情感 + 删除，底部添加。 */
function CommentWordcloudFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const data = comp.data as CommentWordcloudData;
  const words = data.words ?? [];

  const write = (next: CommentWordcloudData['words']) => {
    updateComponentData(comp.id, { words: next } as Partial<CommentWordcloudData>);
    commit();
  };
  const setItem = (i: number, patch: Partial<{ text: string; weight: number; sentiment: Sentiment }>) =>
    write(words.map((w, idx) => (idx === i ? { ...w, ...patch } : w)));
  const add = () => write([...words, { text: '新词', weight: 50, sentiment: 'neutral' }]);
  const remove = (i: number) => write(words.filter((_, idx) => idx !== i));

  return (
    <FieldGroup title="评论词">
      <div className="space-y-1">
        {words.map((w, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              value={w.text}
              placeholder="词"
              onChange={(e) => setItem(i, { text: e.target.value })}
              className="w-16 rounded border border-border-default px-1.5 py-0.5 text-xs text-foreground-primary"
            />
            <input
              type="number"
              value={w.weight}
              onChange={(e) => setItem(i, { weight: Number(e.target.value) })}
              className="w-12 rounded border border-border-default px-1 py-0.5 text-xs text-foreground-primary"
            />
            <select
              value={w.sentiment}
              onChange={(e) => setItem(i, { sentiment: e.target.value as Sentiment })}
              className="rounded border border-border-default px-1 py-0.5 text-xs text-foreground-primary"
            >
              {WORDCLOUD_SENTIMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button onClick={() => remove(i)} className="text-foreground-muted hover:text-red">
              ✕
            </button>
          </div>
        ))}
      </div>
      <button onClick={add} className="text-xs text-accent-primary hover:underline">
        + 添加词
      </button>
    </FieldGroup>
  );
}

/* ------------------------------- 图形字段 ------------------------------- */
const SHAPE_OPTIONS: { id: ShapeKind; label: string }[] = [
  { id: 'rectangle', label: '矩形' },
  { id: 'rounded', label: '圆角' },
  { id: 'circle', label: '圆形' },
  { id: 'line', label: '直线' },
];

export function ShapeFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const data = comp.data as ShapeData;
  const isLine = data.shape === 'line';

  function setShape(shape: ShapeKind) {
    const next: ShapeData = { ...data, shape };
    if (shape === 'line') {
      next.strokeWidth = next.strokeWidth || 1;
      next.dash = next.dash ?? false;
      delete (next as { fill?: string }).fill;
    }
    if (shape === 'rounded' && next.borderRadius == null) next.borderRadius = 12;
    updateComponentData(comp.id, next as unknown as Record<string, unknown>);
  }
  const set = (patch: Partial<ShapeData>) =>
    updateComponentData(comp.id, patch as unknown as Record<string, unknown>);

  return (
    <FieldGroup title="图形">
      <div className="flex flex-wrap gap-1">
        {SHAPE_OPTIONS.map((o) => (
          <button
            key={o.id}
            onClick={() => setShape(o.id)}
            className={`rounded border px-2 py-1 text-xs ${
              data.shape === o.id
                ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                : 'border-border-default text-foreground-secondary hover:bg-surface-hover'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {!isLine && (
        <label className="block text-xs text-foreground-secondary">
          <span className="mb-1 block">填充色</span>
          <input type="color" value={data.fill ?? '#ffffff'} onChange={(e) => set({ fill: e.target.value })} className="h-8 w-full rounded border border-border-default p-1" />
        </label>
      )}

      <label className="block text-xs text-foreground-secondary">
        <span className="mb-1 block">描边色</span>
        <input type="color" value={data.stroke ?? '#E5E7EB'} onChange={(e) => set({ stroke: e.target.value })} className="h-8 w-full rounded border border-border-default p-1" />
      </label>

      <label className="block text-xs text-foreground-secondary">
        <span className="mb-1 block">描边粗细</span>
        <input type="number" min={0} value={data.strokeWidth ?? 0} onChange={(e) => set({ strokeWidth: Number(e.target.value) })} className="w-full rounded border border-border-default px-2 py-1" />
      </label>

      <label className="block text-xs text-foreground-secondary">
        <span className="mb-1 block">透明度（0–1）</span>
        <input type="number" min={0} max={1} step={0.1} value={data.opacity ?? 1} onChange={(e) => set({ opacity: Number(e.target.value) })} className="w-full rounded border border-border-default px-2 py-1" />
      </label>

      <label className="block text-xs text-foreground-secondary">
        <span className="mb-1 block">旋转（度）</span>
        <input type="number" value={data.rotation ?? 0} onChange={(e) => set({ rotation: Number(e.target.value) })} className="w-full rounded border border-border-default px-2 py-1" />
      </label>

      {data.shape === 'rounded' && (
        <label className="block text-xs text-foreground-secondary">
          <span className="mb-1 block">圆角半径</span>
          <input type="number" min={0} value={data.borderRadius ?? 12} onChange={(e) => set({ borderRadius: Number(e.target.value) })} className="w-full rounded border border-border-default px-2 py-1" />
        </label>
      )}

      {isLine && (
        <label className="flex items-center gap-2 text-xs text-foreground-secondary">
          <input type="checkbox" checked={data.dash ?? false} onChange={(e) => set({ dash: e.target.checked })} />
          虚线
        </label>
      )}
    </FieldGroup>
  );
}

/* ------------------- 报告数据快捷导入（达人组件） ------------------- */

/**
 * creator-avatar-card：从「数据配置」面板已选达人中选一个，一键填充头像卡字段。
 */
function ReportCreatorAvatarImporter({ comp }: { comp: EditorComponent }) {
  const creators = useEditorStore((s) => s.reportData.creators ?? []);
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const [selected, setSelected] = useState('');

  if (creators.length === 0) return null;

  function apply() {
    const cr = creators.find((c) => c.id === selected);
    if (!cr) return;
    updateComponentData(comp.id, {
      name: cr.name,
      platform: (cr.platform ?? 'TikTok') as CreatorAvatarCardData['platform'],
      handle: cr.handle,
      followers: cr.followers,
      engagement: cr.engagement,
      intro: cr.category ? `${cr.category} · ${cr.region ?? ''}`.trim() : '',
    });
    commit();
    setSelected('');
  }

  return (
    <FieldGroup title="从项目数据导入">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs"
      >
        <option value="">选择达人…</option>
        {creators.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}（{c.platform} · {c.tier}）
          </option>
        ))}
      </select>
      {selected && (
        <button
          onClick={apply}
          className="mt-1 w-full rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white hover:opacity-90"
        >
          ⚡ 导入到头像卡
        </button>
      )}
    </FieldGroup>
  );
}

/**
 * creator-stats-strip：从「数据配置」面板已选达人中选一个，一键填充达人数据条 KPI。
 */
function ReportCreatorStatsImporter({ comp }: { comp: EditorComponent }) {
  const creators = useEditorStore((s) => s.reportData.creators ?? []);
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const [selected, setSelected] = useState('');

  if (creators.length === 0) return null;

  function apply() {
    const cr = creators.find((c) => c.id === selected);
    if (!cr || !cr.stats?.length) return;
    updateComponentData(comp.id, { stats: cr.stats.map((s) => ({ ...s })) });
    commit();
    setSelected('');
  }

  const selectedCreator = creators.find((c) => c.id === selected);
  const hasStats = (selectedCreator?.stats?.length ?? 0) > 0;

  return (
    <FieldGroup title="从项目数据导入">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs"
      >
        <option value="">选择达人…</option>
        {creators.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}（{(c.stats?.length ?? 0)} 项 KPI）
          </option>
        ))}
      </select>
      {selected && hasStats && (
        <button
          onClick={apply}
          className="mt-1 w-full rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white hover:opacity-90"
        >
          ⚡ 导入 {selectedCreator!.stats!.length} 项 KPI
        </button>
      )}
      {selected && !hasStats && (
        <p className="mt-1 text-[11px] text-foreground-muted">该达人未配置 KPI 数据</p>
      )}
    </FieldGroup>
  );
}

/**
 * creator-list：多选达人 → 一键填充达人列表 rows。
 * 约定列顺序 [Avatar, Name, Platform, Followers, Engagement, Category]。
 */
function ReportCreatorListImporter({ comp }: { comp: EditorComponent }) {
  const creators = useEditorStore((s) => s.reportData.creators ?? []);
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  if (creators.length === 0) return null;

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function applyAll() {
    const picked = creators.filter((c) => selectedIds.includes(c.id));
    if (!picked.length) return;
    const headers = ['Avatar', 'Name', 'Platform', 'Followers', 'Engagement', 'Category'];
    const rows = picked.map((cr) => [
      cr.avatar ?? '',
      cr.name,
      cr.platform ?? '',
      cr.followers ?? '',
      cr.engagement ?? '',
      cr.category ?? '',
    ]);
    updateComponentData(comp.id, { headers, rows });
    commit();
    setSelectedIds([]);
  }

  function applyAllCreators() {
    const headers = ['Avatar', 'Name', 'Platform', 'Followers', 'Engagement', 'Category'];
    const rows = creators.map((cr) => [
      cr.avatar ?? '',
      cr.name,
      cr.platform ?? '',
      cr.followers ?? '',
      cr.engagement ?? '',
      cr.category ?? '',
    ]);
    updateComponentData(comp.id, { headers, rows });
    commit();
  }

  return (
    <FieldGroup title="从项目数据导入">
      <div className="space-y-1">
        {creators.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={selectedIds.includes(c.id)}
              onChange={() => toggle(c.id)}
              className="h-3 w-3"
            />
            <span className="text-foreground-primary">{c.name}</span>
            <span className="text-foreground-muted">{c.platform} · {c.followers}</span>
          </label>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {selectedIds.length > 0 && (
          <button
            onClick={applyAll}
            className="rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white hover:opacity-90"
          >
            ⚡ 导入选中 ({selectedIds.length})
          </button>
        )}
        <button
          onClick={applyAllCreators}
          className="rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
        >
          导入全部 ({creators.length})
        </button>
      </div>
    </FieldGroup>
  );
}

/**
 * creator-works-list：选一个达人 → 用其 name/platform/followers 等填充作品列表行。
 * 因为 reportData 不含作品列表，这里生成达人基本信息行。
 */
function ReportCreatorWorksImporter({ comp }: { comp: EditorComponent }) {
  const creators = useEditorStore((s) => s.reportData.creators ?? []);
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const [selected, setSelected] = useState('');

  if (creators.length === 0) return null;

  function apply() {
    const cr = creators.find((c) => c.id === selected);
    if (!cr) return;
    const data = comp.data as { headers?: string[]; rows?: string[][] };
    const headers = data.headers?.length
      ? data.headers
      : ['Cover', 'Title', 'Shares', 'Likes', 'Comments'];
    // 在已有 rows 基础上追加一行达人信息
    const newRow = ['', `${cr.name} · 精选作品`, cr.followers ?? '--', cr.engagement ?? '--', '--'];
    const rows = [...(data.rows ?? []), newRow];
    updateComponentData(comp.id, { headers, rows });
    commit();
    setSelected('');
  }

  return (
    <FieldGroup title="从项目数据导入">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs"
      >
        <option value="">选择达人追加一行…</option>
        {creators.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}（{c.platform}）
          </option>
        ))}
      </select>
      {selected && (
        <button
          onClick={apply}
          className="mt-1 w-full rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white hover:opacity-90"
        >
          ⚡ 追加达人信息行
        </button>
      )}
    </FieldGroup>
  );
}
