/**
 * 周期数据快照 — 从 campaign + period 计算 KPI 值映射。
 * 
 * 用途：AI HTML 报告中的 KPI 数字是硬编码文本（如 "$12.5K"、"1,736"）。
 * 复制项目并切换周期时，需要用新周期的数字替换 HTML 中的旧数字。
 * 
 * 策略：生成报告时存储旧快照（old→formatted values），复制时计算新快照，
 * 然后按 formatted value 做 old→new 文本替换。
 */

import { prisma } from '../../prisma';

export interface MetricSnapshot {
  /** 原始数值（用于排序和去重） */
  raw: number;
  /** HTML 中实际显示的格式化文本，如 "$12.5K"、"1,736"、"3.2%" */
  formatted: string;
}

export interface PeriodSnapshot {
  /** KPI 指标键 → 快照值（含多种格式） */
  metrics: Record<string, string>;
  /** 所有数值的格式化变体列表（用于旧→新值替换） */
  valuePairs: { old: string; new: string }[];
}

const num = (v: unknown): number => Number(v) || 0;

/** 数字格式化变体：模拟 AI 可能输出的各种格式 */
function formatValueVariants(raw: number): string[] {
  if (raw === 0) return ['0', '$0', '0.0', '$0.0'];
  const variants: string[] = [];
  
  // 整数
  variants.push(String(Math.round(raw)));
  // 千分位逗号
  variants.push(Math.round(raw).toLocaleString('en-US'));
  
  // K/M 格式
  if (raw >= 1000) {
    variants.push(`${(raw / 1000).toFixed(1)}K`);
  }
  if (raw >= 1_000_000) {
    variants.push(`${(raw / 1_000_000).toFixed(1)}M`);
  }
  
  // 货币前缀
  variants.push(`$${Math.round(raw)}`);
  variants.push(`$${Math.round(raw).toLocaleString('en-US')}`);
  if (raw >= 1000) {
    variants.push(`$${(raw / 1000).toFixed(1)}K`);
  }
  if (raw >= 1_000_000) {
    variants.push(`$${(raw / 1_000_000).toFixed(1)}M`);
  }
  
  // 小数格式（比率类指标）
  if (raw < 100 && raw % 1 !== 0) {
    variants.push(raw.toFixed(1));
    variants.push(raw.toFixed(2));
  }
  
  return [...new Set(variants)]; // 去重
}

/**
 * 从 campaignId + period 计算 KPI 快照。
 * 如果不传 period，返回全量汇总（与 AI 生成时的默认行为一致）。
 */
