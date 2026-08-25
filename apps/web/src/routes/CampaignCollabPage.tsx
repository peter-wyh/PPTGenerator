/**
 * Campaign 合作列表页 —— 展示所有 Campaign × Creator 合作关系。
 * 独立路由页面（/data/campaign-collabs）。
 * 支持 URL search params ?campaign=xxx 自动筛选。
 *
 * 表格行 = Campaign × Creator，达人头像/合作方式/作品截图/效果指标累加全部平铺在列中。
 * 点击「详情」打开右侧浮窗，展示每部作品的详细数据。
 */
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { campaignsApi, dtoToCampaign, dtoToCreator, type CpsOverview } from '@/api/campaignsApi';
import type { Campaign, Creator } from '@mediakit/shared';
import { getCollaboration, saveCollaboration } from '@/api/collaborations';
import { collaborationLabel, type CollaborationData, type CollaborationDeliverable, type PostDaily, type CpsDaily, type CpsLinkData, type PartnerType } from '@mediakit/shared';
import { buildSeedCollaboration, buildCpsDaily } from '@/api/analytics/collaborationSeed';
import { formatUSD, formatEPC } from '@/lib/format';
import { CreatorAvatar } from '@/components/CreatorAvatar';
import { ImageInput } from '@/components/ImageInput';
import { buildPreviewFromRows, downloadTemplate, type PreviewItem } from '@/editor/dataImport';
import type { ImportKind } from '@/editor/dataImport';
import { parseFile } from '@/editor/datasource/parse';
import { ImportPreviewModal } from '@/editor/components/ImportPreviewModal';
import { CampaignAnalyticsEditor } from '@/editor/components/CampaignAnalyticsEditor';
import { toast } from '../components/Toast';

/** 从每日 CPS 明细累加出汇总 CpsLinkData。 */
function cpsDailyToSummary(daily: CpsDaily[]): CpsLinkData {
  let clicks = 0, impressions = 0, orders = 0, gmv = 0, commission = 0;
  for (const d of daily) {
    clicks += parseInt(d.clicks, 10) || 0;
    impressions += parseInt(d.impressions, 10) || 0;
    orders += parseInt(d.orders, 10) || 0;
    gmv += parseFloat(d.gmv.replace(/[$,]/g, '')) || 0;
    commission += parseFloat(d.commission.replace(/[$,]/g, '')) || 0;
  }
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cvr = clicks > 0 ? (orders / clicks) * 100 : 0;
  const spend = Math.round(commission * 1.08);
  const roas = spend > 0 ? gmv / spend : 0;
  const epc = clicks > 0 ? gmv / clicks : 0;
  return {
    clicks: clicks.toLocaleString('en-US'),
    impressions: impressions.toLocaleString('en-US'),
    ctr: `${ctr.toFixed(2)}%`,
    orders: orders.toLocaleString('en-US'),
    cvr: `${cvr.toFixed(2)}%`,
    gmv: formatUSD(gmv),
    commission: formatUSD(commission),
    spend: formatUSD(spend),
    roas: roas.toFixed(2),
    epc: formatEPC(epc),
    daily,
  };
}

/* ============================= 类型 ============================= */

interface CollabRow {
  linkId: string;
  campaign: Campaign;
  campaignId: string;
  creator: Creator;
  creatorId: string;
  collabType: string | null;
  status: string | null;
  contentType: string | null;
  collabData?: CollaborationData | null;
}

/* ============================= 页面 ============================= */

