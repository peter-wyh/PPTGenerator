/**
 * 金额格式化（审计 #9：去 £ 硬编码）。
 *
 * 当前订单/TrackingLink 金额均为 Digchic 英镑站口径，符号统一由此常量提供；
 * 数据层暂无逐行 currency 字段（Order/LinkRow 均无），接入多币种时
 * 在此扩展为「业务线币种配置 → 符号映射」，调用方签名不变。
 */

/** 金额展示币种符号（单点配置；多币种化时改为按业务线解析）。 */
export const CURRENCY_SYMBOL = '£';

/** 金额格式化：null/undefined/空串/非数值 → '—'；负数前缀 '-'，绝对值两位小数。 */
export function fmtMoney(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? `${n < 0 ? '-' : ''}${CURRENCY_SYMBOL}${Math.abs(n).toFixed(2)}` : '—';
}