export async function getPeriodSnapshot(
  campaignId: string,
  period?: { startDate?: string; endDate?: string; month?: string },
): Promise<{
  /** 扁平 metric map: { totalRevenue: "$12.5K", totalOrders: "1,736", ... } */
  metrics: Record<string, string>;
  /** 原始数值列表（用于 snapshot diff） */
  rawValues: Record<string, number>;
}> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      campaignCreators: {
        include: {
          cpsPerformances: true,
        },
      },
    },
  });
  if (!campaign) return { metrics: {}, rawValues: {} };

  // 解析 period → startDate/endDate
  let startDate = period?.startDate;
  let endDate = period?.endDate;
  if (period?.month && !startDate) {
    startDate = `${period.month}-01`;
    // 月末
    const [y, m] = period.month.split('-').map(Number);
    endDate = period.month + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0');
  }

  const inPeriod = (d: string) =>
    (!startDate || d >= startDate) && (!endDate || d <= endDate);

  // 聚合 CPS daily 数据
  const total = { clicks: 0, impressions: 0, orders: 0, gmv: 0, spend: 0, commission: 0, newCustomers: 0 };
  const perCreator = new Map<string, typeof total>();

  for (const cc of campaign.campaignCreators ?? []) {
    const ccSum = { clicks: 0, impressions: 0, orders: 0, gmv: 0, spend: 0, commission: 0, newCustomers: 0 };
    for (const p of cc.cpsPerformances ?? []) {
      const daily = (p.daily as Record<string, unknown>[] | null | undefined) ?? [];
      for (const d of daily) {
        const date = String(d.date ?? '');
        if (!date) continue;
        // 如果有 period 则按 period 过滤；否则取全部
        if (startDate && endDate && !inPeriod(date)) continue;
        ccSum.clicks += num(d.clicks);
        ccSum.impressions += num(d.impressions);
        ccSum.orders += num(d.orders);
        ccSum.gmv += num(d.gmv);
        ccSum.spend += num(d.spend);
        ccSum.commission += num(d.commission);
        ccSum.newCustomers += num(d.newCustomers);
      }
    }
    perCreator.set(cc.id, ccSum);
    total.clicks += ccSum.clicks;
    total.impressions += ccSum.impressions;
    total.orders += ccSum.orders;
    total.gmv += ccSum.gmv;
    total.spend += ccSum.spend;
    total.commission += ccSum.commission;
    total.newCustomers += ccSum.newCustomers;
  }

  const aov = total.orders ? total.gmv / total.orders : 0;
  const roas = total.spend ? total.gmv / total.spend : 0;
  const cvr = total.clicks ? (total.orders / total.clicks) * 100 : 0;

  const fmtMoney = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(0)}`;
  const fmtNum = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n));

  return {
    metrics: {
      totalRevenue: fmtMoney(total.gmv),
      totalGMV: fmtMoney(total.gmv),
      totalClicks: fmtNum(total.clicks),
      totalOrders: fmtNum(total.orders),
      totalSpend: fmtMoney(total.spend),
      totalCommission: fmtMoney(total.commission),
      newCustomers: fmtNum(total.newCustomers),
      totalImpressions: fmtNum(total.impressions),
      aov: fmtMoney(aov),
      roas: roas.toFixed(1),
      cvr: cvr.toFixed(1) + '%',
    },
    rawValues: {
      totalRevenue: total.gmv,
      totalGMV: total.gmv,
      totalClicks: total.clicks,
      totalOrders: total.orders,
      totalSpend: total.spend,
      totalCommission: total.commission,
      newCustomers: total.newCustomers,
      totalImpressions: total.impressions,
      aov: aov,
      roas: roas,
      cvr: cvr,
    },
  };
}

/**
 * 构建旧→新值的替换对列表。
 * 给定旧快照和新快照的 raw values，生成所有格式化变体的 old→new 映射。
 */
export function buildValueReplacementPairs(
  oldRaw: Record<string, number>,
  newRaw: Record<string, number>,
): { old: string; new: string }[] {
  const pairs: { old: string; new: string }[] = [];
  
  for (const key of Object.keys(newRaw)) {
    const oldVal = oldRaw[key];
    const newVal = newRaw[key];
    if (oldVal === undefined || newVal === undefined || oldVal === newVal) continue;
    
    const oldVariants = formatValueVariants(oldVal);
    const newVariants = formatValueVariants(newVal);
    
    // 按位置配对（两者顺序一致）
    for (let i = 0; i < oldVariants.length; i++) {
      if (oldVariants[i] !== newVariants[i]) {
        pairs.push({ old: oldVariants[i], new: newVariants[i] });
      }
    }
  }
  
  return pairs;
}

/**
 * 在 HTML 中执行旧值→新值替换。
 * 
 * 策略：
 * 1. 按字符串长度降序排列（长串优先，避免 "1,736" 被 "736" 部分匹配）
 * 2. 跳过 1 字符的值（太短，容易误替换）
 * 3. 跳过纯 "0" 值
 */
export function replaceMetricsBySnapshot(
  html: string,
  pairs: { old: string; new: string }[],
): string {
  // 过滤掉太短或零值的替换
  const valid = pairs.filter(
    (p) => p.old.length >= 2 && p.old !== '0' && p.old !== '$0' && p.old !== p.new,
  );
  
  // 去重（同一个 old 值只保留第一个 new 映射）
  const seen = new Set<string>();
  const deduped = valid.filter((p) => {
    if (seen.has(p.old)) return false;
    seen.add(p.old);
    return true;
  });
  
  // 按长度降序排列
  deduped.sort((a, b) => b.old.length - a.old.length);
  
  let result = html;
  for (const { old: oldVal, new: newVal } of deduped) {
    // 用 split/join 替换（比 replaceAll 快，且不涉及正则转义）
    if (result.includes(oldVal)) {
      result = result.split(oldVal).join(newVal);
    }
  }
  
  return result;
}
