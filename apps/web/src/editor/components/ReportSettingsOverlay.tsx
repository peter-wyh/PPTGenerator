import { useSyncExternalStore, useState } from 'react';
import {
  DEFAULT_THEME,
  FONT_OPTIONS,
  STYLE_PRESETS,
  type ProjectTheme,
  type ThemeDensity,
  type ThemeRadius,
} from '@mediakit/shared';
import type { PageGradient } from '@mediakit/shared';
import { useEditorStore } from '../store';
import type { ThemePatch } from '../store';
import { ImageInput } from '@/components/ImageInput';
import { BUSINESS_LINE_META } from '@/projectsMeta';
import {
  registerCustomFonts,
  unregisterCustomFont,
  subscribeCustomFonts,
  getCustomFontsSnapshot,
  customFontToOption,
} from '../customFonts';
import { uploadFont, deleteFont } from '@/api/fonts';

interface Props {
  onClose: () => void;
}

const DENSITY_OPTIONS: { value: ThemeDensity; label: string }[] = [
  { value: 'compact', label: '紧凑' },
  { value: 'standard', label: '标准' },
  { value: 'spacious', label: '宽松' },
];

const RADIUS_OPTIONS: { value: ThemeRadius; label: string }[] = [
  { value: 'sharp', label: '直角' },
  { value: 'small', label: '小圆角' },
  { value: 'large', label: '大圆角' },
];

/** 标题块样式选项（与 registry title-block variants 对齐）。 */
const TITLE_STYLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'plain', label: '纯文字' },
  { value: 'bar-left', label: '左色条' },
  { value: 'underline', label: '下划线' },
  { value: 'gradient', label: '渐变背景' },
  { value: 'card', label: '卡片' },
  { value: 'numbered', label: '序号' },
  { value: 'highlight', label: '色块强调' },
  { value: 'accent-tag', label: '色块标签' },
  { value: 'accent-underline', label: '强调下划线' },
  { value: 'block-underline', label: '色块下划线' },
];

/** 从全局 STYLE_PRESETS 动态提取品牌色色板（去重）。 */
const PRESET_PRIMARIES = Array.from(
  new Set(STYLE_PRESETS.map((p) => p.theme.color.primary)),
);

/** 把 ThemePatch 深合并到 draft（复刻 store.setTheme 的合并逻辑，仅本地操作不落 store）。 */
function applyDraftPatch(prev: ProjectTheme, patch: ThemePatch): ProjectTheme {
  return {
    color: { ...prev.color, ...patch.color },
    font: { ...prev.font, ...patch.font },
    density: patch.density ?? prev.density,
    radius: patch.radius ?? prev.radius,
    layout: { ...(prev.layout ?? DEFAULT_THEME.layout), ...patch.layout } as NonNullable<
      ProjectTheme['layout']
    >,
    lineHeight: {
      ...(prev.lineHeight ?? DEFAULT_THEME.lineHeight),
      ...patch.lineHeight,
    } as NonNullable<ProjectTheme['lineHeight']>,
    heading: {
      ...(prev.heading ?? DEFAULT_THEME.heading),
      ...patch.heading,
    } as NonNullable<ProjectTheme['heading']>,
    format: {
      ...(prev.format ?? DEFAULT_THEME.format),
      ...patch.format,
    } as NonNullable<ProjectTheme['format']>,
    chart: {
      ...(prev.chart ?? DEFAULT_THEME.chart),
      ...patch.chart,
    } as NonNullable<ProjectTheme['chart']>,
    shadow: patch.shadow ?? prev.shadow,
    branding:
      patch.branding || prev.branding
        ? { ...(prev.branding ?? DEFAULT_THEME.branding), ...patch.branding }
        : undefined,
    background:
      patch.background || prev.background
        ? {
            type: patch.background?.type ?? prev.background?.type ?? 'none',
            ...(prev.background ?? {}),
            ...patch.background,
          }
        : undefined,
    preset: 'preset' in patch ? patch.preset : prev.preset,
  };
}

