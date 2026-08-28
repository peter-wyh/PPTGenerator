// tokens.ts
/** DG Campaign Report 默认风格 token(v1 固定;预留给 businessLine 覆盖)。 */
export const dgTokens = {
  brandPrimary: '#ff099e',
  brand85: '#fff6f9',
  greyPrimary: '#1e1c24',
  greySecondary: '#626166',
  greyTertiary: '#999999',
  greyDisabled: '#dddddd',
  bgLayout: '#f5f7fa',
  bgCard: '#ffffff',
  /** 0828 毛玻璃卡片：半透明白底 + 1px 亮边 + 阴影（叠加在渐变+光斑背景上）。 */
  glassBg: 'rgba(255, 255, 255, 0.55)',
  glassStroke: 'rgba(255, 255, 255, 0.65)',
  glassShadow: '0 8px 32px rgba(31, 38, 135, 0.08)',
  strokeLine: 'rgba(0,0,0,0.08)',
  strokeCard: '#ebebeb',
  fontBody: "'Outfit', sans-serif",
  fontPoppins: "'Poppins', sans-serif",
  fontNumber: "'Barlow Condensed', sans-serif",
} as const;

export type DgTokens = typeof dgTokens;
