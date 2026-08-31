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
  /* 0831 毛玻璃升级(参考图档):
     背景=品红/靛蓝/暖橙粉高透明度 bokeh + 灰蓝对角渐变底;
     卡片=均衡档 blur22/白0.45 + inset 顶高光 + ::before 斜向光泽;
     边线=左上亮→右下暗四边递变。契约见 specs/2026-08-31-glassmorphism-upgrade-design.md §2。 */
  /** 背景层:三个光斑 rgba + 渐变底三色。 */
  glassBlobMagenta: 'rgba(255,9,158,0.30)',
  glassBlobIndigo: 'rgba(99,102,241,0.26)',
  glassBlobWarm: 'rgba(250,166,133,0.30)',
  glassBgBase1: '#d8dde6',
  glassBgBase2: '#e8ebf0',
  glassBgBase3: '#f6f7f9',
  /** 卡片层。 */
  glassBg: 'rgba(255, 255, 255, 0.45)',
  glassStroke: 'rgba(255, 255, 255, 0.5)',
  glassShadow: '0 8px 32px rgba(160, 168, 182, 0.35)',
  glassInsetHighlight: 'inset 0 1px 0 rgba(255, 255, 255, 0.9)',
  glassHighlight: 'linear-gradient(120deg, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 30%)',
  /** 降级:不支持 backdrop-filter 时回退近实色白。 */
  glassFallbackBg: 'rgba(255, 255, 255, 0.92)',
  strokeLine: 'rgba(0,0,0,0.08)',
  strokeCard: '#ebebeb',
  fontBody: "'Outfit', sans-serif",
  fontPoppins: "'Poppins', sans-serif",
  fontNumber: "'Barlow Condensed', sans-serif",
} as const;

export type DgTokens = typeof dgTokens;
