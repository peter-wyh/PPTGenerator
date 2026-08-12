/** 美元金额 → "$876,360"(千分位,四舍五入到整数)。 */
export function formatMoney(v: number): string {
  return '$' + Math.round(v).toLocaleString('en-US');
}

/** 整数 → 千分位 "348,619"。 */
export function formatNum(v: number): string {
  return Math.round(v).toLocaleString('en-US');
}

/** 百分比(入参已是数值,如 34.6)→ "34.6%"。 */
export function formatPct(v: number): string {
  return `${v}%`;
}

/** 比率/乘数 → "4.10x"(2 位小数 + x 后缀)。用于 ROAS 等。 */
export function formatRatio(v: number): string {
  return `${v.toFixed(2)}x`;
}
