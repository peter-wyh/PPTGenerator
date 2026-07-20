/**
 * 统一货币/成本指标格式化 + 评级颜色。
 *
 * 全局约定：
 * - CPE/CPM/执行价 以人民币（¥）结算（达人合作执行费用按国内市场惯例）
 * - CPS 挂链指标（GMV/佣金/spend 等）以美元（$）结算（电商联盟佣金场景）
 *
 * 如需切换币种，修改 CURRENCY_CNY / CURRENCY_USD 即可。
 */

/** 货币符号 */
export const CURRENCY_CNY = '¥';
export const CURRENCY_USD = '$';

/** CPE 评级阈值（元/次）：<3 绿 / <8 黄 / ≥8 红 */
export const CPE_THRESHOLDS = { green: 3, yellow: 8 };

/** CPM 评级阈值（元/千次）：<30 绿 / <80 黄 / ≥80 红 */
export const CPM_THRESHOLDS = { green: 30, yellow: 80 };

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

/** 格式化执行价：¥12,000 */
export function formatExecPrice(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return `${CURRENCY_CNY}${n.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

/** 格式化 CPE：¥2.50/次 */
export function formatCPE(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return `${CURRENCY_CNY}${n.toFixed(2)}/次`;
}

/** 格式化 CPM：¥32.50/千次 */
export function formatCPM(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return `${CURRENCY_CNY}${n.toFixed(2)}/千次`;
}

/** 格式化 CPS 美元金额：$45,000 */
export function formatUSD(value: number): string {
  return `${CURRENCY_USD}${Math.round(value).toLocaleString('en-US')}`;
}

/** 格式化 EPC（保留两位小数）：$1.23 */
export function formatEPC(value: number): string {
  return `${CURRENCY_USD}${value.toFixed(2)}`;
}

/** CPE tooltip 文本 */
export const CPE_HINT = 'Cost Per Engagement = 执行价 ÷ 互动量。衡量每次互动的成本，¥3/次以内优秀，¥8/次以上偏高';

/** CPM tooltip 文本 */
export const CPM_HINT = 'Cost Per Mille = 执行价 ÷ 曝光量 × 1000。衡量每千次曝光的成本，¥30/千次以内优秀，¥80/千次以上偏高';

/** 执行价 tooltip 文本 */
export const EXEC_PRICE_HINT = '达人合作执行费用，不含投流加温等额外支出';
