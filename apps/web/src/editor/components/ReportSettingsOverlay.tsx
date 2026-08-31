import { useSyncExternalStore, useState } from 'react';
import {
  DEFAULT_THEME,
  FONT_OPTIONS,
  STYLE_PRESETS,
  type ProjectTheme,
  type ThemeDensity,
  type ThemeRadius,
  type GlobalHeaderConfig,
  type GlobalFooterConfig,
  type HeaderBackground,
} from '@mediakit/shared';
import type { PageGradient } from '@mediakit/shared';
import { useEditorStore } from '../store';
import type { ThemePatch } from '../store';
import { ImageInput } from '@/components/ImageInput';
import { useBusinessLineInfo } from '@/editor/useBusinessLineLogo';
import { lookupApi } from '@/api/lookup';
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
    glass: 'glass' in patch ? patch.glass : prev.glass,
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

  // ── 页眉页脚 draft 状态 ──
  const [hfHeader, setHfHeader] = useState<GlobalHeaderConfig>(
    () => useEditorStore.getState().projectMeta?.headerConfig ?? { enabled: false, height: 56, background: '#ffffff' },
  );
  const [hfFooter, setHfFooter] = useState<GlobalFooterConfig>(
    () => useEditorStore.getState().projectMeta?.footerConfig ?? { enabled: false, height: 36, background: '#f8f8f8' },
  );
  const [hfSyncing, setHfSyncing] = useState(false);

  // 业务线 Logo（标题栏右上角，只读；数据库唯一来源）
  const businessLine = useEditorStore((s) => s.projectMeta?.businessLine);
  const meta = useEditorStore((s) => s.projectMeta);
  const updateProjectMeta = useEditorStore((s) => s.updateProjectMeta);
  const bl = useBusinessLineInfo(businessLine);

  // 左导航分类
  type Cat = 'basic' | 'layout' | 'component' | 'header-footer';
  const [activeCat, setActiveCat] = useState<Cat>('basic');
  const CATS: { key: Cat; label: string }[] = [
    { key: 'basic', label: '基础样式' },
    { key: 'layout', label: '布局' },
    { key: 'component', label: '组件样式' },
    { key: 'header-footer', label: '页眉页脚' },
  ];

  /** 保存：把 draft 整体提交到 store（深合并等价整体替换），然后关闭浮层。 */
  function handleSave() {
    commitTheme(draft);
    // 保存时如果背景类型非 none，自动应用到所有未单独设置背景的页面
    const bg = draft.background;
    if (bg && bg.type !== 'none') {
      const store = useEditorStore.getState();
      const bgPatch = {
        bgColor: bg.type === 'color' ? bg.color : undefined,
        bgGradient: bg.type === 'gradient' ? bg.gradient : undefined,
        bgImage: bg.type === 'image' ? bg.image : undefined,
      };
      // 仅更新没有独立背景设置的页面（保留用户手动设置过的）
      store.applyBackgroundToPagesWithoutOwn(bgPatch);
    }
    // 同时提交页眉页脚配置
    useEditorStore.getState().updateProjectMeta({ headerConfig: hfHeader, footerConfig: hfFooter });
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

  /** 0828 毛玻璃开关：卡片容器全局切半透明+backdrop-filter。 */
  function updateGlass(on: boolean) {
    setTheme({ glass: on, preset: undefined });
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
    // 用一次性 mutateAndCommit 替代循环 updatePage，避免推入 N 条历史快照。
    const bgPatch = {
      bgColor: bg.type === 'color' ? bg.color : undefined,
      bgGradient: bg.type === 'gradient' ? bg.gradient : undefined,
      bgImage: bg.type === 'image' ? bg.image : undefined,
    };
    store.applyBackgroundBatch(bgPatch);
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
            <div className="font-headings text-lg skin-fw-heading text-foreground-primary">全局样式设置</div>
            <p className="text-xs text-foreground-secondary">整体风格驱动整份报告的配色、字体、密度与布局。</p>
          </div>
          <div className="flex items-center skin-gap-md">
            {bl?.logo && (
              <div className="flex items-center skin-gap-sm">
                <img
                  src={bl.logo}
                  alt={bl.title || bl.code}
                  className="h-8 w-8 rounded-lg object-contain"
                  draggable={false}
                />
                <span className="text-xs text-foreground-secondary">{bl.title || bl.code}</span>
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
                    ? 'bg-accent-primary/10 skin-fw-body text-accent-primary'
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
                  <div className="mb-2 text-xs skin-fw-heading text-foreground-secondary">整体风格预设</div>
                  <div className="flex flex-wrap skin-gap-sm">
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

                {/* ①.5 报告周期 */}
                <section className="space-y-2">
                  <div className="text-xs skin-fw-heading text-foreground-secondary">报告周期</div>
                  <div className="flex items-center skin-gap-sm">
                    <select
                      value={meta?.scenarioSub ?? 'monthly'}
                      onChange={(e) => updateProjectMeta({ scenarioSub: e.target.value as 'monthly' | 'weekly' | 'wrap-up' })}
                      className="rounded-lg border border-border-default bg-surface-primary px-2 py-1.5 text-sm"
                    >
                      <option value="monthly">月报</option>
                      <option value="weekly">周报</option>
                      <option value="wrap-up">总结</option>
                    </select>
                    {meta?.scenarioSub === 'monthly' ? (
                      <input
                        type="month"
                        value={meta?.reportPeriod?.month ?? ''}
                        onChange={(e) => updateProjectMeta({ reportPeriod: { ...meta?.reportPeriod, month: e.target.value } })}
                        className="rounded-lg border border-border-default bg-surface-primary px-2 py-1.5 text-sm"
                      />
                    ) : meta?.scenarioSub === 'weekly' ? (
                      <div className="flex items-center skin-gap-xs">
                        <input
                          type="date"
                          value={meta?.reportPeriod?.startDate ?? ''}
                          onChange={(e) => updateProjectMeta({ reportPeriod: { ...meta?.reportPeriod, startDate: e.target.value } })}
                          className="rounded-lg border border-border-default bg-surface-primary px-2 py-1.5 text-sm"
                        />
                        <span className="text-xs text-foreground-muted">~</span>
                        <input
                          type="date"
                          value={meta?.reportPeriod?.endDate ?? ''}
                          onChange={(e) => updateProjectMeta({ reportPeriod: { ...meta?.reportPeriod, endDate: e.target.value } })}
                          className="rounded-lg border border-border-default bg-surface-primary px-2 py-1.5 text-sm"
                        />
                      </div>
                    ) : null}
                  </div>
                </section>
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs skin-fw-heading text-foreground-secondary">配色</div>
                    {/* 从业务线自动同步品牌色 + design.md 样式 */}
                    <button
                      onClick={async () => {
                        if (!businessLine) { setToast('请先选择业务线'); setTimeout(() => setToast(null), 2500); return; }
                        try {
                          const allBL = await lookupApi.listBusinessLines();
                          const bl = allBL.find((b) => b.code === businessLine);
                          if (!bl) { setToast(`未找到业务线 "${businessLine}"`); setTimeout(() => setToast(null), 2500); return; }

                          // 1. 品牌色：从 BusinessLine.color 同步
                          if (bl.color) {
                            setTheme({ color: { primary: bl.color } });
                          }

                          // 2. 解析 design.md 提取样式值
                          if (bl.designMd) {
                            const md = bl.designMd;
                            const colorPatch: Record<string, string> = {};
                            const fontPatch: Record<string, string> = {};

                            // 提取配色 hex/rgb
                            const colorMatches = [...md.matchAll(/(?:#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b/g)].map((m) => m[0]);
                            if (bl.color) colorPatch.primary = bl.color;
                            if (colorMatches.length >= 2) colorPatch.secondary = colorMatches[1];

                            // 提取字体名称
                            const fontMatch = md.match(/字体[：:]\s*[「「"]?([^」"\n,，、\s]{2,20})/);
                            let fontLabel = '';
                            if (fontMatch) {
                              fontPatch.heading = fontMatch[1];
                              fontPatch.body = fontMatch[1];
                              fontLabel = fontMatch[1];
                            }

                            // 提取圆角
                            let radiusVal: 'sharp' | 'small' | 'medium' | 'large' | '' = '';
                            const radiusMatch = md.match(/(?:圆角|radius)[：:]\s*(\d+)/);
                            if (radiusMatch) {
                              const r = parseInt(radiusMatch[1]);
                              radiusVal = r <= 2 ? 'sharp' : r <= 8 ? 'small' : r <= 16 ? 'medium' : 'large';
                            }

                            // 提取间距/密度
                            let densityVal: 'compact' | 'standard' | 'comfortable' | 'spacious' | '' = '';
                            const spacingMatch = md.match(/(?:间距|padding|spacing)[：:]\s*(\d+)/);
                            if (spacingMatch) {
                              const s = parseInt(spacingMatch[1]);
                              densityVal = s <= 8 ? 'compact' : s <= 16 ? 'standard' : s <= 24 ? 'comfortable' : 'spacious';
                            }

                            // 应用
                            const parts: string[] = [];
                            if (Object.keys(colorPatch).length > 0) {
                              setTheme({ color: colorPatch });
                              parts.push(`品牌色 ${bl.color ?? ''}`);
                            }
                            if (Object.keys(fontPatch).length > 0) {
                              setTheme({ font: fontPatch });
                              parts.push(`字体 ${fontLabel}`);
                            }
                            if (radiusVal) {
                              setTheme({ radius: radiusVal });
                              parts.push('圆角');
                            }
                            if (densityVal) {
                              setTheme({ density: densityVal });
                              parts.push('间距');
                            }

                            setToast(parts.length ? `已同步：${parts.join(' + ')}` : 'design.md 无可解析样式');
                          } else if (bl.color) {
                            setToast(`已同步品牌色 ${bl.color}（无 design.md）`);
                          } else {
                            setToast('业务线无品牌色和 design.md');
                          }
                          setTimeout(() => setToast(null), 3000);
                        } catch {
                          setToast('同步失败'); setTimeout(() => setToast(null), 2500);
                        }
                      }}
                      disabled={!businessLine}
                      className="rounded-lg border border-accent-primary/40 bg-accent-primary/5 px-2.5 py-1 text-[10px] skin-fw-body text-accent-primary hover:bg-accent-primary/10 disabled:opacity-50"
                    >
                      🔄 从业务线同步
                    </button>
                  </div>

                  {/* 主品牌色 + 次品牌色 */}
                  <div className="grid grid-cols-2 skin-gap-md">
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
                  <div className="grid grid-cols-2 skin-gap-md">
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
                    <div className="flex flex-wrap skin-gap-sm">
                      {theme.color.chartPalette.map((c, i) => (
                        <div key={i} className="flex items-center skin-gap-xs">
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
                  <div className="text-xs skin-fw-heading text-foreground-secondary">字体</div>
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
                  <div className="text-xs skin-fw-heading text-foreground-secondary">自定义字体</div>
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
                  <div className="text-xs skin-fw-heading text-foreground-secondary">标题样式</div>
                  <div className="flex items-center skin-gap-sm">
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
                  <div className="flex items-center skin-gap-sm">
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
                  <div className="flex items-center skin-gap-sm">
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
                  <div className="mb-2 text-xs skin-fw-heading text-foreground-secondary">密度</div>
                  <div className="flex skin-gap-sm">
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
                  <div className="text-xs skin-fw-heading text-foreground-secondary">行高（文本组件）</div>
                  <div className="flex skin-gap-sm">
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
                  <div className="text-xs skin-fw-heading text-foreground-secondary">币种与数字</div>
                  <div className="flex items-center skin-gap-sm">
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
                  <div className="flex flex-wrap skin-gap-md">
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
                  <div className="text-xs skin-fw-heading text-foreground-secondary">布局</div>

                  {/* 安全距离 */}
                  <div>
                    <div className="mb-1.5 text-[11px] skin-fw-body text-foreground-secondary">安全距离（px）</div>
                    <div className="flex flex-wrap skin-gap-xs">
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
                    <div className="mb-1.5 text-[11px] skin-fw-body text-foreground-secondary">网格大小（px）</div>
                    <div className="flex flex-wrap skin-gap-xs">
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
                  <div className="flex skin-gap-lg">
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
                  <div className="mb-2 text-xs skin-fw-heading text-foreground-secondary">圆角</div>
                  <div className="flex skin-gap-sm">
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
                  <div className="mb-2 text-xs skin-fw-heading text-foreground-secondary">卡片阴影</div>
                  <div className="flex flex-wrap skin-gap-sm">
                    {(['none', 'subtle', 'soft', 'strong'] as const).map((s) => (
                      <Chip key={s} active={shadow === s} onClick={() => updateShadow(s)}>
                        {{ none: '无', subtle: '细微', soft: '柔和', strong: '强烈' }[s]}
                      </Chip>
                    ))}
                  </div>
                </section>

                {/* 0828 卡片毛玻璃 */}
                <section>
                  <div className="mb-2 text-xs skin-fw-heading text-foreground-secondary">卡片毛玻璃</div>
                  <div className="flex skin-gap-sm">
                    <Chip active={!theme.glass} onClick={() => updateGlass(false)}>关闭</Chip>
                    <Chip active={!!theme.glass} onClick={() => updateGlass(true)}>开启</Chip>
                  </div>
                  <div className="mt-1.5 text-[10px] text-foreground-muted">
                    卡片变半透明+背景模糊；页面背景为图片/渐变时效果最佳
                  </div>
                </section>

                {/* 图表样式 */}
                <section className="space-y-2">
                  <div className="text-xs skin-fw-heading text-foreground-secondary">图表样式</div>
                  <div className="flex flex-wrap skin-gap-md">
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
                    <div className="text-xs skin-fw-heading text-foreground-secondary">默认页面背景</div>
                    {theme.background && theme.background.type !== 'none' && (
                      <button
                        onClick={applyBackgroundToAllPages}
                        className="text-[11px] text-accent-primary hover:underline"
                      >
                        应用到全部页面
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap skin-gap-xs">
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

                  {/* 预设背景模板 */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-foreground-muted">预设背景模板</div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {([
                        { label: '纯白', type: 'color' as const, color: '#ffffff' },
                        { label: '浅灰', type: 'color' as const, color: '#f5f7fa' },
                        { label: '深空蓝', type: 'gradient' as const, from: '#0a0e18', to: '#131a2c', angle: 155 },
                        { label: '品牌粉', type: 'gradient' as const, from: '#fff6f9', to: '#ffe0ef', angle: 160 },
                        { label: '商务金', type: 'gradient' as const, from: '#fdfaf3', to: '#f5edd6', angle: 160 },
                        { label: '极光绿', type: 'gradient' as const, from: '#f0fdf4', to: '#dcfce7', angle: 160 },
                        { label: '海洋蓝', type: 'gradient' as const, from: '#eff6ff', to: '#dbeafe', angle: 160 },
                        { label: '暗夜紫', type: 'gradient' as const, from: '#1a1033', to: '#2d1b4e', angle: 155 },
                        { label: '星空黑', type: 'gradient' as const, from: '#0d0d0d', to: '#1a1a1a', angle: 155 },
                        { label: '暖米色', type: 'gradient' as const, from: '#faf8f5', to: '#f0ebe0', angle: 160 },
                      ]).map((preset) => (
                        <button
                          key={preset.label}
                          onClick={() => {
                            if (preset.type === 'color') {
                              updateBackground('type', 'color');
                              updateBackground('color', preset.color);
                            } else {
                              updateBackground('type', 'gradient');
                              updateBackground('gradient', {
                                type: 'linear' as const,
                                angle: preset.angle,
                                stops: [
                                  { color: preset.from, position: 0 },
                                  { color: preset.to, position: 100 },
                                ],
                              });
                            }
                          }}
                          className="flex flex-col items-center skin-gap-xs rounded border border-border-subtle p-1.5 hover:border-accent-primary hover:bg-surface-hover transition"
                          title={preset.label}
                        >
                          <div
                            className="h-8 w-full rounded-sm border border-border-subtle"
                            style={
                              preset.type === 'color'
                                ? { backgroundColor: preset.color }
                                : { background: `linear-gradient(${preset.angle}deg, ${preset.from}, ${preset.to})` }
                            }
                          />
                          <span className="text-[9px] text-foreground-muted">{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {theme.background?.type === 'color' && (
                    <div className="flex items-center skin-gap-sm">
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
            {/* ── 页眉页脚 ── */}
            {activeCat === 'header-footer' && (
              <>
                {/* 同步按钮 */}
                <section className="space-y-2">
                  <div className="text-xs skin-fw-heading text-foreground-secondary">数据同步</div>
                  <button
                    onClick={async () => {
                      if (!businessLine) return;
                      setHfSyncing(true);
                      try {
                        const allBL = await lookupApi.listBusinessLines();
                        const bl = allBL.find((b) => b.code === businessLine);
                        if (!bl) { setToast(`未找到业务线 "${businessLine}"`); setTimeout(() => setToast(null), 2500); return; }
                        const advertisers = await lookupApi.listAdvertisers({ businessLineId: bl.id });
                        const firstAdv = advertisers[0];
                        setHfHeader((prev) => ({
                          ...prev,
                          rightLogo: { src: bl.logo || '', text: bl.title || bl.code, initials: bl.code },
                          leftLogo: firstAdv
                            ? { src: firstAdv.logo || '', text: firstAdv.name, initials: firstAdv.name.slice(0, 2).toUpperCase() }
                            : prev.leftLogo,
                        }));
                        setToast('Logo 已同步'); setTimeout(() => setToast(null), 2500);
                      } catch { setToast('同步失败'); setTimeout(() => setToast(null), 2500); }
                      finally { setHfSyncing(false); }
                    }}
                    disabled={hfSyncing || !businessLine}
                    className="rounded-lg border border-accent-primary/40 bg-accent-primary/5 px-3 py-1.5 text-xs skin-fw-body text-accent-primary hover:bg-accent-primary/10 disabled:opacity-50"
                  >
                    {hfSyncing ? '⏳ 同步中…' : '🔄 从数据管理同步 Logo'}
                  </button>
                </section>

                {/* 页眉配置 */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs skin-fw-heading text-foreground-secondary">页眉</div>
                    <label className="flex cursor-pointer items-center skin-gap-sm text-xs">
                      <input
                        type="checkbox"
                        checked={hfHeader.enabled}
                        onChange={(e) => setHfHeader({ ...hfHeader, enabled: e.target.checked })}
                        className="h-4 w-4 accent-orange-500"
                      />
                      启用
                    </label>
                  </div>

                  {hfHeader.enabled && (
                    <div className="space-y-4 rounded-lg border border-border-default p-4">
                      {/* 预设样式选择 */}
                      <div>
                        <label className="mb-1.5 block text-[11px] skin-fw-body text-foreground-muted">布局预设</label>
                        <div className="grid grid-cols-3 skin-gap-sm">
                          {([
                            { id: 'split', label: '左右分列', icon: '⬜ ↔ ⬜' },
                            { id: 'left-logos-right-text', label: '双logo+标题', icon: '⬜×⬜ 📝' },
                            { id: 'left-logo-right-text', label: 'logo+标题', icon: '⬜ 📝' },
                            { id: 'left-text-right-logo', label: '标题+logo', icon: '📝 ⬜' },
                            { id: 'center-text', label: '居中文案', icon: '📝' },
                            { id: 'custom', label: '自定义', icon: '⚙' },
                          ] as const).map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setHfHeader({ ...hfHeader, preset: opt.id })}
                              className={`rounded-lg border px-2 py-1.5 text-xs transition ${
                                (hfHeader.preset ?? 'split') === opt.id
                                  ? 'border-accent-primary bg-accent-primary/5 skin-fw-body text-foreground-primary'
                                  : 'border-border-default text-foreground-muted hover:bg-surface-hover'
                              }`}
                            >
                              <div className="text-[10px] opacity-70">{opt.icon}</div>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 报告标题文案（非 split 预设使用） */}
                      {(hfHeader.preset ?? 'split') !== 'split' && (hfHeader.preset ?? 'split') !== 'custom' && (
                        <div>
                          <label className="mb-1 block text-[11px] skin-fw-body text-foreground-muted">报告标题文案</label>
                          <input
                            type="text"
                            value={hfHeader.titleText ?? ''}
                            onChange={(e) => setHfHeader({ ...hfHeader, titleText: e.target.value })}
                            placeholder="如 MOTION Spring Campaign Report"
                            className="w-full rounded-lg border border-border-default bg-surface-primary px-3 py-1.5 text-sm"
                          />
                        </div>
                      )}

                      {/* 左侧 logo */}
                      <HeaderFooterLogoEditor
                        label="品牌 Logo（广告主）"
                        logo={hfHeader.leftLogo}
                        onChange={(logo) => setHfHeader({ ...hfHeader, leftLogo: logo })}
                      />
                      {/* 右侧 logo（split / left-logos-right-text / custom 预设需要） */}
                      {(hfHeader.preset ?? 'split') !== 'left-logo-right-text' && (hfHeader.preset ?? 'split') !== 'left-text-right-logo' && (
                        <HeaderFooterLogoEditor
                          label="业务线 Logo"
                          logo={hfHeader.rightLogo}
                          onChange={(logo) => setHfHeader({ ...hfHeader, rightLogo: logo })}
                        />
                      )}

                      {/* 连接符（split / left-logos-right-text 时使用） */}
                      {((hfHeader.preset ?? 'split') === 'split' || (hfHeader.preset ?? 'split') === 'left-logos-right-text') && (
                        <div>
                          <label className="mb-1 block text-[11px] skin-fw-body text-foreground-muted">连接符</label>
                          <input
                            type="text"
                            value={hfHeader.connector ?? '×'}
                            onChange={(e) => setHfHeader({ ...hfHeader, connector: e.target.value })}
                            placeholder="×"
                            className="w-20 rounded-lg border border-border-default bg-surface-primary px-3 py-1.5 text-sm text-center"
                          />
                        </div>
                      )}

                      {/* 副标题/日期标签 */}
                      <div>
                        <label className="mb-1 block text-[11px] skin-fw-body text-foreground-muted">副标题/日期标签</label>
                        <input
                          type="text"
                          value={hfHeader.dateLabel ?? ''}
                          onChange={(e) => setHfHeader({ ...hfHeader, dateLabel: e.target.value })}
                          placeholder="如 2026 H1 / 周报 W32 / 支持 {page}/{total}"
                          className="w-full rounded-lg border border-border-default bg-surface-primary px-3 py-1.5 text-sm"
                        />
                      </div>

                      {/* 高度 */}
                      <div>
                        <label className="mb-1 block text-[11px] skin-fw-body text-foreground-muted">高度 (px)</label>
                        <input
                          type="number"
                          value={hfHeader.height ?? 56}
                          onChange={(e) => setHfHeader({ ...hfHeader, height: Number(e.target.value) })}
                          className="w-24 rounded-lg border border-border-default bg-surface-primary px-3 py-1.5 text-sm"
                        />
                      </div>

                      {/* 背景设置 */}
                      <div>
                        <label className="mb-1.5 block text-[11px] skin-fw-body text-foreground-muted">背景设置</label>
                        <HeaderBackgroundEditor
                          background={hfHeader.background}
                          onChange={(bg) => setHfHeader({ ...hfHeader, background: bg })}
                        />
                      </div>

                      {/* 底部边框 */}
                      <div>
                        <label className="mb-1 block text-[11px] skin-fw-body text-foreground-muted">底部边框色（设为 transparent 隐藏）</label>
                        <input
                          type="text"
                          value={hfHeader.borderColor ?? '#ebebeb'}
                          onChange={(e) => setHfHeader({ ...hfHeader, borderColor: e.target.value })}
                          placeholder="#ebebeb 或 transparent"
                          className="w-full rounded-lg border border-border-default bg-surface-primary px-3 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </section>

                {/* 页脚配置 */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs skin-fw-heading text-foreground-secondary">页脚</div>
                    <label className="flex cursor-pointer items-center skin-gap-sm text-xs">
                      <input
                        type="checkbox"
                        checked={hfFooter.enabled}
                        onChange={(e) => setHfFooter({ ...hfFooter, enabled: e.target.checked })}
                        className="h-4 w-4 accent-orange-500"
                      />
                      启用
                    </label>
                  </div>

                  {hfFooter.enabled && (
                    <div className="space-y-3 rounded-lg border border-border-default p-4">
                      <div>
                        <label className="mb-1 block text-[11px] skin-fw-body text-foreground-muted">左侧文字</label>
                        <input
                          type="text"
                          value={hfFooter.leftText ?? ''}
                          onChange={(e) => setHfFooter({ ...hfFooter, leftText: e.target.value })}
                          placeholder="© 2026 MediaKit"
                          className="w-full rounded-lg border border-border-default bg-surface-primary px-3 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] skin-fw-body text-foreground-muted">右侧文字（支持 {`{page}/{total}`})</label>
                        <input
                          type="text"
                          value={hfFooter.rightText ?? ''}
                          onChange={(e) => setHfFooter({ ...hfFooter, rightText: e.target.value })}
                          placeholder="{page}/{total}"
                          className="w-full rounded-lg border border-border-default bg-surface-primary px-3 py-1.5 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 skin-gap-md">
                        <div>
                          <label className="mb-1 block text-[11px] skin-fw-body text-foreground-muted">高度 (px)</label>
                          <input
                            type="number"
                            value={hfFooter.height ?? 36}
                            onChange={(e) => setHfFooter({ ...hfFooter, height: Number(e.target.value) })}
                            className="w-full rounded-lg border border-border-default bg-surface-primary px-3 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] skin-fw-body text-foreground-muted">背景色</label>
                          <input
                            type="color"
                            value={hfFooter.background ?? '#f8f8f8'}
                            onChange={(e) => setHfFooter({ ...hfFooter, background: e.target.value })}
                            className="h-9 w-full rounded-lg border border-border-default"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="flex justify-end skin-gap-sm border-t border-border-subtle px-6 py-3">
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
      <div className="mb-1.5 text-[11px] skin-fw-body text-foreground-secondary">{label}</div>
      {presetSwatches && (
        <div className="mb-1.5 flex flex-wrap skin-gap-xs">
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
    <div className="flex items-center skin-gap-sm">
      <label className="w-20 flex-none text-[11px] skin-fw-body text-foreground-secondary">{label}</label>
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
      <div className="flex flex-wrap skin-gap-xs">
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
        <label className="flex items-center skin-gap-sm text-xs text-foreground-secondary">
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
          <div key={i} className="flex items-center skin-gap-xs">
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

/* ─── 页眉页脚 Logo 编辑器 ─── */
function HeaderFooterLogoEditor({
  label,
  logo,
  onChange,
}: {
  label: string;
  logo?: { src?: string; text?: string; initials?: string; logoHeight?: number };
  onChange: (logo: { src?: string; text?: string; initials?: string; logoHeight?: number } | undefined) => void;
}) {
  const l = logo ?? {};
  return (
    <div className="rounded-md border border-border-subtle p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs skin-fw-body text-foreground-secondary">{label}</span>
        {(l.src || l.text || l.initials) && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-[11px] text-foreground-muted hover:text-red"
          >
            清除
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 skin-gap-sm">
        <input
          type="text"
          value={l.src ?? ''}
          onChange={(e) => onChange({ ...l, src: e.target.value })}
          placeholder="Logo URL（留空则不显示）"
          className="col-span-2 w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs"
        />
        <input
          type="text"
          value={l.text ?? ''}
          onChange={(e) => onChange({ ...l, text: e.target.value })}
          placeholder="名称"
          className="w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs"
        />
        <input
          type="text"
          value={l.initials ?? ''}
          onChange={(e) => onChange({ ...l, initials: e.target.value })}
          placeholder="缩写（如 DG）"
          className="w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs"
        />
      </div>
      {l.src && (
        <div className="mt-2 flex items-center skin-gap-sm">
          <label className="flex items-center skin-gap-xs text-[11px] text-foreground-secondary">
            Logo 高度
            <input
              type="number"
              min={12}
              max={120}
              value={l.logoHeight ?? 32}
              onChange={(e) => onChange({ ...l, logoHeight: Math.max(12, Math.min(120, Number(e.target.value) || 32)) })}
              className="w-14 rounded border border-border-default px-1 py-0.5 text-xs text-foreground-primary"
            />
            px
          </label>
        </div>
      )}
    </div>
  );
}

/* ─── 页眉背景编辑器 ─── */
export function HeaderBackgroundEditor({
  background,
  onChange,
}: {
  background?: string | import('@mediakit/shared').HeaderBackground;
  onChange: (bg: string | import('@mediakit/shared').HeaderBackground) => void;
}) {
  // 归一化背景值
  const isObj = typeof background === 'object' && background !== null;
  const bgObj = isObj ? background as import('@mediakit/shared').HeaderBackground : undefined;
  const bgStr = !isObj ? (background as string | undefined) : undefined;
  const bgType = bgObj?.type ?? (bgStr ? 'color' : 'color');

  // 改色/切类型时携带已有 opacity，避免一动颜色透明度就静默丢失（回归：opacity 不生效）。
  const withOpacity = (bg: HeaderBackground): HeaderBackground =>
    bgObj?.opacity === undefined ? bg : { ...bg, opacity: bgObj.opacity };

  return (
    <div className="space-y-2">
      {/* 类型切换 */}
      <div className="flex skin-gap-xs">
        {(['color', 'gradient', 'image'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(withOpacity({ type: t, color: '#ffffff' }))}
            className={`flex-1 rounded-md border px-2 py-1 text-xs transition ${
              bgType === t
                ? 'border-accent-primary bg-accent-primary/5 skin-fw-body text-foreground-primary'
                : 'border-border-default text-foreground-muted hover:bg-surface-hover'
            }`}
          >
            {t === 'color' ? '纯色' : t === 'gradient' ? '渐变' : '图片'}
          </button>
        ))}
      </div>

      {/* 纯色 */}
      {bgType === 'color' && (
        <div className="flex items-center skin-gap-sm">
          <input
            type="color"
            value={bgObj?.color ?? bgStr ?? '#ffffff'}
            onChange={(e) => onChange(withOpacity({ type: 'color', color: e.target.value }))}
            className="h-8 w-12 rounded border border-border-default"
          />
          <input
            type="text"
            value={bgObj?.color ?? bgStr ?? '#ffffff'}
            onChange={(e) => onChange(withOpacity({ type: 'color', color: e.target.value }))}
            placeholder="#ffffff"
            className="flex-1 rounded border border-border-default bg-surface-primary px-2 py-1 text-xs"
          />
        </div>
      )}

      {/* 渐变 */}
      {bgType === 'gradient' && (
        <div className="space-y-2">
          <input
            type="text"
            value={bgObj?.gradient ?? 'linear-gradient(90deg, #1a1a2e, #16213e)'}
            onChange={(e) => onChange(withOpacity({ type: 'gradient', gradient: e.target.value }))}
            placeholder="linear-gradient(90deg, #color1, #color2)"
            className="w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs"
          />
          {/* 渐变预设 */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: '深蓝', val: 'linear-gradient(90deg, #0f172a, #1e3a5f)' },
              { label: '暗夜', val: 'linear-gradient(90deg, #1a1a2e, #16213e)' },
              { label: '品牌红', val: 'linear-gradient(90deg, #e2503f, #c0392b)' },
              { label: '墨绿', val: 'linear-gradient(90deg, #0d3b2e, #16534a)' },
              { label: '炭灰', val: 'linear-gradient(90deg, #2d2d2d, #1a1a1a)' },
              { label: '紫调', val: 'linear-gradient(90deg, #2d1b4e, #1a1a2e)' },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onChange(withOpacity({ type: 'gradient', gradient: preset.val }))}
                className="rounded border border-border-default px-2 py-0.5 text-[10px] text-foreground-secondary hover:border-accent-primary"
                style={{ background: preset.val, color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 图片 */}
      {bgType === 'image' && (
        <input
          type="text"
          value={bgObj?.image ?? ''}
          onChange={(e) => onChange(withOpacity({ type: 'image', image: e.target.value }))}
          placeholder="背景图片 URL"
          className="w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-xs"
        />
      )}

      {/* 透明度滑块 */}
      <div>
        <label className="flex items-center justify-between text-[11px] text-foreground-secondary">
          <span>不透明度</span>
          <span>{Math.round((bgObj?.opacity ?? 1) * 100)}%</span>
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={bgObj?.opacity ?? 1}
          onChange={(e) => {
            const baseBg = bgObj ?? { type: 'color' as const, color: bgStr ?? '#ffffff' };
            onChange({ ...baseBg, opacity: Number(e.target.value) });
          }}
          className="w-full accent-orange-500"
        />
      </div>
    </div>
  );
}