/** 报告设置浮层：整体风格（预设 + 配色 + 字体 + 密度 + 圆角）+ 解析参考图占位。 */
export function ReportSettingsOverlay({ onClose }: Props) {
  // 本地 draft 状态：挂载时从 store 拷贝当前主题，所有编辑写入 draft，仅在点「保存」时整体提交。
  const commitTheme = useEditorStore((s) => s.setTheme);
  const [draft, setDraft] = useState<ProjectTheme>(
    () => useEditorStore.getState().projectMeta?.theme ?? DEFAULT_THEME,
  );
  // theme 作为 draft 的只读别名，保留以避免 JSX 中 ~40 处引用全部改名。
  const theme = draft;
  const layout = theme.layout ?? DEFAULT_THEME.layout!;
  const lineHeight = theme.lineHeight ?? DEFAULT_THEME.lineHeight!;
  const format = theme.format ?? DEFAULT_THEME.format!;
  const chart = theme.chart ?? DEFAULT_THEME.chart!;
  const shadow = theme.shadow ?? DEFAULT_THEME.shadow!;
  const heading = theme.heading ?? DEFAULT_THEME.heading!;
  // 本地 draft 更新：复刻 store.setTheme 的深合并签名，但不落 store（仅改 draft）。
  const setTheme = (patch: ThemePatch) => setDraft((prev) => applyDraftPatch(prev, patch));
  const [toast, setToast] = useState<string | null>(null);
  const customFonts = useSyncExternalStore(subscribeCustomFonts, getCustomFontsSnapshot);
  const [uploadingFont, setUploadingFont] = useState(false);

  // 业务线 Logo（标题栏右上角，只读；取自 mock BUSINESS_LINE_META）
  const businessLine = useEditorStore((s) => s.projectMeta?.businessLine);
  const bl = businessLine ? BUSINESS_LINE_META[businessLine] : undefined;

  // 左导航分类
  type Cat = 'basic' | 'layout' | 'component' | 'brand';
  const [activeCat, setActiveCat] = useState<Cat>('basic');
  const CATS: { key: Cat; label: string }[] = [
    { key: 'basic', label: '基础样式' },
    { key: 'layout', label: '布局' },
    { key: 'component', label: '组件样式' },
    { key: 'brand', label: '品牌' },
  ];

  /** 保存：把 draft 整体提交到 store（深合并等价整体替换），然后关闭浮层。 */
  function handleSave() {
    commitTheme(draft);
    onClose();
  }

  /** 应用预设：整套 ProjectTheme 填入。 */
  function applyPreset(presetKey: string) {
    const preset = STYLE_PRESETS.find((p) => p.key === presetKey);
    if (!preset) return;
    const patch: ThemePatch = {
      color: { ...preset.theme.color },
      font: { ...preset.theme.font },
      density: preset.theme.density,
      radius: preset.theme.radius,
      layout: { ...preset.theme.layout },
      shadow: preset.theme.shadow,
      preset: preset.key,
    };
    setTheme(patch);
  }

  /** 手改配色字段：清空 preset 高亮。 */
  function updateColor(field: keyof ProjectTheme['color'], value: string) {
    setTheme({ color: { [field]: value }, preset: undefined });
  }

  /** 手改图表配色序列中的单色。 */
  function updateChartColor(index: number, value: string) {
    const newPalette = [...theme.color.chartPalette];
    newPalette[index] = value;
    setTheme({ color: { chartPalette: newPalette }, preset: undefined });
  }

  /** 手改字体字段：清空 preset 高亮。 */
  function updateFont(field: keyof ProjectTheme['font'], value: string | undefined) {
    setTheme({ font: { [field]: value }, preset: undefined });
  }

  function updateDensity(d: ThemeDensity) {
    setTheme({ density: d, preset: undefined });
  }

  function updateRadius(r: ThemeRadius) {
    setTheme({ radius: r, preset: undefined });
  }

  /** 手改布局字段：清空 preset 高亮。 */
  function updateLayout<K extends keyof NonNullable<ProjectTheme['layout']>>(
    field: K,
    value: NonNullable<ProjectTheme['layout']>[K],
  ) {
    setTheme({ layout: { [field]: value }, preset: undefined });
  }

  /** 手改行高字段：清空 preset 高亮。 */
  function updateLineHeight<K extends keyof NonNullable<ProjectTheme['lineHeight']>>(
    field: K,
    value: NonNullable<ProjectTheme['lineHeight']>[K],
  ) {
    setTheme({ lineHeight: { [field]: value }, preset: undefined });
  }

  /** 手改标题样式字段：清空 preset 高亮。 */
  function updateHeading<K extends keyof NonNullable<ProjectTheme['heading']>>(
    field: K,
    value: NonNullable<ProjectTheme['heading']>[K],
  ) {
    setTheme({ heading: { [field]: value }, preset: undefined });
  }

  /** 手改数字/币种格式字段：清空 preset 高亮。 */
  function updateFormat<K extends keyof NonNullable<ProjectTheme['format']>>(
    field: K,
    value: NonNullable<ProjectTheme['format']>[K],
  ) {
    setTheme({ format: { [field]: value }, preset: undefined });
  }

  /** 手改图表样式字段：清空 preset 高亮。 */
  function updateChart<K extends keyof NonNullable<ProjectTheme['chart']>>(
    field: K,
    value: NonNullable<ProjectTheme['chart']>[K],
  ) {
    setTheme({ chart: { [field]: value }, preset: undefined });
  }

  function updateShadow(s: NonNullable<ProjectTheme['shadow']>) {
    setTheme({ shadow: s, preset: undefined });
  }

  /** 更新品牌配置字段。 */
  function updateBranding<K extends keyof NonNullable<ProjectTheme['branding']>>(
    field: K,
    value: NonNullable<ProjectTheme['branding']>[K],
  ) {
    setTheme({ branding: { [field]: value }, preset: undefined });
  }

  /** 更新默认背景配置字段。 */
  function updateBackground<K extends keyof NonNullable<ProjectTheme['background']>>(
    field: K,
    value: NonNullable<ProjectTheme['background']>[K],
  ) {
    setTheme({ background: { [field]: value }, preset: undefined });
  }

  /** 把默认背景批量应用到所有页面。 */
  function applyBackgroundToAllPages() {
    const bg = theme.background;
    if (!bg || bg.type === 'none') return;
    const store = useEditorStore.getState();
    for (const page of store.pages) {
      store.updatePage(page.id, {
        bgColor: bg.type === 'color' ? bg.color : undefined,
        bgGradient: bg.type === 'gradient' ? bg.gradient : undefined,
        bgImage: bg.type === 'image' ? bg.image : undefined,
      });
    }
    setToast(`已应用到 ${store.pages.length} 个页面`);
    setTimeout(() => setToast(null), 2500);
  }

  /** 解析参考图占位：弹 toast（为后续 vision 接入预留入口）。 */
  function handleParseReference() {
    setToast('参考图解析即将上线，敬请期待');
    setTimeout(() => setToast(null), 2500);
  }

  const customOpts = customFonts.map(customFontToOption);
  const textFonts = [...FONT_OPTIONS.filter((f) => f.category === 'text'), ...customOpts];
  const numberFonts = [...FONT_OPTIONS.filter((f) => f.category === 'number'), ...customOpts];
  const headingFonts = [...FONT_OPTIONS, ...customOpts]; // 标题可选任意字体 + "跟随文本"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-surface-primary shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <div>
            <div className="font-headings text-lg font-semibold text-foreground-primary">全局样式设置</div>
            <p className="text-xs text-foreground-secondary">整体风格驱动整份报告的配色、字体、密度与布局。</p>
          </div>
          <div className="flex items-center gap-3">
            {bl?.logo && (
              <div className="flex items-center gap-2">
                <img
                  src={bl.logo}
                  alt={bl.name}
                  className="h-8 w-8 rounded-lg object-contain"
                  draggable={false}
                />
                <span className="text-xs text-foreground-secondary">{bl.name}</span>
              </div>
            )}
            <button onClick={onClose} className="text-foreground-muted hover:text-foreground-primary">✕</button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* 左导航 */}
          <nav className="w-52 flex-none space-y-1 border-r border-border-subtle p-3">
            {CATS.map((c) => (
              <button
                key={c.key}
                onClick={() => setActiveCat(c.key)}
                className={`w-full rounded-lg px-3 py-1.5 text-left text-sm transition ${
                  activeCat === c.key
                    ? 'bg-accent-primary/10 font-medium text-accent-primary'
                    : 'text-foreground-secondary hover:bg-surface-hover'
                }`}
              >
                {c.label}
              </button>
            ))}
          </nav>

          {/* 右内容：按 activeCat 渲染对应 sections（现有 section JSX 原样搬入） */}
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {activeCat === 'basic' && (
              <>
                {/* ① 预设选择器 */}
                <section>
                  <div className="mb-2 text-xs font-semibold text-foreground-secondary">整体风格预设</div>
                  <div className="flex flex-wrap gap-2">
                    {STYLE_PRESETS.map((preset) => {
                      const active = theme.preset === preset.key;
                      return (
                        <button
                          key={preset.key}
                          onClick={() => applyPreset(preset.key)}
                          className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                            active
                              ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                              : 'border-border-default text-foreground-secondary hover:border-foreground-muted'
                          }`}
                          title={preset.description}
                        >
                          {preset.name}
                        </button>
                      );
                    })}
                  </div>
                  {theme.preset && (
                    <div className="mt-1 text-[11px] text-foreground-muted">
                      {STYLE_PRESETS.find((p) => p.key === theme.preset)?.description ?? ''}
                    </div>
                  )}
                </section>

                {/* ② 配色 */}
                <section className="space-y-3">
                  <div className="text-xs font-semibold text-foreground-secondary">配色</div>

                  {/* 主品牌色 + 次品牌色 */}
                  <div className="grid grid-cols-2 gap-3">
                    <ColorField
                      label="主品牌色"
                      value={theme.color.primary}
                      presetSwatches={PRESET_PRIMARIES}
                      onChange={(v) => updateColor('primary', v)}
                    />
                    <ColorField
                      label="次品牌色"
                      value={theme.color.secondary}
                      onChange={(v) => updateColor('secondary', v)}
                    />
                  </div>

                  {/* 中性文字色 + 背景色 */}
                  <div className="grid grid-cols-2 gap-3">
                    <ColorField
                      label="中性文字色"
                      value={theme.color.neutralText}
                      onChange={(v) => updateColor('neutralText', v)}
                    />
                    <ColorField
                      label="背景色"
                      value={theme.color.neutralBg}
                      onChange={(v) => updateColor('neutralBg', v)}
                    />
                  </div>

                  {/* 图表配色板 6 色 */}
                  <div>
                    <div className="mb-1.5 text-[11px] text-foreground-muted">图表配色（6 色序列）</div>
                    <div className="flex flex-wrap gap-2">
                      {theme.color.chartPalette.map((c, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <input
                            type="color"
                            value={c}
                            onChange={(e) => updateChartColor(i, e.target.value)}
                            className="h-7 w-8 cursor-pointer rounded border border-border-default p-0.5"
                          />
                          <span className="text-[10px] text-foreground-muted">{i + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* ③ 字体 */}
                <section className="space-y-2">
                  <div className="text-xs font-semibold text-foreground-secondary">字体</div>
                  <FontSelect
                    label="文本字体"
                    value={theme.font.text}
                    options={textFonts}
                    onChange={(v) => updateFont('text', v)}
                  />
                  <FontSelect
                    label="数字字体"
                    value={theme.font.number}
                    options={numberFonts}
                    onChange={(v) => updateFont('number', v)}
                  />
                  <FontSelect
                    label="标题字体"
                    value={theme.font.heading ?? ''}
                    options={headingFonts}
                    includeFollowText
                    onChange={(v) => updateFont('heading', v || undefined)}
                  />
                </section>

                {/* 自定义字体上传 */}
                <section className="space-y-2">
                  <div className="text-xs font-semibold text-foreground-secondary">自定义字体</div>
                  <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-border-subtle px-3 py-2 text-xs text-foreground-muted hover:border-accent-primary hover:text-accent-primary">
                    {uploadingFont ? '上传中…' : '点击上传 TTF / OTF / WOFF / WOFF2 / ZIP'}
                    <input
                      type="file"
                      accept=".ttf,.otf,.woff,.woff2,.zip"
                      className="hidden"
                      disabled={uploadingFont}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingFont(true);
                        try {
                          const metas = await uploadFont(file);
                          registerCustomFonts(metas);
                          setToast(`已上传 ${metas.length} 个字体`);
                          setTimeout(() => setToast(null), 2500);
                        } catch {
                          setToast('字体上传失败');
                          setTimeout(() => setToast(null), 2500);
                        } finally {
                          setUploadingFont(false);
                          e.target.value = '';
                        }
                      }}
                    />
                  </label>
                  {customFonts.length > 0 && (
                    <div className="space-y-1">
                      {customFonts.map((cf) => (
                        <div key={cf.id} className="flex items-center justify-between rounded-md bg-surface-secondary px-2 py-1 text-xs">
                          <span className="truncate text-foreground-secondary">{cf.name}</span>
                          <button
                            type="button"
                            className="text-red hover:underline"
                            onClick={async () => {
                              try { await deleteFont(cf.id); unregisterCustomFont(cf.id); }
                              catch { setToast('删除失败'); setTimeout(() => setToast(null), 2500); }
                            }}
                          >
                            删除
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                <section className="space-y-2">
                  <div className="text-xs font-semibold text-foreground-secondary">标题样式</div>
                  <div className="flex items-center gap-2">
                    <span className="w-16 flex-none text-[11px] text-foreground-muted">字号</span>
                    <input
                      type="number"
                      min={8}
                      max={200}
                      step={1}
                      value={heading.fontSize ?? 32}
                      onChange={(e) => updateHeading('fontSize', Math.min(200, Math.max(8, Number(e.target.value) || 32)))}
                      className="w-24 rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
                    />
                    <span className="text-[11px] text-foreground-muted">px</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-16 flex-none text-[11px] text-foreground-muted">默认样式</span>
                    <select
                      value={heading.variant ?? ''}
                      onChange={(e) =>
                        updateHeading('variant', (e.target.value || undefined) as NonNullable<ProjectTheme['heading']>['variant'])
                      }
                      className="flex-1 rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary"
                    >
                      <option value="">跟随组件</option>
                      {TITLE_STYLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-16 flex-none text-[11px] text-foreground-muted">主色</span>
                    <input
                      type="color"
                      value={heading.color ?? theme.color.primary}
                      onChange={(e) => updateHeading('color', e.target.value)}
                      className="h-7 w-10 flex-none rounded border border-border-default bg-surface-primary"
                    />
                    <span className="text-[11px] text-foreground-muted">新标题块初始主色</span>
                  </div>
                </section>

                {/* ④ 密度 */}
                <section>
                  <div className="mb-2 text-xs font-semibold text-foreground-secondary">密度</div>
                  <div className="flex gap-2">
                    {DENSITY_OPTIONS.map((opt) => (
                      <Chip
                        key={opt.value}
                        active={theme.density === opt.value}
                        onClick={() => updateDensity(opt.value)}
                      >
                        {opt.label}
                      </Chip>
                    ))}
                  </div>
                </section>

                {/* 行高 */}
                <section className="space-y-2">
                  <div className="text-xs font-semibold text-foreground-secondary">行高（文本组件）</div>
                  <div className="flex gap-2">
                    {(['ratio', 'fixed'] as const).map((m) => (
                      <Chip key={m} active={lineHeight.mode === m} onClick={() => updateLineHeight('mode', m)}>
                        {m === 'ratio' ? '倍数 ×n' : '加法 +px'}
                      </Chip>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={lineHeight.mode === 'ratio' ? 3 : 100}
                    step={lineHeight.mode === 'ratio' ? 0.05 : 1}
                    value={lineHeight.value}
                    onChange={(e) => updateLineHeight('value', Math.max(0, Number(e.target.value) || 0))}
                    className="w-24 rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
                  />
                  <p className="text-[11px] text-foreground-muted">
                    {lineHeight.mode === 'ratio' ? `行高 = 字号 × ${lineHeight.value}` : `行高 = 字号 + ${lineHeight.value}px`}
                  </p>
                </section>

                {/* 币种与数字 */}
                <section className="space-y-2">
                  <div className="text-xs font-semibold text-foreground-secondary">币种与数字</div>
                  <div className="flex items-center gap-2">
                    <input
                      value={format.currencySymbol}
                      onChange={(e) => updateFormat('currencySymbol', e.target.value || '$')}
                      className="w-16 rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
                    />
                    <select
                      value={format.currencyPosition}
                      onChange={(e) => updateFormat('currencyPosition', e.target.value as 'before' | 'after')}
                      className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary"
                    >
                      <option value="before">符号在前</option>
                      <option value="after">符号在后</option>
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-foreground-secondary">
                      <input
                        type="checkbox"
                        checked={format.thousandsSep}
                        onChange={(e) => updateFormat('thousandsSep', e.target.checked)}
                      />
                      千分位
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-foreground-secondary">
                      小数位
                      <select
                        value={format.decimals}
                        onChange={(e) => updateFormat('decimals', Number(e.target.value) as 0 | 1 | 2)}
                        className="rounded border border-border-default bg-surface-primary px-1 py-0.5 text-xs"
                      >
                        <option value={0}>0</option>
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-foreground-secondary">
                      <input
                        type="checkbox"
                        checked={format.compact === 'auto'}
                        onChange={(e) => updateFormat('compact', e.target.checked ? 'auto' : 'none')}
                      />
                      K/M 缩写
                    </label>
                  </div>
                </section>

                {/* ⑨ 解析参考图（占位） */}
                <section className="border-t border-border-subtle pt-4">
                  <button
                    onClick={handleParseReference}
                    className="rounded-lg border border-border-default px-4 py-2 text-sm text-foreground-secondary transition hover:border-foreground-muted hover:text-foreground-primary"
                  >
                    📷 解析参考图
                  </button>
                  <p className="mt-1 text-[11px] text-foreground-muted">
                    上传参考图自动提取配色与字体（即将上线）。
                  </p>
                </section>
              </>
            )}
            {activeCat === 'layout' && (
              <>
                {/* ⑥ 布局：安全距离 + 网格 */}
                <section className="space-y-3">
                  <div className="text-xs font-semibold text-foreground-secondary">布局</div>

                  {/* 安全距离 */}
                  <div>
                    <div className="mb-1.5 text-[11px] font-medium text-foreground-secondary">安全距离（px）</div>
                    <div className="flex flex-wrap gap-1">
                      {[24, 48, 64, 96].map((m) => (
                        <Chip key={m} active={layout.safeMargin === m} onClick={() => updateLayout('safeMargin', m)}>
                          {m}
                        </Chip>
                      ))}
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={500}
                      value={layout.safeMargin}
                      onChange={(e) =>
                        updateLayout('safeMargin', Math.max(0, Math.min(500, Number(e.target.value) || 0)))
                      }
                      className="mt-1.5 w-24 rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
                    />
                  </div>

                  {/* 网格大小 */}
                  <div>
                    <div className="mb-1.5 text-[11px] font-medium text-foreground-secondary">网格大小（px）</div>
                    <div className="flex flex-wrap gap-1">
                      {[8, 10, 12, 20].map((g) => (
                        <Chip key={g} active={layout.gridSize === g} onClick={() => updateLayout('gridSize', g)}>
                          {g}
                        </Chip>
                      ))}
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={layout.gridSize}
                      onChange={(e) =>
                        updateLayout('gridSize', Math.max(1, Math.min(100, Number(e.target.value) || 1)))
                      }
                      className="mt-1.5 w-24 rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
                    />
                  </div>

                  {/* 显示开关 */}
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 text-xs text-foreground-secondary">
                      <input
                        type="checkbox"
                        checked={layout.showGrid ?? true}
                        onChange={(e) => updateLayout('showGrid', e.target.checked)}
                      />
                      显示网格
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-foreground-secondary">
                      <input
                        type="checkbox"
                        checked={layout.showSafeArea ?? true}
                        onChange={(e) => updateLayout('showSafeArea', e.target.checked)}
                      />
                      显示安全区
                    </label>
                  </div>
                </section>
              </>
            )}
            {activeCat === 'component' && (
              <>
                {/* ⑤ 圆角 */}
                <section>
                  <div className="mb-2 text-xs font-semibold text-foreground-secondary">圆角</div>
                  <div className="flex gap-2">
                    {RADIUS_OPTIONS.map((opt) => (
                      <Chip
                        key={opt.value}
                        active={theme.radius === opt.value}
                        onClick={() => updateRadius(opt.value)}
                      >
                        {opt.label}
                      </Chip>
                    ))}
                  </div>
                </section>

                {/* 卡片阴影 */}
                <section>
                  <div className="mb-2 text-xs font-semibold text-foreground-secondary">卡片阴影</div>
                  <div className="flex flex-wrap gap-2">
                    {(['none', 'subtle', 'soft', 'strong'] as const).map((s) => (
                      <Chip key={s} active={shadow === s} onClick={() => updateShadow(s)}>
                        {{ none: '无', subtle: '细微', soft: '柔和', strong: '强烈' }[s]}
                      </Chip>
                    ))}
                  </div>
                </section>

                {/* 图表样式 */}
                <section className="space-y-2">
                  <div className="text-xs font-semibold text-foreground-secondary">图表样式</div>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-foreground-secondary">
                      <input
                        type="checkbox"
                        checked={chart.showAxis}
                        onChange={(e) => updateChart('showAxis', e.target.checked)}
                      />
                      坐标轴
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-foreground-secondary">
                      <input
                        type="checkbox"
                        checked={chart.showGrid}
                        onChange={(e) => updateChart('showGrid', e.target.checked)}
                      />
                      网格线
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-foreground-secondary">
                      图例
                      <select
                        value={chart.legendPosition}
                        onChange={(e) => updateChart('legendPosition', e.target.value as 'none' | 'top' | 'bottom' | 'right')}
                        className="rounded border border-border-default bg-surface-primary px-1 py-0.5 text-xs"
                      >
                        <option value="none">无</option>
                        <option value="top">上</option>
                        <option value="bottom">下</option>
                        <option value="right">右</option>
                      </select>
                    </label>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-foreground-secondary">
                    柱圆角 {chart.barRadius}px
                    <input
                      type="range"
                      min={0}
                      max={16}
                      value={chart.barRadius}
                      onChange={(e) => updateChart('barRadius', Math.max(0, Math.min(16, Number(e.target.value) || 0)))}
                    />
                  </label>
                </section>

                {/* ⑧ 默认页面背景 */}
                <section className="space-y-3 border-t border-border-subtle pt-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-foreground-secondary">默认页面背景</div>
                    {theme.background && theme.background.type !== 'none' && (
                      <button
                        onClick={applyBackgroundToAllPages}
                        className="text-[11px] text-accent-primary hover:underline"
                      >
                        应用到全部页面
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {(['none', 'color', 'gradient', 'image'] as const).map((t) => {
                      const labels: Record<string, string> = { none: '无', color: '纯色', gradient: '渐变', image: '图片' };
                      const active = (theme.background?.type ?? 'none') === t;
                      return (
                        <button
                          key={t}
                          onClick={() => updateBackground('type', t)}
                          className={`rounded border px-2 py-1 text-xs ${
                            active
                              ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                              : 'border-border-default text-foreground-secondary hover:bg-surface-hover'
                          }`}
                        >
                          {labels[t]}
                        </button>
                      );
                    })}
                  </div>

                  {theme.background?.type === 'color' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={theme.background.color ?? 'var(--surface-primary)'}
                        onChange={(e) => updateBackground('color', e.target.value)}
                        className="h-8 w-10 rounded border border-border-default p-1"
                      />
                      <input
                        value={theme.background.color ?? ''}
                        placeholder="var(--surface-primary)"
                        onChange={(e) => updateBackground('color', e.target.value)}
                        className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
                      />
                    </div>
                  )}

                  {theme.background?.type === 'image' && (
                    <ImageInput
                      value={theme.background.image ?? ''}
                      onChange={(url) => updateBackground('image', url || undefined)}
                    />
                  )}

                  {theme.background?.type === 'gradient' && (
                    <BackgroundGradientFields
                      gradient={theme.background.gradient}
                      onChange={(g) => updateBackground('gradient', g)}
                    />
                  )}
                </section>
              </>
            )}
            {activeCat === 'brand' && (
              <>
                {/* ⑦ 品牌：Logo + 标题 + 副标题 */}
                <section className="space-y-3 border-t border-border-subtle pt-4">
                  <div className="text-xs font-semibold text-foreground-secondary">品牌</div>

                  {/* Logo */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-foreground-muted">Logo</div>
                    <ImageInput
                      value={theme.branding?.logo ?? ''}
                      onChange={(url) => updateBranding('logo', url || undefined)}
                    />
                    {(theme.branding?.logo) && (
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-[11px] text-foreground-secondary">
                          高度
                          <input
                            type="number"
                            min={8}
                            max={200}
                            value={theme.branding?.logoHeight ?? 32}
                            onChange={(e) => updateBranding('logoHeight', Math.max(8, Math.min(200, Number(e.target.value) || 32)))}
                            className="w-16 rounded border border-border-default px-1 py-0.5 text-xs text-foreground-primary"
                          />
                          px
                        </label>
                        <label className="flex items-center gap-1 text-[11px] text-foreground-secondary">
                          圆角
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={theme.branding?.logoRadius ?? 0}
                            onChange={(e) => updateBranding('logoRadius', Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                            className="w-16 rounded border border-border-default px-1 py-0.5 text-xs text-foreground-primary"
                          />
                          px
                        </label>
                      </div>
                    )}
                  </div>

                  {/* 品牌标题 */}
                  <div>
                    <label className="mb-1 block text-[11px] text-foreground-muted">品牌标题（留空=跟随项目广告主名）</label>
                    <input
                      value={theme.branding?.title ?? ''}
                      onChange={(e) => updateBranding('title', e.target.value || undefined)}
                      placeholder="如 品牌名称"
                      className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
                    />
                  </div>

                  {/* 品牌副标题 */}
                  <div>
                    <label className="mb-1 block text-[11px] text-foreground-muted">品牌副标题</label>
                    <input
                      value={theme.branding?.subtitle ?? ''}
                      onChange={(e) => updateBranding('subtitle', e.target.value || undefined)}
                      placeholder="如 Q4 Campaign Report 2026"
                      className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
                    />
                  </div>
                </section>
              </>
            )}
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="flex justify-end gap-2 border-t border-border-subtle px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-border-default px-4 py-1.5 text-sm text-foreground-secondary hover:bg-surface-hover"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-accent-primary px-4 py-1.5 text-sm text-white hover:opacity-90"
          >
            保存
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-foreground-primary px-4 py-2 text-sm text-surface-primary shadow-lg">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ 子组件 ------------------------------ */

/** 颜色字段：色板快选 + color picker + hex 输入。 */
function ColorField({
  label,
  value,
  presetSwatches,
  onChange,
}: {
  label: string;
  value: string;
  presetSwatches?: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-medium text-foreground-secondary">{label}</div>
      {presetSwatches && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {presetSwatches.map((c) => (
            <button
              key={c}
              onClick={() => onChange(c)}
              className={`h-5 w-5 rounded-full border-2 ${
                value.toLowerCase() === c ? 'border-foreground-primary' : 'border-transparent'
              }`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 cursor-pointer rounded border border-border-default p-0.5"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
        />
      </div>
    </div>
  );
}

/** 字体下拉选择。 */
function FontSelect({
  label,
  value,
  options,
  includeFollowText,
  onChange,
}: {
  label: string;
  value: string;
  options: { key: string; label: string }[];
  includeFollowText?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-20 flex-none text-[11px] font-medium text-foreground-secondary">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary"
      >
        {includeFollowText && <option value="">跟随文本字体</option>}
        {options.map((opt) => (
          <option key={opt.key} value={opt.key}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** chip 选择器（密度 / 圆角 / 预设共用）。 */
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3 py-1 text-sm transition ${
        active
          ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
          : 'border-border-default text-foreground-secondary hover:border-foreground-muted'
      }`}
    >
      {children}
    </button>
  );
}

/** 默认背景的渐变编辑器：简化版（类型 + 角度 + 色标增删）。 */
function BackgroundGradientFields({
  gradient,
  onChange,
}: {
  gradient: PageGradient | undefined;
  onChange: (g: PageGradient) => void;
}) {
  const grad: PageGradient = gradient ?? {
    type: 'linear',
    angle: 180,
    stops: [
      { color: 'var(--surface-primary)', position: 0 },
      { color: 'var(--border-subtle)', position: 100 },
    ],
  };

  const setType = (type: 'linear' | 'radial') => onChange({ ...grad, type });
  const setAngle = (angle: number) => onChange({ ...grad, angle: Math.max(0, Math.min(360, angle)) });
  const setStopColor = (i: number, color: string) =>
    onChange({ ...grad, stops: grad.stops.map((s, idx) => (idx === i ? { ...s, color } : s)) });
  const setStopPos = (i: number, position: number) =>
    onChange({ ...grad, stops: grad.stops.map((s, idx) => (idx === i ? { ...s, position: Math.max(0, Math.min(100, position)) } : s)) });
  const addStop = () => {
    if (grad.stops.length >= 6) return;
    const last = grad.stops[grad.stops.length - 1];
    const pos = Math.min(100, Math.round((last?.position ?? 0) + (100 - (last?.position ?? 0)) / 2));
    onChange({ ...grad, stops: [...grad.stops, { color: last?.color ?? 'var(--surface-primary)', position: pos }] });
  };
  const removeStop = (i: number) => {
    if (grad.stops.length <= 2) return;
    onChange({ ...grad, stops: grad.stops.filter((_, idx) => idx !== i) });
  };

  const angle = grad.angle ?? 180;
  const stopStr = grad.stops.slice().sort((a, b) => a.position - b.position).map((s) => `${s.color} ${s.position}%`).join(', ');
  const preview = grad.type === 'radial'
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
      )}

      <div className="space-y-1">
        {grad.stops.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              type="color"
              value={s.color}
              onChange={(e) => setStopColor(i, e.target.value)}
              className="h-6 w-6 rounded border border-border-default"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={s.position}
              onChange={(e) => setStopPos(i, Number(e.target.value))}
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
