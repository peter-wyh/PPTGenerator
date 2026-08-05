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
  strokeLine: 'rgba(0,0,0,0.08)',
  strokeCard: '#ebebeb',
  fontBody: "'Outfit', sans-serif",
  fontPoppins: "'Poppins', sans-serif",
  fontNumber: "'Barlow Condensed', sans-serif",
} as const;

export type DgTokens = typeof dgTokens;
