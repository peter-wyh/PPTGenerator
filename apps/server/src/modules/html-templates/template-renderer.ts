/**
 * template-renderer.ts
 * 
 * 模板渲染引擎：解析带 data-field 属性的 HTML 模板，用新周期的 campaign 数据填充。
 * 
 * 核心流程：
 * 1. 从 campaignId + reportPeriod 计算 KPI 快照 + creators 列表 + trend 数据
 * 2. 遍历 HTML 中所有 data-field="xxx" 属性，替换对应元素的文本内容
 * 3. 对 data-field="creators" 的 tbody，按新数据重建所有 <tr> 行
 * 4. 替换 script 中 dailyTrend 数组
 * 
 * 速度：< 100ms，零 AI 调用。
 */

import { prisma } from '../../prisma';
import { loadCreatorCps } from './cps-source';

type Any = Record<string, any>;

// ═══ 格式化工具 ═══

function formatMoney(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v >= 1_000) return `$${Math.round(v / 100) * 100}`;
  return `$${v.toFixed(2)}`;
}

function formatNum(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return v.toLocaleString('en-US');
  return String(Math.round(v));
}

function formatPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

function formatRatio(v: number): string {
  return v.toFixed(2);
}

function shortDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

// ═══ 数据提取 ═══

interface PeriodData {
  kpis: Record<string, string>;           // field name → formatted value
  kpisRaw: Record<string, number>;         // field name → raw number
  creators: CreatorRow[];
  trend: { date: string; revenue: number; clicks: number; orders: number }[];
  period: { start: string; end: string; display: string };
}

interface CreatorRow {
  name: string;
  handle?: string;
  platform?: string;
  partnerType?: string;
  avatarUrl?: string;
  clicks: number;
  orders: number;
  gmv: number;
  newCustomers: number;
  commission: number;
  posts?: number;
  engagement?: number;
  impressions?: number;
  engagementRate?: number;
}

/**
 * 从 DB 查 campaign + CPS daily 数据，按 period 切片，返回标准化数据对象。
 */