export function CampaignCollabPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const campaignFilterParam = searchParams.get('campaign') ?? location.state?.campaignId ?? '';

  const [rows, setRows] = useState<CollabRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCampaign, setFilterCampaign] = useState(campaignFilterParam);
  const [filterCreator, setFilterCreator] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPartnerType, setFilterPartnerType] = useState<PartnerType | ''>('');
  const [drawerRow, setDrawerRow] = useState<CollabRow | null>(null);
  const [tick, setTick] = useState(0);
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [previewKind, setPreviewKind] = useState<ImportKind>('collaboration');
  const [viewMode, setViewMode] = useState<'collabs' | 'analytics'>('collabs');
  const [analyticsCampaignId, setAnalyticsCampaignId] = useState<string>('');
  const csvRef = useRef<HTMLInputElement>(null);
  const dailyCsvRef = useRef<HTMLInputElement>(null);
  const cpsCsvRef = useRef<HTMLInputElement>(null);
  const cpsDailyCsvRef = useRef<HTMLInputElement>(null);
  const ordersCsvRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (filterCampaign) {
      setSearchParams((prev) => { prev.set('campaign', filterCampaign); return prev; }, { replace: true });
    } else {
      setSearchParams((prev) => { prev.delete('campaign'); return prev; }, { replace: true });
    }
  }, [filterCampaign, setSearchParams]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const campaigns = await campaignsApi.list();
      const allRows: CollabRow[] = [];
      await Promise.all(
        campaigns.map(async (c) => {
          const links = await campaignsApi.listLinks(c.id);
          const rowsWithCollab = await Promise.all(
            links.filter((l) => l.creator).map(async (link) => {
              let collabData: CollaborationData | null = null;
              try {
                collabData = await getCollaboration(c.id, link.creatorId);
              } catch {
                collabData = null;
              }
              if (!collabData || !collabData.deliverables?.length) {
                collabData = buildSeedCollaboration(c.id, link.creatorId);
              }
              return {
                linkId: link.id,
                campaignId: c.id,
                campaign: dtoToCampaign(c),
                creatorId: link.creatorId,
                creator: dtoToCreator(link.creator!),
                collabType: link.collabType,
                status: link.status,
                contentType: link.contentType,
                collabData,
              } satisfies CollabRow;
            }),
          );
          allRows.push(...rowsWithCollab);
        }),
      );
      setRows(allRows);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload, tick]);

  /** CSV/XLSX 导入：每行=一个 deliverable，按 campaignId+creatorId 归组为合作记录 */
  async function onCsv(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const sheets = await parseFile(f);
      setPreviewKind('collaboration');
      setPreview(buildPreviewFromRows('collaboration', sheets[0]?.rows ?? []));
    } catch {
      toast.error('文件解析失败');
    }
  }

  /** 每日明细 CSV/XLSX 导入 */
  async function onCsvDaily(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const sheets = await parseFile(f);
      setPreviewKind('collaborationDaily');
      setPreview(buildPreviewFromRows('collaborationDaily', sheets[0]?.rows ?? []));
    } catch {
      toast.error('文件解析失败');
    }
  }

  /** 确认导入每日明细：走后端 /campaigns/import/collaboration-daily */
  async function confirmDailyImport(validItems: Record<string, unknown>[]) {
    setPreview(null);
    try {
      const r = await campaignsApi.importCollaborationDaily(validItems);
      toast.success(`每日明细导入完成:更新 ${r.updated},跳过 ${r.skipped}`);
      setTick((t) => t + 1);
    } catch {
      toast.error('每日明细导入失败');
    }
  }

  /** CPS 汇总 CSV 导入 */
  async function onCsvCps(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const sheets = await parseFile(f);
      setPreviewKind('cps');
      setPreview(buildPreviewFromRows('cps', sheets[0]?.rows ?? []));
    } catch {
      toast.error('文件解析失败');
    }
  }

  /** CPS 每日明细 CSV 导入 */
  async function onCsvCpsDaily(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const sheets = await parseFile(f);
      setPreviewKind('cpsDaily');
      setPreview(buildPreviewFromRows('cpsDaily', sheets[0]?.rows ?? []));
    } catch {
      toast.error('文件解析失败');
    }
  }

  async function confirmCpsImport(validItems: Record<string, unknown>[]) {
    setPreview(null);
    try {
      const r = await campaignsApi.importCps(validItems);
      toast.success(`CPS 汇总导入完成:更新 ${r.updated},跳过 ${r.skipped}`);
      setTick((t) => t + 1);
    } catch {
      toast.error('CPS 导入失败');
    }
  }

  async function confirmCpsDailyImport(validItems: Record<string, unknown>[]) {
    setPreview(null);
    try {
      const r = await campaignsApi.importCpsDaily(validItems);
      toast.success(`CPS 每日明细导入完成:更新 ${r.updated},跳过 ${r.skipped}`);
      setTick((t) => t + 1);
    } catch {
      toast.error('CPS 每日明细导入失败');
    }
  }

  /** 订单商品明细 CSV 导入（联盟平台订单导出） */
  function onCsvOrders(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    parseFile(f)
      .then((sheets) => {
        setPreviewKind('orders');
        setPreview(buildPreviewFromRows('orders', sheets[0]?.rows ?? []));
      })
      .catch(() => toast.error('文件解析失败'));
  }

  async function confirmOrdersImport(validItems: Record<string, unknown>[]) {
    setPreview(null);
    try {
      const r = await campaignsApi.importOrders(validItems);
      toast.success(`订单明细导入完成:更新 ${r.updated},跳过 ${r.skipped}`);
      setTick((t) => t + 1);
    } catch {
      toast.error('订单明细导入失败');
    }
  }

  /** 确认导入：将扁平行按 (campaignId, creatorId) 归组 → 每组构建一个 CollaborationData → 逐条 saveCollaboration
   *  支持汇总行（dailyDate 为空）和每日明细行（dailyDate 非空）。
   *  归组键: campaignId::creatorId，deliverable 键: contentType + publishedAt。 */
  async function confirmCollabImport(validItems: Record<string, unknown>[]) {
    setPreview(null);

    // ── 第一轮遍历：构建 deliverable map ──
    // key = campaignId::creatorId → (deliverableKey → { del, dailyPost: Map, dailyCps: Map })
    type DelBuf = { del: CollaborationDeliverable; dailyPost: Map<string, PostDaily>; dailyCps: Map<string, CpsDaily> };
    const grouped = new Map<string, Map<string, DelBuf>>();

    for (const item of validItems) {
      const cid = String(item.campaignId ?? '');
      const creId = String(item.creatorId ?? '');
      if (!cid || !creId) continue;
      const groupKey = `${cid}::${creId}`;
      const ct = (item.contentType as CollaborationDeliverable['contentType']) ?? 'post';
      const pub = item.publishedAt ? String(item.publishedAt) : '';
      const delKey = `${ct}::${pub}`;
      const dailyDate = item.dailyDate ? String(item.dailyDate) : '';

      let g = grouped.get(groupKey);
      if (!g) { g = new Map(); grouped.set(groupKey, g); }

      if (dailyDate) {
        // ── 每日明细行 ──
        let buf = g.get(delKey);
        if (!buf) {
          // 无对应汇总行 → 创建空壳 deliverable
          buf = { del: { contentType: ct }, dailyPost: new Map(), dailyCps: new Map() };
          g.set(delKey, buf);
        }

        // PostDaily（互动指标）
        const hasPost = item.dailyImpressions || item.dailyLikes || item.dailyComments || item.dailyShares || item.dailySaves;
        if (hasPost) {
          buf.dailyPost.set(dailyDate, {
            date: dailyDate,
            impressions: item.dailyImpressions ? String(item.dailyImpressions) : '0',
            likes: item.dailyLikes ? String(item.dailyLikes) : '0',
            comments: item.dailyComments ? String(item.dailyComments) : '0',
            shares: item.dailyShares ? String(item.dailyShares) : '0',
            saves: item.dailySaves ? String(item.dailySaves) : '0',
          });
        }

        // CpsDaily（CPS 指标）
        const cpsClicks = item.dailyCpsClicks ? parseInt(String(item.dailyCpsClicks), 10) || 0 : 0;
        const cpsOrders = item.dailyCpsOrders ? parseInt(String(item.dailyCpsOrders), 10) || 0 : 0;
        const cpsGmv = item.dailyCpsGmv ? parseFloat(String(item.dailyCpsGmv).replace(/[$,]/g, '')) || 0 : 0;
        const cpsCommission = item.dailyCpsCommission ? parseFloat(String(item.dailyCpsCommission).replace(/[$,]/g, '')) || 0 : 0;
        if (cpsClicks > 0 || cpsOrders > 0 || cpsGmv > 0 || cpsCommission > 0) {
          const ctr = cpsClicks > 0 ? (cpsClicks / Math.max(parseInt(String(item.dailyImpressions), 10) || cpsClicks * 30)) * 100 : 0;
          const cvr = cpsClicks > 0 ? (cpsOrders / cpsClicks) * 100 : 0;
          const spend = Math.round(cpsCommission * 1.08);
          const roas = spend > 0 ? cpsGmv / spend : 0;
          const epc = cpsClicks > 0 ? cpsGmv / cpsClicks : 0;
          buf.dailyCps.set(dailyDate, {
            date: dailyDate,
            clicks: String(cpsClicks),
            impressions: item.dailyImpressions ? String(item.dailyImpressions) : String(cpsClicks * 30),
            ctr: `${ctr.toFixed(2)}%`,
            orders: String(cpsOrders),
            cvr: `${cvr.toFixed(2)}%`,
            gmv: `$${Math.round(cpsGmv).toLocaleString('en-US')}`,
            commission: `$${Math.round(cpsCommission).toLocaleString('en-US')}`,
            roas: roas.toFixed(2),
            epc: `$${epc.toFixed(2)}`,
          });
        }
      } else {
        // ── 汇总行（deliverable 定义） ──
        let buf = g.get(delKey);
        if (!buf) {
          buf = { del: { contentType: ct }, dailyPost: new Map(), dailyCps: new Map() };
          g.set(delKey, buf);
        }
        const del = buf.del;
        if (item.publishedAt) del.publishedAt = String(item.publishedAt);
        if (item.platform) del.platform = String(item.platform);
        if (item.metrics) del.metrics = item.metrics as CollaborationDeliverable['metrics'];
        if (item.screenshots) del.screenshots = item.screenshots as CollaborationDeliverable['screenshots'];
        if (item.execPrice) del.execPrice = String(item.execPrice);

        // CPS 挂链效果：填了 cpsClicks 即启用
        const cpsClicks = item.cpsClicks ? parseInt(String(item.cpsClicks), 10) || 0 : 0;
        if (cpsClicks > 0) {
          const cpsOrders = item.cpsOrders ? parseInt(String(item.cpsOrders), 10) || 0 : 0;
          const cpsGmv = item.cpsGmv ? parseFloat(String(item.cpsGmv).replace(/[$,]/g, '')) || 0 : 0;
          const cpsCommission = item.cpsCommission ? parseFloat(String(item.cpsCommission).replace(/[$,]/g, '')) || 0 : 0;
          const linkUrl = item.cpsLinkUrl ? String(item.cpsLinkUrl) : undefined;

          const ctr = 3 + (cpsClicks % 20) / 10;
          const impressions = Math.round((cpsClicks * 100) / ctr);
          const cvr = cpsClicks > 0 ? (cpsOrders / cpsClicks) * 100 : 0;
          const spend = Math.round(cpsCommission * 1.08);
          const roas = spend > 0 ? cpsGmv / spend : 0;
          const epc = cpsClicks > 0 ? cpsGmv / cpsClicks : 0;
          const aov = cpsOrders > 0 ? cpsGmv / cpsOrders : 0;

          // 如果有明细行，使用明细行的 CPS daily；否则按 S 曲线拆分
          del.cps = {
            linkUrl,
            clicks: cpsClicks.toLocaleString('en-US'),
            impressions: impressions.toLocaleString('en-US'),
            ctr: `${ctr.toFixed(2)}%`,
            orders: cpsOrders.toLocaleString('en-US'),
            cvr: `${cvr.toFixed(2)}%`,
            gmv: `$${Math.round(cpsGmv).toLocaleString('en-US')}`,
            commission: `$${Math.round(cpsCommission).toLocaleString('en-US')}`,
            spend: `$${spend.toLocaleString('en-US')}`,
            roas: roas.toFixed(2),
            epc: `$${epc.toFixed(2)}`,
            daily: [], // 先占位，下面填充
          };
          // 保存这些用于后面构建汇总 CPS（如果明细行覆盖了汇总）
          (buf as DelBuf & { _cpsSummary?: Record<string, unknown> })._cpsSummary = {
            cpsClicks, cpsOrders, cpsGmv, cpsCommission, linkUrl, ctr, impressions, cvr, spend, roas, epc, aov,
          };
        }
      }
    }

    // ── 第二轮：将 daily map 写入 deliverable，构建最终 CollaborationData ──
    // 收集 partnerType（CSV 中每行可携带，取第一个非空值）
    const partnerTypeMap = new Map<string, PartnerType>();
    for (const item of validItems) {
      const cid = String(item.creatorId ?? '');
      const pt = item.partnerType as PartnerType | undefined;
      if (cid && pt && !partnerTypeMap.has(cid)) partnerTypeMap.set(cid, pt);
    }

    let success = 0, fail = 0;
    for (const [key, delMap] of grouped) {
      const [campaignId, creatorId] = key.split('::');
      const deliverables: CollaborationDeliverable[] = [];
      for (const buf of delMap.values()) {
        const del = buf.del;

        // 写入 PostDaily
        if (buf.dailyPost.size > 0) {
          del.daily = [...buf.dailyPost.values()].sort((a, b) => a.date.localeCompare(b.date));
        }

        // 写入 CpsDaily
        if (buf.dailyCps.size > 0) {
          const cpsDailyArr = [...buf.dailyCps.values()].sort((a, b) => a.date.localeCompare(b.date));
          if (del.cps) {
            // 有明细 CPS 数据 → 覆盖 S 曲线拆分
            del.cps.daily = cpsDailyArr;
          } else {
            // 有明细 CPS 但无汇总 CPS → 只填 daily，汇总从明细累加
            del.cps = cpsDailyToSummary(cpsDailyArr);
          }
        } else if (del.cps) {
          // 有汇总 CPS 但无明细 → 按 S 曲线拆分
          const summary = (buf as DelBuf & { _cpsSummary?: Record<string, unknown> })._cpsSummary;
          if (summary) {
            del.cps.daily = buildCpsDaily(
              del.publishedAt,
              {
                clicks: summary.cpsClicks as number,
                impressions: summary.impressions as number,
                orders: summary.cpsOrders as number,
                gmv: summary.cpsGmv as number,
                commission: summary.cpsCommission as number,
                ctr: summary.ctr as number,
                cvr: summary.cvr as number,
                aov: summary.aov as number,
              },
            );
          }
        }

        deliverables.push(del);
      }
      try {
        // 如果 CSV 中有 partnerType，同步更新 Creator 记录
        const pt = partnerTypeMap.get(creatorId);
        if (pt) {
          try { await campaignsApi.updateCreator(creatorId, { partnerType: pt }); } catch { /* 忽略，不影响导入主流程 */ }
        }
        await saveCollaboration({ id: `collab:${campaignId}:${creatorId}`, campaignId, creatorId, partnerType: pt, deliverables });
        success++;
      } catch {
        fail++;
      }
    }
    toast.success(`导入完成: ${success} 条合作记录成功${fail > 0 ? `, ${fail} 条失败` : ''}`);
    setTick((t) => t + 1);
  }

  const filtered = rows.filter((r) => {
    if (filterCampaign && !r.campaign.name.toLowerCase().includes(filterCampaign.toLowerCase()) && r.campaignId !== filterCampaign) return false;
    if (filterCreator && !r.creator.name.toLowerCase().includes(filterCreator.toLowerCase())) return false;
    if (filterStatus && (r.status ?? '—') !== filterStatus) return false;
    const pt = r.creator.partnerType ?? 'creator';
    if (filterPartnerType && pt !== filterPartnerType) return false;
    return true;
  });

  const statusSet = [...new Set(rows.map((r) => r.status ?? '—').filter(Boolean))];

  if (loading) {
    return <p className="text-sm text-foreground-muted">加载合作列表…</p>;
  }

  const heads = [
    '#', 'Campaign', '合作方', 'Handle', '平台', '层级',
    '粉丝/访问量', '互动率', '类目', '地区',
    '合作方式', '作品(截图+数据)', '',
    '状态', '',
  ];

  return (
    <div>
      {/* 视图切换 */}
      <div className="mb-3 flex items-center gap-1">
        <button onClick={() => setViewMode('collabs')} className={`rounded px-3 py-1 text-xs font-medium ${viewMode === 'collabs' ? 'bg-accent-primary text-white' : 'bg-surface-secondary text-foreground-secondary hover:bg-surface-hover'}`}>合作列表</button>
        <button onClick={() => setViewMode('analytics')} className={`rounded px-3 py-1 text-xs font-medium ${viewMode === 'analytics' ? 'bg-accent-primary text-white' : 'bg-surface-secondary text-foreground-secondary hover:bg-surface-hover'}`}>分析数据</button>
      </div>

      {viewMode === 'analytics' ? (
        <div className="max-w-3xl space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-xs text-foreground-secondary">选择 Campaign:</label>
            <select value={analyticsCampaignId} onChange={(e) => setAnalyticsCampaignId(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary min-w-[240px]">
              <option value="">— 选择 —</option>
              {[...new Map(rows.map((r) => [r.campaignId, r.campaign.name])).entries()].map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
          {analyticsCampaignId ? (
            <CampaignAnalyticsEditor key={analyticsCampaignId} campaignId={analyticsCampaignId} campaignName={rows.find((r) => r.campaignId === analyticsCampaignId)?.campaign.name} />
          ) : (
            <p className="text-sm text-foreground-muted py-8 text-center">请选择一个 Campaign 以编辑分析数据</p>
          )}
        </div>
      ) : (
        <>
      {/* Tab 切换合作方类型 */}
      <div className="mb-3 flex items-center gap-1">
        {([
          { value: '' as const, label: '全部' },
          { value: 'creator' as const, label: '达人' },
          { value: 'community' as const, label: '社群' },
          { value: 'content_site' as const, label: '内容站' },
        ]).map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilterPartnerType(tab.value)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              filterPartnerType === tab.value
                ? 'bg-accent-primary text-white'
                : 'bg-surface-secondary text-foreground-secondary hover:bg-surface-hover'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-foreground-secondary">
          共 <span className="font-medium text-foreground-primary">{filtered.length}</span> 条合作关系
          {filterCampaign && (
            <span className="ml-2">
              · 筛选: <span className="text-accent-primary">{filterCampaign}</span>
              <button onClick={() => setFilterCampaign('')} className="ml-1 text-foreground-muted hover:text-foreground-primary">✕</button>
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            placeholder="搜索 Campaign…"
            value={filterCampaign}
            onChange={(e) => setFilterCampaign(e.target.value)}
            className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary placeholder:text-foreground-muted w-36"
          />
          <input
            placeholder="搜索达人…"
            value={filterCreator}
            onChange={(e) => setFilterCreator(e.target.value)}
            className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary placeholder:text-foreground-muted w-36"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-secondary"
          >
            <option value="">全部状态</option>
            {statusSet.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          onClick={() => csvRef.current?.click()}
          className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary"
        >
          导入合作汇总 CSV
        </button>
        <button
          onClick={() => dailyCsvRef.current?.click()}
          className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary"
        >
          导入每日互动 CSV
        </button>
        <button
          onClick={() => cpsCsvRef.current?.click()}
          className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary"
        >
          导入 CPS 汇总 CSV
        </button>
        <button
          onClick={() => cpsDailyCsvRef.current?.click()}
          className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary"
        >
          导入 CPS 每日明细 CSV
        </button>
        <button
          onClick={() => ordersCsvRef.current?.click()}
          className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary"
        >
          导入订单明细 CSV
        </button>
        <select
          onChange={(e) => { if (e.target.value) downloadTemplate(e.target.value as ImportKind); e.target.value = ''; }}
          className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
          defaultValue=""
        >
          <option value="" disabled>下载模板</option>
          <option value="collaboration">合作汇总模板</option>
          <option value="collaborationDaily">每日互动模板</option>
          <option value="cps">CPS 汇总模板</option>
          <option value="cpsDaily">CPS 每日明细模板</option>
          <option value="orders">订单明细模板</option>
        </select>
        <input ref={csvRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onCsv} />
        <input ref={dailyCsvRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onCsvDaily} />
        <input ref={cpsCsvRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onCsvCps} />
        <input ref={cpsDailyCsvRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onCsvCpsDaily} />
        <input ref={ordersCsvRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onCsvOrders} />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-foreground-muted">暂无合作关系数据。</p>
      ) : (
        <div className="overflow-auto rounded-lg border border-border-default">
          <table className="w-full min-w-[1400px] border-collapse text-xs">
            <thead>
              <tr className="bg-surface-hover text-left text-[10px] text-foreground-muted">
                {heads.map((h, i) => (
                  <th key={i} className={`px-2 py-2 font-medium whitespace-nowrap ${i === 0 ? 'sticky left-0 z-10 bg-surface-hover' : ''} ${i === heads.length - 1 ? 'sticky right-0 z-10 bg-surface-hover text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => {
                const collabLabel = r.collabData ? collaborationLabel(r.collabData) : (r.collabType ?? '—');
                const deliverables = r.collabData?.deliverables ?? [];
                return (
                  <tr key={r.linkId} className="border-t border-border-subtle hover:bg-surface-hover/50">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-surface-primary px-2 py-2 font-mono text-[10px] tabular-nums text-foreground-muted hover:bg-surface-hover/50">{idx + 1}</td>
                    <td className="whitespace-nowrap px-2 py-2 font-medium text-foreground-primary">{r.campaign.name}</td>
                    {/* 达人带头像 */}
                    <td className="whitespace-nowrap px-2 py-2">
                      <div className="flex items-center gap-1.5">
                        <CreatorAvatar name={r.creator.name} avatar={r.creator.avatar} size={28} />
                        <span className="font-medium text-foreground-primary">{r.creator.name}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{r.creator.handle}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{r.creator.platform}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{r.creator.tier}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{r.creator.followers}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{r.creator.engagement}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{r.creator.category || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{r.creator.region || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{collabLabel}</td>
                    {/* 作品列：每个作品一行（截图 + type + 单品数据） */}
                    <td className="px-2 py-2 min-w-[320px]">
                      {deliverables.length === 0 ? (
                        <span className="text-foreground-muted">—</span>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {/* 汇总行 */}
                          <div className="flex items-center gap-2 rounded bg-surface-hover px-1.5 py-1">
                            <span className="text-[9px] text-foreground-muted">合计({deliverables.length}类型)</span>
                            {(() => {
                              const agg = aggregateAllMetrics(deliverables);
                              return agg.map(([label, value]) => (
                                <MetricBadge key={label} label={label} value={value} />
                              ));
                            })()}
                          </div>
                          {/* 每个作品一行 */}
                          {deliverables.map((del, di) => {
                            const shots = (del.screenshots ?? []).filter((s) => s.src).slice(0, 3);
                            const delMetrics = del.metrics ?? [];
                            return (
                              <div key={`${del.contentType}-${di}`} className="flex items-center gap-2 rounded border border-border-subtle px-1.5 py-1">
                                {/* 截图 */}
                                {shots.length > 0 ? (
                                  <div className="flex gap-0.5">
                                    {shots.map((s, si) => (
                                      <a key={si} href={s.url ?? s.src} target="_blank" rel="noopener noreferrer" title={s.caption ?? ''}>
                                        <img src={s.src} alt={s.caption ?? ''} className="h-8 w-8 rounded border border-border-subtle object-cover hover:opacity-80" />
                                      </a>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="flex h-8 w-8 items-center justify-center rounded bg-surface-hover text-[8px] text-foreground-muted">N/A</div>
                                )}
                                {/* type pill + 发布时间 */}
                                <div className="flex flex-col gap-0.5">
                                  <span className="rounded bg-surface-hover px-1 py-0.5 text-[10px] text-foreground-secondary">{del.contentType}</span>
                                  {del.publishedAt && (
                                    <span className="text-[8px] text-foreground-muted">{del.publishedAt}</span>
                                  )}
                                </div>
                                {/* 动态指标（按平台×类型差异化） */}
                                {delMetrics.map((m, mi) => (
                                  <MetricBadge key={mi} label={m.label} value={m.value} dim />
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    {/* 达人补充数据 */}
                    <td className="px-2 py-2 whitespace-nowrap text-foreground-secondary">
                      <div className="text-[10px]">
                        <div><span className="text-foreground-muted">近90天</span> {r.creator.recentPostsCount ?? '—'}</div>
                        <div><span className="text-foreground-muted">互动中位</span> {r.creator.engagementMedian ?? '—'}</div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{r.status ?? '—'}</td>
                    <td className="sticky right-0 z-10 whitespace-nowrap bg-surface-primary px-2 py-2 text-right hover:bg-surface-hover/50">
                      <button onClick={() => setDrawerRow(r)} className="text-[10px] text-accent-primary hover:underline">详情</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 导入预览弹窗 */}
      {preview && (
        <ImportPreviewModal
          kind={previewKind}
          items={preview}
          onConfirm={
            previewKind === 'collaborationDaily' ? confirmDailyImport
            : previewKind === 'cps' ? confirmCpsImport
            : previewKind === 'cpsDaily' ? confirmCpsDailyImport
            : previewKind === 'orders' ? confirmOrdersImport
            : confirmCollabImport
          }
          onCancel={() => setPreview(null)}
        />
      )}

      {/* 右侧浮窗 */}
      {drawerRow && (
        <CollabDrawer
          key={drawerRow.linkId}
          row={drawerRow}
          onClose={() => setDrawerRow(null)}
          onUpdate={() => { setDrawerRow(null); setTick((t) => t + 1); }}
        />
      )}
        </>
      )}
    </div>
  );
}

/* ============================= 右侧浮窗 ============================= */

function CollabDrawer({ row, onClose, onUpdate }: { row: CollabRow; onClose: () => void; onUpdate: () => void }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCloseRef.current(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const [collabData, setCollabData] = useState<CollaborationData>(row.collabData ?? buildSeedCollaboration(row.campaignId, row.creatorId));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  // CPS 实绩（只读聚合）：成交←订单表逐单，流量←CpsPerformance。与报告 AI 上下文同口径。
  const [cpsOv, setCpsOv] = useState<CpsOverview['rows'][number] | null>(null);
  useEffect(() => {
    let alive = true;
    campaignsApi.cpsOverview(row.campaignId, { creatorId: row.creatorId })
      .then((r) => { if (alive) setCpsOv(r.rows[0] ?? null); })
      .catch(() => { if (alive) setCpsOv(null); });
    return () => { alive = false; };
  }, [row.campaignId, row.creatorId]);

  const creator = row.creator;
  const metrics = creator.metrics ?? [];

  async function save() {
    setBusy(true);
    try {
      await saveCollaboration(collabData);
      onUpdate();
    } catch {
      toast.error('保存失败');
    } finally {
      setBusy(false);
    }
  }

  function patch(fn: (d: CollaborationData) => CollaborationData) {
    setCollabData((prev) => fn(prev));
  }
  const setDeliverable = (i: number, del: CollaborationDeliverable) =>
    patch((d) => ({ ...d, deliverables: d.deliverables.map((x, idx) => (idx === i ? del : x)) }));
  const removeDeliverable = (i: number) =>
    patch((d) => ({ ...d, deliverables: d.deliverables.filter((_, idx) => idx !== i) }));
  const addDeliverable = () =>
    patch((d) => ({ ...d, deliverables: [...d.deliverables, { contentType: 'post' }] }));

  return (
    <div className="fixed inset-0 z-50 animate-fadeIn bg-black/40" onClick={onClose} role="presentation">
      <aside
        className="absolute right-0 top-0 flex h-full w-[1100px] max-w-[95vw] animate-slideInRight flex-col bg-surface-primary shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="合作详情"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <CreatorAvatar name={creator.name} avatar={creator.avatar} size={36} />
            <div className="min-w-0">
              <div className="font-headings text-sm font-semibold text-foreground-primary truncate">{creator.name}</div>
              <div className="text-xs text-foreground-muted truncate">{row.campaign.name} · {creator.handle}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {editing ? (
              <>
                <button disabled={busy} onClick={() => void save()} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50">保存</button>
                <button onClick={() => setEditing(false)} className="text-xs text-foreground-secondary hover:underline">取消</button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="text-xs text-accent-primary hover:underline">编辑</button>
            )}
            <button onClick={onClose} aria-label="关闭" className="rounded p-1 text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary">✕</button>
          </div>
        </div>

        {/* 内容 */}
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {/* 合作方信息卡（按 partnerType 差异化标签） */}
          {(() => {
            const pt = creator.partnerType ?? 'creator';
            const labelMap: Record<string, Record<string, string>> = {
              creator: { title: '达人信息', followers: 'Followers', engagement: 'Engagement', category: 'Category', recent: '近90天作品', median: '互动中位数' },
              community: { title: '社群信息', followers: '群成员数', engagement: '活跃度', category: '社群类型', recent: '近90天帖子', median: '互动中位数' },
              content_site: { title: '内容站信息', followers: '月访问量', engagement: '跳出率', category: '站点类型', recent: '近90天发文', median: '平均停留' },
            };
            const L = labelMap[pt] ?? labelMap.creator;
            return (
              <div className="mb-4">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">{L.title}</div>
                <div className="grid grid-cols-5 gap-px rounded-lg overflow-hidden border border-border-subtle">
                  {([
                    ['Platform', creator.platform],
                    ['Tier', creator.tier],
                    [L.followers, creator.followers],
                    [L.engagement, creator.engagement],
                    [L.category, creator.category],
                    ['Region', creator.region],
                    [L.recent, String(creator.recentPostsCount ?? '—')],
                    [L.median, creator.engagementMedian ?? '—'],
                    ['合作方式', collaborationLabel(collabData)],
                    ['状态', row.status ?? '—'],
                  ] as const).map(([label, value]) => (
                    <div key={label} className="bg-surface-primary p-2">
                      <div className="text-[10px] uppercase tracking-wide text-foreground-muted">{label}</div>
                      <div className="text-xs font-medium text-foreground-primary truncate">{value || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* 频道 KPI */}
          {metrics.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">频道 KPI</div>
              <div className="grid grid-cols-3 gap-2">
                {metrics.map((m, i) => (
                  <div key={`${m.label}-${i}`} className="rounded-md border border-border-subtle p-2.5">
                    <div className="text-[10px] text-foreground-muted">{m.label}</div>
                    <div className="text-sm font-semibold text-foreground-primary">{m.value}</div>
                    {m.compare && <div className="text-[10px] text-foreground-secondary">{m.compare}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CPS 实绩（只读聚合：成交←订单表，流量←CpsPerformance；编辑模式隐藏避免与手填混淆） */}
          {cpsOv && (cpsOv.orders > 0 || cpsOv.clicks > 0) && !editing && (
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
                <span>CPS 实绩</span>
                <span className="font-normal normal-case text-foreground-muted/70">订单表 + 链接导出聚合 · 只读</span>
              </div>
              <div className="grid grid-cols-5 gap-px rounded-lg overflow-hidden border border-border-subtle">
                {([
                  ['订单', String(cpsOv.orders), 'CampaignOrder 逐单计数'],
                  ['GMV', cpsOv.gmv, 'Σ saleAmount（订单表）'],
                  ['佣金', cpsOv.commission, 'Σ commission（订单表）'],
                  ['花费', cpsOv.spend, '佣金 × 1.08'],
                  ['ROAS', cpsOv.roas, 'GMV ÷ 花费'],
                  ['点击', cpsOv.clicks.toLocaleString('en-US'), 'CpsPerformance 链接层'],
                  ['曝光', cpsOv.impressions.toLocaleString('en-US'), 'CpsPerformance 链接层'],
                  ['CTR', cpsOv.ctr, '点击 ÷ 曝光'],
                  ['CVR', cpsOv.cvr, '订单 ÷ 点击'],
                  ['EPC', cpsOv.epc, 'GMV ÷ 点击'],
                ] as const).map(([label, value, hint]) => (
                  <div key={label} className="bg-surface-primary p-2" title={hint}>
                    <div className="text-[10px] uppercase tracking-wide text-foreground-muted">{label}</div>
                    <div className="text-xs font-medium text-foreground-primary tabular-nums truncate">{value}</div>
                  </div>
                ))}
              </div>
              {cpsOv.links.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {cpsOv.links.map((l, i) => (
                    <span key={i} className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-secondary" title={l.linkUrl ?? ''}>
                      {l.contentType} · 点击 {l.clicks.toLocaleString('en-US')}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 作品明细 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">作品明细 · {collabData.deliverables.length}</span>
              {editing && (
                <button onClick={addDeliverable} className="text-xs text-accent-primary hover:underline">+ 添加作品</button>
              )}
            </div>
            {collabData.deliverables.length === 0 ? (
              <p className="text-xs text-foreground-muted">未设置作品。</p>
            ) : (
              <div className="space-y-3">
                {collabData.deliverables.map((del, i) => (
                  <DeliverableCard
                    key={`${del.contentType}-${i}`}
                    deliverable={del}
                    index={i}
                    editing={editing}
                    partnerType={creator.partnerType}
                    onChange={(d) => setDeliverable(i, d)}
                    onRemove={() => removeDeliverable(i)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ============================= 作品卡片 ============================= */

const CONTENT_TYPES: string[] = ['post', 'reels', 'video', 'image', 'live', 'story'];

/** 平台下拉选项 */
const PLATFORM_OPTIONS: string[] = ['TikTok', 'Instagram', 'YouTube', 'Douyin', 'RED', 'Weibo', 'Bilibili', 'Twitter', 'Facebook'];

/** 指标解释说明 — 鼠标 hover title 显示 */
const METRIC_HINTS: Record<string, string> = {
  曝光: '内容被展示的总次数（impressions）',
  播放量: '视频被播放的总次数',
  点赞: '用户点赞总数',
  评论: '用户评论总数',
  转发: '内容被转发/分享的次数',
  收藏: '内容被收藏/保存的次数',
  粉丝增量: '合作期间该达人新增粉丝数',
  互动量: '点赞+评论+转发+收藏的总和',
  互动率: '互动量 ÷ 曝光 × 100%，衡量内容质量',
};

/* ───────── P1-14: 效果数据 icon 库（24 个常用图标，纯内联 SVG，无外部依赖） ───────── */
const METRIC_ICONS: { name: string; path: string }[] = [
  { name: 'eye', path: 'M12 5C7 5 3 12 3 12s4 7 9 7 9-7 9-7-4-7-9-7zm0 11a4 4 0 110-8 4 4 0 010 8z' },
  { name: 'heart', path: 'M12 21s-7-4.5-9-9a5 5 0 019-3 5 5 0 019 3c-2 4.5-9 9-9 9z' },
  { name: 'share', path: 'M18 8a3 3 0 10-2.8-4.2L5 9.5a3 3 0 100 5L15.2 20.2A3 3 0 1018 16a3 3 0 00-2.8 1.8L5 13.5a3 3 0 000-3L15.2 5.2C16 6 17 6.5 18 6.5c1.7 0 3-1.3 3-3a3 3 0 00-3 4.5z' },
  { name: 'message-circle', path: 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z' },
  { name: 'shopping-cart', path: 'M9 22a1 1 0 100-2 1 1 0 000 2zM20 22a1 1 0 100-2 1 1 0 000 2zM1 1h4l2.7 13.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L23 6H6' },
  { name: 'trending-up', path: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6' },
  { name: 'star', path: 'M12 2l3 7h7l-5.5 4 2 7-6.5-4.5L5 20l2-7L1 9h7z' },
  { name: 'thumbs-up', path: 'M7 22V11H3v11h4zM7 11l4-9c1 0 2 1 2 3v3h6a2 2 0 012 2l-2 8a2 2 0 01-2 2H7' },
  { name: 'bookmark', path: 'M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z' },
  { name: 'users', path: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M13 7a4 4 0 11-8 0 4 4 0 018 0zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
  { name: 'bar-chart', path: 'M12 20V10M18 20V4M6 20v-4M3 20h18' },
  { name: 'dollar-sign', path: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6' },
  { name: 'target', path: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 6a4 4 0 100 8 4 4 0 000-8z' },
  { name: 'zap', path: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
  { name: 'clock', path: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2' },
  { name: 'play', path: 'M5 3l14 9-14 9V3z' },
  { name: 'download', path: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3' },
  { name: 'fire', path: 'M12 2s4 4 4 8a4 4 0 11-8 0c0-2 1-3 1-3s-3 2-3 6a6 6 0 1012 0c0-6-6-11-6-11z' },
  { name: 'award', path: 'M12 15a7 7 0 100-14 7 7 0 000 14zM8.21 13.89L7 23l5-3 5 3-1.21-9.12' },
  { name: 'percent', path: 'M19 5L5 19M6.5 6.5h.01M17.5 17.5h.01' },
  { name: 'mouse-pointer', path: 'M3 3l7 19 2-8 8-2z' },
  { name: 'globe', path: 'M12 22a10 10 0 100-20 10 10 0 000 20zM2 12h20M12 2a15 15 0 010 20 15 15 0 010-20z' },
  { name: 'gift', path: 'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z' },
];

function MetricIcon({ name, size = 12 }: { name?: string; size?: number }) {
  const icon = METRIC_ICONS.find((i) => i.name === name);
  if (!icon) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={icon.path} />
    </svg>
  );
}

/** P1-14: icon 选择面板 */
function IconPicker({ value, onChange }: { value?: string; onChange: (icon: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-6 w-6 items-center justify-center rounded border border-border-default text-foreground-secondary hover:bg-surface-hover"
        title="选择图标"
      >
        {value ? <MetricIcon name={value} /> : <span className="text-[10px] text-foreground-muted">○</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 grid w-56 grid-cols-6 gap-1 rounded-lg border border-border-default bg-surface-primary p-2 shadow-lg">
            {METRIC_ICONS.map((icon) => (
              <button
                key={icon.name}
                type="button"
                title={icon.name}
                onClick={() => {
                  onChange(icon.name);
                  setOpen(false);
                }}
                className={`flex h-7 w-7 items-center justify-center rounded transition hover:bg-surface-hover ${
                  value === icon.name ? 'bg-accent-primary/10 text-accent-primary' : 'text-foreground-secondary'
                }`}
              >
                <MetricIcon name={icon.name} size={14} />
              </button>
            ))}
            {/* 清除 icon */}
            <button
              type="button"
              title="清除"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="flex h-7 w-7 items-center justify-center rounded text-foreground-muted hover:bg-surface-hover"
            >
              ✕
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** 小信息点图标 */
function InfoDot() {
  return (
    <svg className="w-2.5 h-2.5 inline-block shrink-0 opacity-40" viewBox="0 0 12 12" fill="currentColor">
      <path d="M6 1a5 5 0 100 10A5 5 0 006 1zm0 2a.75.75 0 110 1.5.75.75 0 010-1.5zm-.75 2.5h1.5v4H5.25v-4z" />
    </svg>
  );
}

function DeliverableCard({
  deliverable,
  index,
  editing,
  partnerType,
  onChange,
  onRemove,
}: {
  deliverable: CollaborationDeliverable;
  index: number;
  editing: boolean;
  partnerType?: PartnerType;
  onChange: (d: CollaborationDeliverable) => void;
  onRemove: () => void;
}) {
  const { contentType, screenshots = [], metrics = [], audience, wordcloud = [] } = deliverable;

  const patch = (p: Partial<CollaborationDeliverable>) => onChange({ ...deliverable, ...p });
  const setScreenshots = (s: typeof screenshots) => patch({ screenshots: s });
  const setMetrics = (m: typeof metrics) => patch({ metrics: m });
  const setWords = (w: typeof wordcloud) => patch({ wordcloud: w });

  // 查找是否有链接型截图（src 是 URL）
  const firstLink = screenshots.find((s) => s.src && s.src.startsWith('http'))?.src;

  return (
    <div className="rounded-lg border border-border-subtle p-3">
      <div className="mb-2 flex items-center gap-2">
        {editing ? (
          <select
            value={contentType}
            onChange={(e) => patch({ contentType: e.target.value as CollaborationDeliverable['contentType'] })}
            className="rounded border border-border-default px-1.5 py-0.5 text-xs"
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        ) : (
          <span className="rounded bg-surface-hover px-1.5 py-0.5 font-medium text-foreground-primary">{contentType}</span>
        )}
        <span className="text-foreground-muted text-[10px]">#{index + 1}</span>
        {editing ? (
          <input
            type="date"
            value={deliverable.publishedAt ?? ''}
            onChange={(e) => patch({ publishedAt: e.target.value })}
            className="rounded border border-border-default bg-surface-primary px-1 py-0.5 text-[10px]"
          />
        ) : (
          deliverable.publishedAt && (
            <span className="text-foreground-muted text-[10px]">{deliverable.publishedAt}</span>
          )
        )}
        {editing ? (
          <select
            value={deliverable.platform ?? ''}
            onChange={(e) => patch({ platform: e.target.value })}
            className="rounded border border-border-default bg-surface-primary px-1 py-0.5 text-[10px]"
          >
            <option value="">平台</option>
            {PLATFORM_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        ) : (
          deliverable.platform && (
            <span className="text-foreground-muted text-[10px]">{deliverable.platform}</span>
          )
        )}
        {firstLink && !editing && (
          <a href={firstLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent-primary hover:underline">↗ 作品链接</a>
        )}
        {deliverable.cps?.linkUrl && !editing && (
          <a href={deliverable.cps.linkUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent-primary hover:underline truncate max-w-[200px]">↗ CPS 挂链</a>
        )}
        {editing && (
          <button onClick={onRemove} className="ml-auto text-red hover:underline text-[10px]">移除</button>
        )}
      </div>

      {/* 截图 */}
      <div className="mb-2">
        <div className="flex items-center gap-1 text-[10px] text-foreground-secondary mb-1">
          <span>作品截图</span>
          {editing && (
            <button onClick={() => setScreenshots([...screenshots, { src: '' }])} className="text-accent-primary hover:underline">+ 添加</button>
          )}
        </div>
        {screenshots.length === 0 ? (
          <span className="text-foreground-muted">—</span>
        ) : (
          <div className="space-y-1">
            {screenshots.map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                {s.src ? (
                  <img src={s.src} alt={s.caption ?? ''} className="h-12 w-12 shrink-0 rounded border border-border-subtle object-cover" />
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded bg-surface-hover flex items-center justify-center text-[8px] text-foreground-muted">N/A</div>
                )}
                {editing ? (
                  <div className="flex-1 min-w-0">
                    <ImageInput
                      value={s.src}
                      onChange={(url) => setScreenshots(screenshots.map((x, idx) => (idx === i ? { ...x, src: url } : x)))}
                    />
                    <input
                      value={s.caption ?? ''}
                      placeholder="说明"
                      onChange={(e) => setScreenshots(screenshots.map((x, idx) => (idx === i ? { ...x, caption: e.target.value } : x)))}
                      className="w-full mt-0.5 rounded border border-border-default bg-surface-primary px-1 py-0.5 text-xs"
                    />
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    {s.caption && (
                      <p className="text-xs text-foreground-secondary leading-tight line-clamp-2">{s.caption}</p>
                    )}
                    {s.src && (
                      <a href={s.src} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent-primary hover:underline break-all line-clamp-1">
                        {s.src}
                      </a>
                    )}
                  </div>
                )}
                {editing && (
                  <button onClick={() => setScreenshots(screenshots.filter((_, idx) => idx !== i))} className="text-red text-[10px] shrink-0">✕</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 效果数据（含 CPS 挂链汇总） */}
      <div className="mb-2">
        <div className="flex items-center gap-1 text-[10px] text-foreground-secondary mb-1">
          <span>效果数据</span>
          {editing && (
            <button onClick={() => setMetrics([...metrics, { label: '', value: '' }])} className="text-accent-primary hover:underline">+ 添加</button>
          )}
        </div>
        {metrics.length === 0 ? (
          <span className="text-foreground-muted">—</span>
        ) : (
          <>
            {/* 基础互动指标 */}
            {metrics.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1">
                {metrics.map((m, i) => editing ? (
                  <div key={i} className="flex items-center gap-1">
                    <IconPicker
                      value={m.icon}
                      onChange={(icon) => setMetrics(metrics.map((x, idx) => (idx === i ? { ...x, icon } : x)))}
                    />
                    <input
                      value={m.label}
                      placeholder="指标"
                      onChange={(e) => setMetrics(metrics.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
                      className="w-20 rounded border border-border-default bg-surface-primary px-1 py-0.5"
                    />
                    <input
                      value={m.value}
                      placeholder="数值"
                      onChange={(e) => setMetrics(metrics.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))}
                      className="w-24 rounded border border-border-default bg-surface-primary px-1 py-0.5"
                    />
                    <button onClick={() => setMetrics(metrics.filter((_, idx) => idx !== i))} className="text-red">✕</button>
                  </div>
                ) : (
                  <div key={i} className="rounded bg-surface-hover px-2 py-1.5" title={METRIC_HINTS[m.label] ?? ''}>
                    <div className="text-[10px] text-foreground-muted flex items-center gap-0.5">
                      {m.icon && <MetricIcon name={m.icon} size={10} />}
                      {METRIC_HINTS[m.label] && <InfoDot />}
                      {m.label}
                    </div>
                    <div className="text-xs font-medium text-foreground-primary tabular-nums">{m.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* CPS 挂链汇总指标：已迁移至浮窗顶部「CPS 实绩」只读聚合（cps-overview 端点）。
                Collaboration.deliverables[].cps 手填 JSON 不再渲染（伪造来源已切断）。 */}
          </>
        )}
      </div>

      {/* 每日效果数据 + CPS 每日明细 editing 模式下行内可编辑 */}
      {(() => {
        const daily = deliverable.daily ?? [];
        const cpsDaily = deliverable.cps?.daily ?? [];

        const setDaily = (d: typeof daily) => patch({ daily: d });
        const setCpsDaily = (c: typeof cpsDaily) =>
          patch({ cps: { ...(deliverable.cps ?? { clicks: '0', impressions: '0', ctr: '0%', orders: '0', cvr: '0%', gmv: '$0', commission: '$0', spend: '$0', roas: '0', epc: '$0' }), daily: c } });

        // 按日期 join
        const byDate = new Map<string, { post?: typeof daily[number]; cps?: typeof cpsDaily[number] }>();
        for (const d of daily) byDate.set(d.date, { post: d });
        for (const d of cpsDaily) {
          const e = byDate.get(d.date);
          if (e) e.cps = d; else byDate.set(d.date, { cps: d });
        }
        const merged = [...byDate.values()].sort((a, b) => {
          const da = a.post?.date ?? a.cps?.date ?? '';
          const db = b.post?.date ?? b.cps?.date ?? '';
          return da.localeCompare(db);
        });
        const hasCps = cpsDaily.length > 0;

        if (daily.length === 0 && cpsDaily.length === 0 && !editing) return null;

        /** 编辑模式：添加一天 post daily */
        function addPostDay() {
          const today = new Date().toISOString().slice(0, 10);
          setDaily([...daily, { date: today, impressions: '0', likes: '0', comments: '0', shares: '0', saves: '0' }]);
        }
        /** 编辑模式：添加一天 cps daily（确保 cps 对象存在且 daily 列表完整） */
        function addCpsDay() {
          const today = new Date().toISOString().slice(0, 10);
          const newRow = { date: today, clicks: '0', impressions: '0', ctr: '0%', orders: '0', cvr: '0%', gmv: '$0', commission: '$0', roas: '0', epc: '$0' };
          if (!deliverable.cps) {
            patch({ cps: { clicks: '0', impressions: '0', ctr: '0%', orders: '0', cvr: '0%', gmv: '$0', commission: '$0', spend: '$0', roas: '0', epc: '$0', daily: [newRow] } });
          } else {
            setCpsDaily([...(deliverable.cps.daily ?? []), newRow]);
          }
        }

        function updPost(ri: number, key: keyof typeof daily[number], val: string) {
          const date = merged[ri].post?.date ?? merged[ri].cps?.date ?? '';
          setDaily(daily.map((d) => (d.date === date ? { ...d, [key]: val } : d)));
        }
        function updCps(ri: number, key: keyof typeof cpsDaily[number], val: string) {
          const date = merged[ri].post?.date ?? merged[ri].cps?.date ?? '';
          setCpsDaily(cpsDaily.map((d) => (d.date === date ? { ...d, [key]: val } : d)));
        }
        function delDay(ri: number) {
          const date = merged[ri].post?.date ?? merged[ri].cps?.date ?? '';
          setDaily(daily.filter((d) => d.date !== date));
          if (cpsDaily.length) setCpsDaily(cpsDaily.filter((d) => d.date !== date));
        }

        const EditableCell = ({ editing: ed, value, onChange, className = '' }: { editing: boolean; value: string; onChange?: (v: string) => void; className?: string }) =>
          ed ? (
            <td className={`px-1 py-0.5 ${className}`}>
              <input
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                className="w-full min-w-[3rem] rounded border border-border-default bg-surface-primary px-1 py-0.5 text-[10px] tabular-nums"
              />
            </td>
          ) : (
            <td className={`px-1.5 py-0.5 text-right tabular-nums ${className}`}>{value || '—'}</td>
          );

        return (
          <div className="mb-2">
            <div className="flex items-center gap-2 text-[10px] text-foreground-secondary mb-1">
              <span>每日效果数据</span>
              <span className="text-foreground-muted">({merged.length} 天{hasCps ? ' · 含 CPS 挂链' : ''})</span>
              {editing && (
                <div className="ml-auto flex gap-2">
                  <button onClick={addPostDay} className="text-accent-primary hover:underline">+ 互动</button>
                  <button onClick={addCpsDay} className="text-accent-primary hover:underline">+ CPS</button>
                </div>
              )}
            </div>
            {merged.length === 0 ? (
              <span className="text-foreground-muted">—</span>
            ) : (
              <div className="max-h-40 overflow-auto rounded border border-border-subtle">
                <table className="w-full text-[10px] tabular-nums whitespace-nowrap">
                  <thead className="sticky top-0 bg-surface-hover text-foreground-muted">
                    <tr>
                      <th className="px-1.5 py-0.5 text-left font-medium">日期</th>
                      <th className="px-1.5 py-0.5 text-right font-medium">曝光</th>
                      <th className="px-1.5 py-0.5 text-right font-medium">点赞</th>
                      <th className="px-1.5 py-0.5 text-right font-medium">评论</th>
                      <th className="px-1.5 py-0.5 text-right font-medium">转发</th>
                      <th className="px-1.5 py-0.5 text-right font-medium">收藏</th>
                      {hasCps && <>
                        <th className="border-l border-border-subtle px-1.5 py-0.5 text-right font-medium text-accent-primary">点击</th>
                        <th className="px-1.5 py-0.5 text-right font-medium text-accent-primary">订单</th>
                        <th className="px-1.5 py-0.5 text-right font-medium text-accent-primary">GMV</th>
                        <th className="px-1.5 py-0.5 text-right font-medium text-accent-primary">佣金</th>
                      </>}
                      {editing && <th className="px-1 py-0.5"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {merged.map((row, ri) => (
                      <tr key={ri} className="border-t border-border-subtle text-foreground-secondary">
                        {editing ? (
                          <td className="px-1 py-0.5">
                            <input
                              value={row.post?.date ?? row.cps?.date ?? ''}
                              onChange={(e) => {
                                const oldDate = row.post?.date ?? row.cps?.date ?? '';
                                const newDate = e.target.value;
                                setDaily(daily.map((d) => (d.date === oldDate ? { ...d, date: newDate } : d)));
                                if (cpsDaily.length) setCpsDaily(cpsDaily.map((d) => (d.date === oldDate ? { ...d, date: newDate } : d)));
                              }}
                              className="w-24 rounded border border-border-default bg-surface-primary px-1 py-0.5 text-[10px]"
                            />
                          </td>
                        ) : (
                          <td className="whitespace-nowrap px-1.5 py-0.5">{row.post?.date ?? row.cps?.date}</td>
                        )}
                        <EditableCell editing={editing} value={row.post?.impressions ?? ''} onChange={(v) => updPost(ri, 'impressions', v)} />
                        <EditableCell editing={editing} value={row.post?.likes ?? ''} onChange={(v) => updPost(ri, 'likes', v)} />
                        <EditableCell editing={editing} value={row.post?.comments ?? ''} onChange={(v) => updPost(ri, 'comments', v)} />
                        <EditableCell editing={editing} value={row.post?.shares ?? ''} onChange={(v) => updPost(ri, 'shares', v)} />
                        <EditableCell editing={editing} value={row.post?.saves ?? ''} onChange={(v) => updPost(ri, 'saves', v)} />
                        {hasCps && <>
                          <EditableCell editing={editing} value={row.cps?.clicks ?? ''} onChange={(v) => updCps(ri, 'clicks', v)} className="border-l border-border-subtle" />
                          <EditableCell editing={editing} value={row.cps?.orders ?? ''} onChange={(v) => updCps(ri, 'orders', v)} />
                          <EditableCell editing={editing} value={row.cps?.gmv ?? ''} onChange={(v) => updCps(ri, 'gmv', v)} />
                          <EditableCell editing={editing} value={row.cps?.commission ?? ''} onChange={(v) => updCps(ri, 'commission', v)} />
                        </>}
                        {editing && (
                          <td className="px-1 py-0.5">
                            <button onClick={() => delDay(ri)} className="text-red text-[10px]">✕</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* 评论词云 */}
      {wordcloud.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center gap-1 text-[10px] text-foreground-secondary mb-1">
            <span>评论词云</span>
            {editing && (
              <button onClick={() => setWords([...wordcloud, { text: '', weight: 50, sentiment: 'neutral' }])} className="text-accent-primary hover:underline">+ 添加</button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {wordcloud.map((w, i) => editing ? (
              <div key={i} className="flex items-center gap-0.5">
                <input
                  value={w.text}
                  placeholder="词"
                  onChange={(e) => setWords(wordcloud.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)))}
                  className="w-16 rounded border border-border-default bg-surface-primary px-1 py-0.5"
                />
                <input
                  type="number"
                  value={w.weight}
                  onChange={(e) => setWords(wordcloud.map((x, idx) => (idx === i ? { ...x, weight: Number(e.target.value) } : x)))}
                  className="w-12 rounded border border-border-default bg-surface-primary px-1 py-0.5"
                />
                <select
                  value={w.sentiment}
                  onChange={(e) => setWords(wordcloud.map((x, idx) => (idx === i ? { ...x, sentiment: e.target.value as typeof w.sentiment } : x)))}
                  className="rounded border border-border-default bg-surface-primary px-1 py-0.5"
                >
                  <option value="pos">pos</option>
                  <option value="neg">neg</option>
                  <option value="neutral">neutral</option>
                </select>
                <button onClick={() => setWords(wordcloud.filter((_, idx) => idx !== i))} className="text-red">✕</button>
              </div>
            ) : (
              <span key={i} className={`rounded px-1.5 py-0.5 text-[10px] ${w.sentiment === 'pos' ? 'bg-green/10 text-green' : w.sentiment === 'neg' ? 'bg-red/10 text-red' : 'bg-surface-hover text-foreground-secondary'}`}>
                {w.text} ({w.weight})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 社群流量数据（followers/activeUsers 时间序列） */}
      {partnerType === 'community' && (() => {
        const daily = deliverable.communityData?.daily ?? [];
        if (daily.length === 0 && !editing) return null;
        const setCommunityDaily = (d: typeof daily) =>
          patch({ communityData: { daily: d } });
        return (
          <div className="mb-2">
            <div className="flex items-center gap-2 text-[10px] text-foreground-secondary mb-1">
              <span>社群增长数据</span>
              <span className="text-foreground-muted">({daily.length} 天)</span>
              {editing && (
                <button onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  setCommunityDaily([...daily, { date: today, followers: '0', activeUsers: '0' }]);
                }} className="ml-auto text-accent-primary hover:underline">+ 添加</button>
              )}
            </div>
            {daily.length === 0 ? (
              <span className="text-foreground-muted">—</span>
            ) : (
              <div className="max-h-32 overflow-auto rounded border border-border-subtle">
                <table className="w-full text-[10px] tabular-nums whitespace-nowrap">
                  <thead className="sticky top-0 bg-surface-hover text-foreground-muted">
                    <tr>
                      <th className="px-1.5 py-0.5 text-left font-medium">日期</th>
                      <th className="px-1.5 py-0.5 text-right font-medium">群成员数</th>
                      <th className="px-1.5 py-0.5 text-right font-medium">活跃用户</th>
                      {editing && <th className="px-1 py-0.5"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {daily.map((d, di) => (
                      <tr key={di} className="border-t border-border-subtle text-foreground-secondary">
                        {editing ? (
                          <>
                            <td className="px-1 py-0.5">
                              <input value={d.date} onChange={(e) => setCommunityDaily(daily.map((x, idx) => (idx === di ? { ...x, date: e.target.value } : x)))} className="w-24 rounded border border-border-default bg-surface-primary px-1 py-0.5 text-[10px]" />
                            </td>
                            <td className="px-1 py-0.5">
                              <input value={d.followers} onChange={(e) => setCommunityDaily(daily.map((x, idx) => (idx === di ? { ...x, followers: e.target.value } : x)))} className="w-full min-w-[4rem] rounded border border-border-default bg-surface-primary px-1 py-0.5 text-[10px] text-right" />
                            </td>
                            <td className="px-1 py-0.5">
                              <input value={d.activeUsers} onChange={(e) => setCommunityDaily(daily.map((x, idx) => (idx === di ? { ...x, activeUsers: e.target.value } : x)))} className="w-full min-w-[4rem] rounded border border-border-default bg-surface-primary px-1 py-0.5 text-[10px] text-right" />
                            </td>
                            <td className="px-1 py-0.5"><button onClick={() => setCommunityDaily(daily.filter((_, idx) => idx !== di))} className="text-red">✕</button></td>
                          </>
                        ) : (
                          <>
                            <td className="whitespace-nowrap px-1.5 py-0.5">{d.date}</td>
                            <td className="px-1.5 py-0.5 text-right">{d.followers}</td>
                            <td className="px-1.5 py-0.5 text-right">{d.activeUsers}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* 内容站流量数据（visits/uniqueVisitors/pageViews 时间序列） */}
      {partnerType === 'content_site' && (() => {
        const daily = deliverable.contentSiteData?.daily ?? [];
        if (daily.length === 0 && !editing) return null;
        const setContentDaily = (d: typeof daily) =>
          patch({ contentSiteData: { daily: d } });
        return (
          <div className="mb-2">
            <div className="flex items-center gap-2 text-[10px] text-foreground-secondary mb-1">
              <span>站点流量数据</span>
              <span className="text-foreground-muted">({daily.length} 天)</span>
              {editing && (
                <button onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  setContentDaily([...daily, { date: today, visits: '0', uniqueVisitors: '0', pageViews: '0' }]);
                }} className="ml-auto text-accent-primary hover:underline">+ 添加</button>
              )}
            </div>
            {daily.length === 0 ? (
              <span className="text-foreground-muted">—</span>
            ) : (
              <div className="max-h-32 overflow-auto rounded border border-border-subtle">
                <table className="w-full text-[10px] tabular-nums whitespace-nowrap">
                  <thead className="sticky top-0 bg-surface-hover text-foreground-muted">
                    <tr>
                      <th className="px-1.5 py-0.5 text-left font-medium">日期</th>
                      <th className="px-1.5 py-0.5 text-right font-medium">访问次数</th>
                      <th className="px-1.5 py-0.5 text-right font-medium">独立访客</th>
                      <th className="px-1.5 py-0.5 text-right font-medium">页面浏览</th>
                      {editing && <th className="px-1 py-0.5"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {daily.map((d, di) => (
                      <tr key={di} className="border-t border-border-subtle text-foreground-secondary">
                        {editing ? (
                          <>
                            <td className="px-1 py-0.5">
                              <input value={d.date} onChange={(e) => setContentDaily(daily.map((x, idx) => (idx === di ? { ...x, date: e.target.value } : x)))} className="w-24 rounded border border-border-default bg-surface-primary px-1 py-0.5 text-[10px]" />
                            </td>
                            <td className="px-1 py-0.5">
                              <input value={d.visits} onChange={(e) => setContentDaily(daily.map((x, idx) => (idx === di ? { ...x, visits: e.target.value } : x)))} className="w-full min-w-[4rem] rounded border border-border-default bg-surface-primary px-1 py-0.5 text-[10px] text-right" />
                            </td>
                            <td className="px-1 py-0.5">
                              <input value={d.uniqueVisitors} onChange={(e) => setContentDaily(daily.map((x, idx) => (idx === di ? { ...x, uniqueVisitors: e.target.value } : x)))} className="w-full min-w-[4rem] rounded border border-border-default bg-surface-primary px-1 py-0.5 text-[10px] text-right" />
                            </td>
                            <td className="px-1 py-0.5">
                              <input value={d.pageViews} onChange={(e) => setContentDaily(daily.map((x, idx) => (idx === di ? { ...x, pageViews: e.target.value } : x)))} className="w-full min-w-[4rem] rounded border border-border-default bg-surface-primary px-1 py-0.5 text-[10px] text-right" />
                            </td>
                            <td className="px-1 py-0.5"><button onClick={() => setContentDaily(daily.filter((_, idx) => idx !== di))} className="text-red">✕</button></td>
                          </>
                        ) : (
                          <>
                            <td className="whitespace-nowrap px-1.5 py-0.5">{d.date}</td>
                            <td className="px-1.5 py-0.5 text-right">{d.visits}</td>
                            <td className="px-1.5 py-0.5 text-right">{d.uniqueVisitors}</td>
                            <td className="px-1.5 py-0.5 text-right">{d.pageViews}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* 受众画像 */}
      {audience && (audience.topCities?.length || audience.genderSplit?.length || audience.ageRange?.length) && (
        <div>
          <div className="text-[10px] text-foreground-secondary mb-1">受众画像</div>
          <div className="grid grid-cols-3 gap-2">
            {audience.topCities?.length ? (
              <div className="rounded bg-surface-hover p-1.5">
                <div className="text-[9px] text-foreground-muted mb-0.5">城市</div>
                {audience.topCities.map((c, i) => (
                  <div key={i} className="text-[10px]"><span className="text-foreground-secondary">{c.label}</span> <span className="text-foreground-primary">{c.value}%</span></div>
                ))}
              </div>
            ) : null}
            {audience.genderSplit?.length ? (
              <div className="rounded bg-surface-hover p-1.5">
                <div className="text-[9px] text-foreground-muted mb-0.5">性别</div>
                {audience.genderSplit.map((g, i) => (
                  <div key={i} className="text-[10px]"><span className="text-foreground-secondary">{g.label}</span> <span className="text-foreground-primary">{g.value}%</span></div>
                ))}
              </div>
            ) : null}
            {audience.ageRange?.length ? (
              <div className="rounded bg-surface-hover p-1.5">
                <div className="text-[9px] text-foreground-muted mb-0.5">年龄</div>
                {audience.ageRange.map((a, i) => (
                  <div key={i} className="text-[10px]"><span className="text-foreground-secondary">{a.label}</span> <span className="text-foreground-primary">{a.value}%</span></div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================= 小组件 ============================= */

/** 指标 badge：label + value，dim 模式用淡色 */
function MetricBadge({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-0.5 whitespace-nowrap text-[10px] tabular-nums ${dim ? 'text-foreground-secondary' : 'font-medium text-foreground-primary'}`}>
      <span className="text-foreground-muted">{label}</span>
      <span>{value}</span>
    </span>
  );
}

/* ============================= 工具函数 ============================= */

/** 从所有 deliverables 的 metrics 中按 label 聚合（动态支持所有指标）。 */
function aggregateAllMetrics(deliverables?: CollaborationDeliverable[]): [string, string][] {
  if (!deliverables?.length) return [];

  const sum = new Map<string, number>();
  for (const del of deliverables) {
    for (const m of del.metrics ?? []) {
      const num = parseMetricValue(m.value);
      if (num === null) continue;
      sum.set(m.label, (sum.get(m.label) ?? 0) + num);
    }
  }

  const fmt = (v: number) => {
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
    return String(Math.round(v));
  };

  return [...sum.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => [label, fmt(value)]);
}

/** 解析 metric value 字符串为数字（支持 "1.2M" / "45K" / "12,345" / "1234"） */
function parseMetricValue(value: string): number | null {
  if (!value || value === '—') return null;
  const s = value.trim().replace(/,/g, '');
  if (s.endsWith('M') || s.endsWith('m')) return parseFloat(s) * 1_000_000;
  if (s.endsWith('K') || s.endsWith('k')) return parseFloat(s) * 1_000;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
