import { useState } from 'react';
import {
  DEFAULT_THEME,
  FONT_OPTIONS,
  STYLE_PRESETS,
  type ProjectTheme,
  type ThemeDensity,
  type ThemeRadius,
} from '@mediakit/shared';
import { useEditorStore } from '../store';
import type { ThemePatch } from '../store';

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

const PRESET_PRIMARIES = [
  '#ff5c00', '#2563eb', '#16a34a', '#9333ea', '#e11d48', '#0891b2', '#ca8a04', '#0a0a0a',
];

/** 报告设置浮层：整体风格（预设 + 配色 + 字体 + 密度 + 圆角）+ 解析参考图占位。 */
export function ReportSettingsOverlay({ onClose }: Props) {
  const theme = useEditorStore((s) => s.projectMeta?.theme ?? DEFAULT_THEME);
  const setTheme = useEditorStore((s) => s.setTheme);
  const [toast, setToast] = useState<string | null>(null);

  /** 应用预设：整套 ProjectTheme 填入。 */
  function applyPreset(presetKey: string) {
    const preset = STYLE_PRESETS.find((p) => p.key === presetKey);
    if (!preset) return;
    const patch: ThemePatch = {
      color: { ...preset.theme.color },
      font: { ...preset.theme.font },
      density: preset.theme.density,
      radius: preset.theme.radius,
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

  /** 解析参考图占位：弹 toast（为后续 vision 接入预留入口）。 */
  function handleParseReference() {
    setToast('参考图解析即将上线，敬请期待');
    setTimeout(() => setToast(null), 2500);
  }

  const textFonts = FONT_OPTIONS.filter((f) => f.category === 'text');
  const numberFonts = FONT_OPTIONS.filter((f) => f.category === 'number');
  const headingFonts = FONT_OPTIONS; // 标题可选任意字体 + "跟随文本"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-surface-primary shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <div>
            <div className="font-headings text-lg font-semibold text-foreground-primary">报告设置</div>
            <p className="text-xs text-foreground-secondary">整体风格驱动整份报告的配色、字体与密度。</p>
          </div>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground-primary">✕</button>
        </div>

        <div className="space-y-5 overflow-y-auto px-6 py-5">
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

          {/* ⑥ 解析参考图（占位） */}
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
        </div>

        {/* 底部操作栏 */}
        <div className="flex justify-end border-t border-border-subtle px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-accent-primary px-4 py-1.5 text-sm text-white hover:opacity-90"
          >
            完成
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