export async function extractPeriodData(
  campaignId: string,
  reportPeriod?: { startDate?: string; endDate?: string },
): Promise<PeriodData> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      campaignCreators: {
        include: {
          creator: true,
          performance: true,
        },
      },
      businessLine: true,
      advertiser: true,
    },
  });

  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

  const { startDate, endDate } = reportPeriod ?? {};
  const inPeriod = (d: string) => (!startDate || d >= startDate) && (!endDate || d <= endDate);
  const num = (v: unknown) => Number(v) || 0;

  // ★ 取数真源切换（cps-daily 导入废弃）：流量侧 LinkPerformance + 成交侧 CampaignOrder。
  //   CpsPerformance 冻结只读，不再消费。
  const cps = await loadCreatorCps(campaignId);

  // 1) 每个创作者的期内 daily 求和
  const perCreator: { cc: Any; sum: { clicks: number; orders: number; gmv: number; newCustomers: number; commission: number } }[] =
    (campaign.campaignCreators ?? []).map((cc: Any) => {
      const sum = { clicks: 0, orders: 0, gmv: 0, newCustomers: 0, commission: 0 };
      const e = cps.byCc.get(cc.id);
      if (e) {
        for (const [date, cell] of e.daily) {
          if (!inPeriod(date)) continue;
          sum.clicks += cell.clicks;
          sum.orders += cell.orders;
          sum.gmv += cell.gmv;
          sum.newCustomers += cell.newCustomers;
          sum.commission += cell.commission;
        }
      }
      return { cc, sum };
    });

  // 2) 总量
  const total = perCreator.reduce(
    (a, x) => ({
      clicks: a.clicks + x.sum.clicks,
      orders: a.orders + x.sum.orders,
      gmv: a.gmv + x.sum.gmv,
      newCustomers: a.newCustomers + x.sum.newCustomers,
      commission: a.commission + x.sum.commission,
    }),
    { clicks: 0, orders: 0, gmv: 0, newCustomers: 0, commission: 0 },
  );

  const aov = total.orders ? total.gmv / total.orders : 0;
  void aov; // used below in finalAov fallback

  // 3) 如果期内 daily 为空，降级到 campaign.metrics 全量数据
  const hasDaily = cps.dailyRowCount > 0;

  let finalTotal = total;
  let finalPerCreator = perCreator;

  if (!hasDaily) {
    const m = (campaign.metrics ?? {}) as Any;
    finalTotal = {
      clicks: num(m.clicks),
      orders: num(m.orders),
      gmv: num(m.gmv ?? m.revenue),
      newCustomers: num(m.newCustomers),
      commission: num(m.commission),
    };
    // 用 LP 聚合列 + 订单表全量兜底
    finalPerCreator = (campaign.campaignCreators ?? []).map((cc: Any) => {
      const e = cps.byCc.get(cc.id);
      return {
        cc,
        sum: {
          clicks: e?.clicks ?? 0,
          orders: e?.orders ?? 0,
          gmv: e?.gmv ?? 0,
          newCustomers: e?.newCustomers ?? 0,
          commission: e?.commission ?? 0,
        },
      };
    });
  }

  const finalAov = finalTotal.orders ? finalTotal.gmv / finalTotal.orders : 0;

  // 4) KPI 映射
  const kpisRaw: Record<string, number> = {
    revenue: finalTotal.gmv,
    gmv: finalTotal.gmv,
    clicks: finalTotal.clicks,
    orders: finalTotal.orders,
    newCustomers: finalTotal.newCustomers,
    aov: finalAov,
    commission: finalTotal.commission,
    spend: finalTotal.commission, // alias
  };

  const kpis: Record<string, string> = {
    revenue: formatMoney(finalTotal.gmv),
    gmv: formatMoney(finalTotal.gmv),
    clicks: formatNum(finalTotal.clicks),
    orders: formatNum(finalTotal.orders),
    newCustomers: formatNum(finalTotal.newCustomers),
    aov: formatMoney(finalAov),
    commission: formatMoney(finalTotal.commission),
    spend: formatMoney(finalTotal.commission),
    roas: finalTotal.commission ? formatRatio(finalTotal.gmv / finalTotal.commission) : '0.00',
  };

  // 5) Creators
  const creators: CreatorRow[] = finalPerCreator
    .filter(({ sum }) => sum.clicks > 0 || sum.orders > 0 || sum.gmv > 0)
    .map(({ cc, sum }) => ({
      name: cc.creator?.name ?? 'Unknown',
      handle: cc.creator?.handle || undefined,
      platform: cc.creator?.platform ?? campaign.platform,
      partnerType: cc.creator?.partnerType,
      avatarUrl: cc.creator?.avatar || undefined,
      clicks: sum.clicks,
      orders: sum.orders,
      gmv: sum.gmv,
      newCustomers: sum.newCustomers,
      commission: sum.commission,
      posts: num(cc.performance?.posts),
      engagement: num(cc.performance?.engagement),
      impressions: num(cc.performance?.impressions),
      engagementRate: num(cc.performance?.engagementRate),
    }));

  // 6) Trend（跨创作者按 date 分组——campaign 级每日合并）
  const byDate = new Map<string, { revenue: number; clicks: number; orders: number }>();
  for (const [date, cell] of cps.campaignDaily) {
    if (!inPeriod(date)) continue;
    byDate.set(date, { revenue: cell.gmv, clicks: cell.clicks, orders: cell.orders });
  }
  const dates = [...byDate.keys()].sort();
  const trend = dates.map((d) => ({
    date: d,
    revenue: byDate.get(d)!.revenue,
    clicks: byDate.get(d)!.clicks,
    orders: byDate.get(d)!.orders,
  }));

  // 7) Period display
  const start = reportPeriod?.startDate ?? campaign.startDate ?? '';
  const end = reportPeriod?.endDate ?? campaign.endDate ?? '';
  const period = {
    start,
    end,
    display: start && end ? `${shortDate(start)} - ${shortDate(end)}` : '',
  };

  return { kpis, kpisRaw, creators, trend, period };
}

// ═══ HTML 渲染 ═══

/**
 * 检测 HTML 是否包含 data-field 标注（是否为可渲染模板）。
 */
