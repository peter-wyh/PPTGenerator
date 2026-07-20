/**
 * 统一货币/成本指标格式化 + 评级颜色。
 *
 * 全局约定：所有金额以美元（$）结算。
 * 如需切换币种，修改 CURRENCY + 对应阈值即可。
 */

/** 货币符号 */
export const CURRENCY = '$';

/** CPE 评级阈值（$/eng）：<$0.50 绿 / <$1.50 黄 / ≥$1.50 红 */
export const CPE_THRESHOLDS = { green: 0.5, yellow: 1.5 };

/** CPM 评级阈值（$/1K imp）：<$5 绿 / <$12 黄 / ≥$12 红 */
export const CPM_THRESHOLDS = { green: 5, yellow: 12 };

/** 评级颜色映射 */
export type CostRating = 'green' | 'yellow' | 'red';

/** Tailwind 颜色类映射 */
export const COST_COLOR_CLASS: Record<CostRating, string> = {
  green: 'text-green-500',
  yellow: 'text-yellow-500',
  red: 'text-red-500',
};

/** CPE 评级 */
export function rateCPE(cpe: number): CostRating {
  if (cpe < CPE_THRESHOLDS.green) return 'green';
  if (cpe < CPE_THRESHOLDS.yellow) return 'yellow';
  return 'red';
}

/** CPM 评级 */
export function rateCPM(cpm: number): CostRating {
  if (cpm < CPM_THRESHOLDS.green) return 'green';
  if (cpm < CPM_THRESHOLDS.yellow) return 'yellow';
  return 'red';
}

/** 格式化执行价：$12,000 */
export function formatExecPrice(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return `${CURRENCY}${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

/** 格式化 CPE：$0.50/次 */
export function formatCPE(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return `${CURRENCY}${n.toFixed(2)}/次`;
}

/** 格式化 CPM：$5.00/千次 */
export function formatCPM(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return `${CURRENCY}${n.toFixed(2)}/千次`;
}

/** 格式化 CPS 美元金额：$45,000 */
export function formatUSD(value: number): string {
  return `${CURRENCY}${Math.round(value).toLocaleString('en-US')}`;
}

/** 格式化 EPC（保留两位小数）：$1.23 */
export function formatEPC(value: number): string {
  return `${CURRENCY}${value.toFixed(2)}`;
}

/** CPE tooltip 文本 */
export const CPE_HINT = 'Cost Per Engagement = 执行价 ÷ 互动量。衡量每次互动的成本，$0.50/次以内优秀，$1.50/次以上偏高';

/** CPM tooltip 文本 */
export const CPM_HINT = 'Cost Per Mille = 执行价 ÷ 曝光量 × 1000。衡量每千次曝光的成本，$5/千次以内优秀，$12/千次以上偏高';

/** 执行价 tooltip 文本 */
export const EXEC_PRICE_HINT = '达人合作执行费用，不含投流加温等额外支出';

// ── 向后兼容（已废弃，过渡期保留）──
export const CURRENCY_CNY = CURRENCY;
export const CURRENCY_USD = CURRENCY;
