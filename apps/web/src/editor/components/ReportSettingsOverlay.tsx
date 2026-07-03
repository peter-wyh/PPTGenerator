import { useState } from 'react';
import { useEditorStore } from '../store';
import type { ProjectTheme } from '@mediakit/shared';

interface Props {
  onClose: () => void;
}

/** 报告维度配置：品牌色（主/次）、字体族。 */
const PRESET_PRIMARIES = ['#ff5c00', '#2563eb', '#16a34a', '#9333ea', '#e11d48', '#0891b2', '#ca8a04', '#0a0a0a'];

/** 报告设置浮层：项目级主题（品牌色等），映射到 CSS 变量整树换肤。 */
export function ReportSettingsOverlay({ onClose }: Props) {
  const theme = useEditorStore((s) => s.projectMeta?.theme ?? {});
  const setTheme = useEditorStore((s) => s.setTheme);

  const [primary, setPrimary] = useState(theme.primary ?? '#ff5c00');
  const [secondary, setSecondary] = useState(theme.secondary ?? '#ff8533');
  const [fontFamily, setFontFamily] = useState(theme.fontFamily ?? '');

  function apply(patch: Partial<ProjectTheme>) {
    if (patch.primary !== undefined) setPrimary(patch.primary);
    if (patch.secondary !== undefined) setSecondary(patch.secondary);
    if (patch.fontFamily !== undefined) setFontFamily(patch.fontFamily);
    setTheme(patch);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose} role="presentation">
      <div
        className="w-full max-w-md rounded-xl bg-surface-primary p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-1 font-headings text-lg font-semibold text-foreground-primary">报告设置</div>
        <p className="mb-4 text-sm text-foreground-secondary">品牌色驱动整份报告的强调色（按钮/选中/数据高亮）。</p>

        <div className="space-y-4">
          <div>
            <div className="mb-2 text-xs font-semibold text-foreground-secondary">主品牌色</div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {PRESET_PRIMARIES.map((c) => (
                <button
                  key={c}
                  onClick={() => apply({ primary: c })}
                  className={`h-7 w-7 rounded-full border-2 ${primary.toLowerCase() === c ? 'border-foreground-primary' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primary}
                onChange={(e) => apply({ primary: e.target.value })}
                className="h-8 w-10 rounded border border-border-default p-1"
              />
              <input
                value={primary}
                onChange={(e) => apply({ primary: e.target.value })}
                className="w-32 rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
              />
              <span className="text-xs text-foreground-muted">预览：</span>
              <span className="rounded bg-accent-primary/10 px-2 py-1 text-xs text-accent-primary">强调色样例</span>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold text-foreground-secondary">次品牌色</div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={secondary}
                onChange={(e) => apply({ secondary: e.target.value })}
                className="h-8 w-10 rounded border border-border-default p-1"
              />
              <input
                value={secondary}
                onChange={(e) => apply({ secondary: e.target.value })}
                className="w-32 rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
              />
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold text-foreground-secondary">字体族（留空=默认 Inter）</div>
            <input
              value={fontFamily}
              placeholder="如 'Noto Sans SC', sans-serif"
              onChange={(e) => apply({ fontFamily: e.target.value })}
              className="w-full rounded border border-border-default px-2 py-1 text-xs text-foreground-primary"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="rounded-lg bg-accent-primary px-4 py-1.5 text-sm text-white hover:opacity-90">
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