export function isTemplatedHtml(html: string): boolean {
  return /data-field\s*=/i.test(html);
}

/**
 * 提取模板中所有 data-field 字段名（用于 schema 展示）。
 */
export function extractDataFields(html: string): string[] {
  const matches = html.matchAll(/data-field\s*=\s*"([^"]+)"/g);
  const fields = new Set<string>();
  for (const m of matches) {
    fields.add(m[1]);
  }
  return [...fields];
}

/**
 * 生成创作者 <tr> 行 HTML，模仿模板第一行的结构。
 */
function generateCreatorRows(templateRowHtml: string, creators: CreatorRow[]): string {
  if (creators.length === 0) return '';
  // 从模板行提取 data-field → <td> 映射，保留每个 td 的完整结构（class、style 等）
  const tdPattern = /<td[^>]*data-field="([^"]+)"[^>]*>([\s\S]*?)<\/td>/gi;
  const tdTemplate: { field: string; fullTd: string }[] = [];
  let m;
  while ((m = tdPattern.exec(templateRowHtml)) !== null) {
    tdTemplate.push({ field: m[1], fullTd: m[0] });
  }

  // 如果模板行没有 data-field 标注，用 fallback 生成简单行
  if (tdTemplate.length === 0) {
    return creators.map(c => `<tr data-creator="${escapeHtml(c.name)}">
      <td>${escapeHtml(c.name)}</td>
      <td>${formatNum(c.clicks)}</td>
      <td>${formatNum(c.orders)}</td>
      <td>${formatMoney(c.gmv)}</td>
    </tr>`).join('\n');
  }

  return creators.map(c => {
    const tds = tdTemplate.map(({ field, fullTd }) => {
      const value = getCreatorFieldValue(c, field);
      // 替换 td 的内容（保留 td 的属性如 class、style）
      return fullTd.replace(/(<td[^>]*>)[\s\S]*?(<\/td>)/i, `$1${value}$2`);
    }).join('\n      ');
    return `      <tr data-creator="${escapeHtml(c.name)}">\n      ${tds}\n    </tr>`;
  }).join('\n');
}

