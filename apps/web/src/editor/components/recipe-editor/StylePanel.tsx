/**
 * StylePanel — Recipe 风格层(dgTokens 覆盖)。
 * 暴露主色/背景/卡片/分割线 + 字体三个族 + 灰阶族。
 * 所有改动通过 onChange 实时回写 RecipeEditor 的 tokenOverrides state。
 *
 * Key 名称对齐 apps/server/.../recipe/campaign-report/tokens.ts 的 dgTokens。
 */
const TOKEN_FIELDS: { key: string; label: string; type: 'color' | 'text' }[] = [
  { key: 'brandPrimary', label: '主色', type: 'color' },
  { key: 'bgLayout', label: '页面背景', type: 'color' },
  { key: 'bgCard', label: '卡片背景', type: 'color' },
  { key: 'strokeLine', label: '分割线', type: 'color' },
  { key: 'strokeCard', label: '卡片描边', type: 'color' },
  { key: 'greyPrimary', label: '主文字色', type: 'color' },
  { key: 'greySecondary', label: '次级文字色', type: 'color' },
  { key: 'greyTertiary', label: '辅助文字色', type: 'color' },
  { key: 'fontBody', label: '正文字体', type: 'text' },
  { key: 'fontPoppins', label: '标题字体', type: 'text' },
  { key: 'fontNumber', label: '数字字体', type: 'text' },
];

interface Props {
  tokens: Record<string, unknown>;
  onChange: (t: Record<string, unknown>) => void;
}

export function StylePanel({ tokens, onChange }: Props) {
  return (
    <fieldset className="rounded-lg border border-border-default p-3">
      <legend className="px-1 text-xs font-medium text-foreground-secondary">🎨 风格</legend>
      <div className="grid grid-cols-2 gap-2">
        {TOKEN_FIELDS.map((f) => {
          const val = (tokens[f.key] as string | undefined) ?? '';
          return (
            <label key={f.key} className="flex items-center gap-1.5 text-[11px] text-foreground-secondary">
              <span className="w-16 shrink-0">{f.label}</span>
              {f.type === 'color' ? (
                <input
                  aria-label={f.label}
                  type="color"
                  value={val || '#000000'}
                  onChange={(e) => onChange({ ...tokens, [f.key]: e.target.value })}
                  className="h-6 w-8 cursor-pointer rounded border border-border-default bg-transparent p-0"
                />
              ) : (
                <input
                  aria-label={f.label}
                  type="text"
                  value={val}
                  placeholder="'Outfit', sans-serif"
                  onChange={(e) => onChange({ ...tokens, [f.key]: e.target.value })}
                  className="min-w-0 flex-1 rounded border border-border-default bg-surface-primary px-1.5 py-1 text-[11px] text-foreground-primary outline-none focus:border-accent-primary"
                />
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