function getCreatorFieldValue(c: CreatorRow, field: string): string {
  switch (field) {
    case 'creator.name':
    case 'name':
      return escapeHtml(c.name);
    case 'creator.handle':
    case 'handle':
      return escapeHtml(c.handle ?? c.name);
    case 'creator.platform':
    case 'platform':
      return escapeHtml(c.platform ?? '');
    case 'creator.cps.clicks':
    case 'clicks':
      return formatNum(c.clicks);
    case 'creator.cps.orders':
    case 'orders':
      return formatNum(c.orders);
    case 'creator.cps.gmv':
    case 'gmv':
    case 'revenue':
      return formatMoney(c.gmv);
    case 'creator.cps.commission':
    case 'commission':
      return formatMoney(c.commission);
    case 'creator.cps.newCustomers':
    case 'newCustomers':
      return formatNum(c.newCustomers);
    case 'posts':
      return formatNum(c.posts ?? 0);
    case 'engagement':
      return formatNum(c.engagement ?? 0);
    case 'impressions':
      return formatNum(c.impressions ?? 0);
    case 'engagementRate':
      return formatPct(c.engagementRate ?? 0);
    default:
      // Avatar 特殊处理
      if (field.includes('avatar') || field.includes('img')) {
        if (c.avatarUrl) return c.avatarUrl;
        return '';
      }
      return '—';
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 替换 script 中 dailyTrend 数组。
 */
function replaceTrendData(html: string, trend: PeriodData['trend']): string {
  if (trend.length === 0) return html;

  // 匹配 const dailyTrend = [ ... ];
  const trendJson = JSON.stringify(trend);
  return html.replace(
    /(const\s+dailyTrend\s*=\s*)\[([\s\S]*?)\]\s*;/,
    `$1${trendJson};`,
  );
}

/**
 * 主渲染函数：用新周期数据填充带 data-field 标注的 HTML 模板。
 * 
 * @returns 渲染后的完整 HTML
 */
export async function renderTemplate(
  html: string,
  campaignId: string,
  reportPeriod?: { startDate?: string; endDate?: string },
): Promise<string> {
  const data = await extractPeriodData(campaignId, reportPeriod);
  let result = html;

  // 1) 替换 KPI 值（单个 data-field 元素的文本内容）
  for (const [field, value] of Object.entries(data.kpis)) {
    // 匹配: <tag ... data-field="fieldName" ...>oldText</tag>
    // 替换为: <tag ... data-field="fieldName" ...>newValue</tag>
    // ★ 第二参必须用函数形式:值常以 $ 开头(formatMoney 产物,如 "$17.9K"),
    //   模板串形式的 `$1${value}` 会把值里的 $1/$& 当捕获组反向引用 → 标签复制/塌陷。
    const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `(<[a-zA-Z0-9]+[^>]*data-field=["']${escapedField}["'][^>]*>)([\\s\\S]*?)(<\\/[a-zA-Z0-9]+>)`,
      'gi',
    );
    result = result.replace(regex, (_m, open: string, _old: string, close: string) => `${open}${value}${close}`);
  }

  // 2) 替换 period 值
  const periodFields: Record<string, string> = {
    'period.start': shortDate(data.period.start),
    'period.end': shortDate(data.period.end),
    'period.display': data.period.display,
  };
  for (const [field, value] of Object.entries(periodFields)) {
    const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `(<[a-zA-Z0-9]+[^>]*data-field=["']${escapedField}["'][^>]*>)([\\s\\S]*?)(<\\/[a-zA-Z0-9]+>)`,
      'gi',
    );
    // ★ 同上:escapeHtml 不转义 $,仍需函数形式防 $N 注入。
    result = result.replace(regex, (_m, open: string, _old: string, close: string) => `${open}${escapeHtml(value)}${close}`);
  }

  // 3) 重建 creators 表格行
  const creatorsBlockRegex = /(<tbody[^>]*data-field=["']creators["'][^>]*>)([\s\S]*?)(<\/tbody>)/i;
  const creatorsMatch = result.match(creatorsBlockRegex);
  if (creatorsMatch) {
    const tbodyOpen = creatorsMatch[1];
    const tbodyInner = creatorsMatch[2];
    const tbodyClose = creatorsMatch[3];

    // 提取第一个 <tr> 作为模板行
    const firstTrMatch = tbodyInner.match(/<tr[^>]*data-creator[^>]*>[\s\S]*?<\/tr>/i);
    if (firstTrMatch) {
      const templateRow = firstTrMatch[0];
      const newRows = generateCreatorRows(templateRow, data.creators);
      result = result.replace(
        creatorsBlockRegex,
        `${tbodyOpen}\n${newRows}\n${tbodyClose}`,
      );
    }
  }

  // 4) 替换 trend 数据
  result = replaceTrendData(result, data.trend);

  // 5) 通用日期正则替换（覆盖未标注 data-field 的日期）
  if (reportPeriod) {
    result = replaceDates(result, reportPeriod);
  }

  return result;
}

/**
 * 通用日期替换（降级方案）。
 */
function replaceDates(
  html: string,
  newPeriod: { startDate?: string; endDate?: string },
): string {
  // YYYY-MM-DD → 替换范围内出现的旧日期
  // 简单策略：找到所有日期，如果在合理范围内就替换为对应的新日期
  let result = html;

  if (newPeriod.startDate) {
    // 找到第一个 YYYY-MM-DD 格式的日期作为旧 start，替换为新 start
    const firstDateMatch = result.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (firstDateMatch) {
      result = result.replaceAll(firstDateMatch[0], newPeriod.startDate);
    }
  }

  if (newPeriod.endDate) {
    // 找到最后一个 YYYY-MM-DD 格式的日期
    const allDates = [...result.matchAll(/\d{4}-\d{2}-\d{2}/g)];
    if (allDates.length >= 2) {
      const lastDate = allDates[allDates.length - 1][0];
      if (lastDate !== newPeriod.endDate) {
        result = result.replaceAll(lastDate, newPeriod.endDate);
      }
    }
  }

  return result;
}
