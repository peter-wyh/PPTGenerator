/**
 * TrackingLink 数据页（/data/links）——数据管理独立菜单。
 * 页签 1 链接统计：订单表 publisherUrl 聚合，每条唯一跟踪链接一行。
 * 页签 2 按日明细：publisherUrl × date，每日每链一行。
 * 导入入口：Click References CSV → LinkPerformance（流量侧数据，独立于本表）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { campaignsApi, type LinkRow, type LinkDailyRow } from '@/api/campaignsApi';
import { buildPreviewFromRows, downloadTemplate, type PreviewItem } from '@/editor/dataImport';
import { parseFile } from '@/editor/datasource/parse';
import { ImportPreviewModal } from '@/editor/components/ImportPreviewModal';
import { toast } from '@/components/Toast';

function fmtMoney(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? `${n < 0 ? '-' : ''}£${Math.abs(n).toFixed(2)}` : '—';
}
function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleString('zh-CN', { hour12: false });
}

const PUBLISHER_TYPE_LABEL: Record<string, string> = {
  creator: '达人', community: '社群', content_site: '内容站', media_site: '媒体站',
};

type Tab = 'summary' | 'daily';

export default function LinksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  /** 子路由驱动页签：/data/links（=summary）| /data/links/daily（菜单下级独立路由） */
  const location = useLocation();
  const navigate = useNavigate();
  const tab: Tab = location.pathname.endsWith('/daily') ? 'daily' : 'summary';
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [campaignId, setCampaignId] = useState(searchParams.get('campaignId') ?? '');
  /** 达人筛选（合作详情浮窗跳转携带）：空=不过滤 */
  const [creatorId, setCreatorId] = useState(searchParams.get('creatorId') ?? '');
  const [creatorName, setCreatorName] = useState('');

  // 链接统计 state
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const summaryPageSize = 20;

  // 按日明细 state
  const [dailyRows, setDailyRows] = useState<LinkDailyRow[]>([]);
  const [dailyPage, setDailyPage] = useState(1);
  const [dailyTotal, setDailyTotal] = useState(0);
  const [dailyLoading, setDailyLoading] = useState(false);
  const dailyPageSize = 50;

  // 导入
  const csvRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);

  // 加载链接统计
  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const r = await campaignsApi.listLinkPerformances({ campaignId: campaignId || undefined, creatorId: creatorId || undefined, page, pageSize: summaryPageSize });
      setRows(r.rows);
      setTotal(r.total);
      setError('');
    } catch { setError('加载 TrackingLink 数据失败'); }
    finally { setLoading(false); }
  }, [campaignId, creatorId, page]);

  // 加载按日明细
  const loadDaily = useCallback(async () => {
    setDailyLoading(true);
    try {
      const r = await campaignsApi.listLinkDailyStats({ campaignId: campaignId || undefined, creatorId: creatorId || undefined, page: dailyPage, pageSize: dailyPageSize });
      setDailyRows(r.rows);
      setDailyTotal(r.total);
    } catch { toast.error('加载按日明细失败'); }
    finally { setDailyLoading(false); }
  }, [campaignId, creatorId, dailyPage]);

  useEffect(() => { if (tab === 'summary') loadSummary(); }, [tab, loadSummary]);
  useEffect(() => { if (tab === 'daily') loadDaily(); }, [tab, loadDaily]);

  // 筛选变更重置分页
  function switchCampaign(id: string) {
    setCampaignId(id); setPage(1); setDailyPage(1);
  }
  function switchTab(t: Tab) {
    // 子路由切换（保留 query：campaignId/creatorId 筛选）
    navigate(t === 'daily' ? '/data/links/daily' : '/data/links' + location.search, { replace: false });
    setPage(1); setDailyPage(1);
  }

  useEffect(() => {
    campaignsApi.list().then((r) => setCampaigns(
      (r as unknown as { id: string; name: string }[]).map((c) => ({ id: c.id, name: c.name })),
    )).catch(() => {});
  }, []);

  // 达人名解析（跳转带 creatorId 时显示 chip）
  useEffect(() => {
    if (!creatorId) { setCreatorName(''); return; }
    campaignsApi.getCreator(creatorId).then((c) => setCreatorName(c.name)).catch(() => setCreatorName(''));
  }, [creatorId]);

  /** 清除达人筛选（同步清 URL 参数） */
  function clearCreatorFilter() {
    setCreatorId('');
    setPage(1); setDailyPage(1);
    const next = new URLSearchParams(searchParams);
    next.delete('creatorId');
    setSearchParams(next, { replace: true });
  }

  function onCsv(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    parseFile(f)
      .then((sheets) => setPreview(buildPreviewFromRows('linkPerformance', sheets[0]?.rows ?? [])))
      .catch(() => toast.error('文件解析失败'));
  }

  async function confirmImport(validItems: Record<string, unknown>[]) {
    setPreview(null);
    try {
      const r = await campaignsApi.importLinkPerformance(validItems);
      toast.success(`Click References 导入完成: 更新 ${r.upserted}, 跳过 ${r.skipped}`);
      if (tab === 'summary') loadSummary();
    } catch { toast.error('导入失败'); }
  }

  const totalPages = Math.max(1, Math.ceil(total / summaryPageSize));
  const dailyTotalPages = Math.max(1, Math.ceil(dailyTotal / dailyPageSize));
  const sumOrders = rows.reduce((s, r) => s + r.orders, 0);
  const sumGmv = rows.reduce((s, r) => s + r.gmv, 0);
  // Clicks 合计：全页无匹配才显示 —（部分有匹配则合计已知部分）
  const sumClicks = rows.every((r) => r.clicks == null) ? null : rows.reduce((s, r) => s + (r.clicks ?? 0), 0);
  const sumCommission = rows.reduce((s, r) => s + r.commission, 0);
  const dSumOrders = dailyRows.reduce((s, r) => s + r.orders, 0);
  const dSumGmv = dailyRows.reduce((s, r) => s + r.gmv, 0);
  const dSumCommission = dailyRows.reduce((s, r) => s + r.commission, 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-headings text-lg font-semibold text-foreground-primary">TrackingLink</h1>
          <p className="mt-0.5 text-xs text-foreground-secondary">
            跟踪链接 × 订单聚合——trackingUrl = 发布商跟踪URL，Commission = Σ 订单佣金
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            onChange={(e) => { if (e.target.value) downloadTemplate(e.target.value as 'linkPerformance'); e.target.value = ''; }}
            className="rounded border border-border-default bg-surface-primary px-2 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover"
            defaultValue=""
          >
            <option value="" disabled>下载模板</option>
            <option value="linkPerformance">Click References 模板</option>
          </select>
          <button
            onClick={() => csvRef.current?.click()}
            className="rounded bg-accent-primary px-3 py-1.5 text-xs text-foreground-inverse hover:bg-accent-secondary"
          >
            导入 Click References CSV
          </button>
          <select
            value={campaignId}
            onChange={(e) => switchCampaign(e.target.value)}
            className="rounded border border-border-default bg-surface-primary px-2 py-1.5 text-xs text-foreground-primary min-w-[220px]"
          >
            <option value="">全部 Campaign</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {creatorId && (
            <button
              onClick={clearCreatorFilter}
              className="flex items-center gap-1 rounded-full border border-accent-primary/40 bg-accent-primary/10 px-2.5 py-1 text-xs text-accent-primary hover:bg-accent-primary/20"
              title="按达人筛选 TrackingLink（来自合作详情跳转）——点击清除"
            >
              达人: {creatorName || creatorId.slice(0, 8)} ✕
            </button>
          )}
        </div>
      </div>

      <input ref={csvRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onCsv} />

      {/* 页签 */}
      <div className="mb-3 flex gap-1">
        <button
          onClick={() => switchTab('summary')}
          className={`rounded px-3 py-1 text-xs font-medium ${tab === 'summary'
            ? 'bg-accent-primary text-foreground-inverse'
            : 'bg-surface-secondary text-foreground-secondary hover:bg-surface-hover'}`}
        >链接统计</button>
        <button
          onClick={() => switchTab('daily')}
          className={`rounded px-3 py-1 text-xs font-medium ${tab === 'daily'
            ? 'bg-accent-primary text-foreground-inverse'
            : 'bg-surface-secondary text-foreground-secondary hover:bg-surface-hover'}`}
        >按日明细</button>
      </div>

      {/* ── 链接统计 ── */}
      {tab === 'summary' && (
        <>
          {error && <p className="mb-3 text-xs text-red-500">{error}</p>}
          {loading ? (
            <div className="py-12 text-center text-sm text-foreground-secondary">加载中…</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-foreground-secondary">暂无 TrackingLink 数据</div>
          ) : (
            <>
              <div className="overflow-auto rounded-lg border border-border-default">
                <table className="w-full text-xs">
                  <thead className="bg-surface-secondary text-foreground-secondary">
                    <tr>
                      <th className="sticky left-0 z-10 bg-surface-secondary px-2 py-2 text-left">Campaign</th>
                      <th className="px-2 py-2 text-left">Link</th>
                      <th className="px-2 py-2 text-left">媒体</th>
                      <th className="px-2 py-2 text-left">类型</th>
                      <th className="px-2 py-2 text-right">Clicks</th>
                      <th className="px-2 py-2 text-right">Orders</th>
                      <th className="px-2 py-2 text-right">GMV</th>
                      <th className="px-2 py-2 text-right">Commission</th>
                      <th className="px-2 py-2 text-left">首单</th>
                      <th className="px-2 py-2 text-left">末单</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {rows.map((r) => (
                      <tr key={r.id} className="bg-surface-primary hover:bg-surface-hover/50">
                        <td className="sticky left-0 z-10 whitespace-nowrap bg-surface-primary px-2 py-2">
                          <span className="font-medium">{r.campaignName || r.campaignId}</span>
                        </td>
                        <td className="px-2 py-2">
                          <span className="font-mono text-[10px] text-foreground-secondary max-w-[280px] block truncate" title={r.trackingUrl ?? undefined}>
                            {r.trackingUrl ?? '—'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2">{r.publisher?.name ?? r.publisher?.domain ?? '—'}</td>
                        <td className="whitespace-nowrap px-2 py-2">{r.publisher ? (PUBLISHER_TYPE_LABEL[r.publisher.type] ?? r.publisher.type) : '—'}</td>
                        <td className="px-2 py-2 text-right text-foreground-secondary" title={r.clicks == null ? '无 Click References 匹配' : undefined}>
                          {r.clicks == null ? '—' : r.clicks.toLocaleString()}
                        </td>
                        <td className="px-2 py-2 text-right">{r.orders.toLocaleString()}</td>
                        <td className="px-2 py-2 text-right">{fmtMoney(r.gmv)}</td>
                        <td className="px-2 py-2 text-right">{fmtMoney(r.commission)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{fmtDate(r.firstOrderAt)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{fmtDate(r.lastOrderAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-border-default bg-surface-secondary font-medium">
                    <tr>
                      <td className="sticky left-0 z-10 bg-surface-secondary px-2 py-2" colSpan={4}>本页合计（{rows.length} 条）</td>
                      <td className="px-2 py-2 text-right">{sumClicks == null ? '—' : sumClicks.toLocaleString()}</td>
                      <td className="px-2 py-2 text-right">{sumOrders.toLocaleString()}</td>
                      <td className="px-2 py-2 text-right">{fmtMoney(sumGmv)}</td>
                      <td className="px-2 py-2 text-right">{fmtMoney(sumCommission)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-foreground-secondary">
                <span>共 {total} 条 TrackingLink</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
                    className="rounded border border-border-default px-2 py-1 disabled:opacity-40 hover:bg-surface-hover">上一页</button>
                  <span>{page} / {totalPages}</span>
                  <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
                    className="rounded border border-border-default px-2 py-1 disabled:opacity-40 hover:bg-surface-hover">下一页</button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── 按日明细 ── */}
      {tab === 'daily' && (
        <>
          {dailyLoading ? (
            <div className="py-12 text-center text-sm text-foreground-secondary">加载中…</div>
          ) : dailyRows.length === 0 ? (
            <div className="py-12 text-center text-sm text-foreground-secondary">暂无按日明细</div>
          ) : (
            <>
              <div className="overflow-auto rounded-lg border border-border-default">
                <table className="w-full text-xs">
                  <thead className="bg-surface-secondary text-foreground-secondary">
                    <tr>
                      <th className="sticky left-0 z-10 bg-surface-secondary px-2 py-2 text-left">日期</th>
                      <th className="px-2 py-2 text-left">Campaign</th>
                      <th className="px-2 py-2 text-left">Link</th>
                      <th className="px-2 py-2 text-left">媒体</th>
                      <th className="px-2 py-2 text-right">Orders</th>
                      <th className="px-2 py-2 text-right">GMV</th>
                      <th className="px-2 py-2 text-right">Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {dailyRows.map((r) => (
                      <tr key={r.id} className="bg-surface-primary hover:bg-surface-hover/50">
                        <td className="sticky left-0 z-10 whitespace-nowrap bg-surface-primary px-2 py-2">
                          <span className="font-medium">{r.statDate}</span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2">{r.campaignName || r.campaignId}</td>
                        <td className="px-2 py-2">
                          <span className="font-mono text-[10px] text-foreground-secondary max-w-[260px] block truncate" title={r.trackingUrl}>
                            {r.trackingUrl}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2">{r.publisher?.name ?? r.publisher?.domain ?? '—'}</td>
                        <td className="px-2 py-2 text-right">{r.orders.toLocaleString()}</td>
                        <td className="px-2 py-2 text-right">{fmtMoney(r.gmv)}</td>
                        <td className="px-2 py-2 text-right">{fmtMoney(r.commission)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-border-default bg-surface-secondary font-medium">
                    <tr>
                      <td className="sticky left-0 z-10 bg-surface-secondary px-2 py-2" colSpan={3}>本页合计（{dailyRows.length} 条）</td>
                      <td className="px-2 py-2 text-right">{dSumOrders.toLocaleString()}</td>
                      <td className="px-2 py-2 text-right">{fmtMoney(dSumGmv)}</td>
                      <td className="px-2 py-2 text-right">{fmtMoney(dSumCommission)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-foreground-secondary">
                <span>共 {dailyTotal} 条明细</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setDailyPage(Math.max(1, dailyPage - 1))} disabled={dailyPage <= 1}
                    className="rounded border border-border-default px-2 py-1 disabled:opacity-40 hover:bg-surface-hover">上一页</button>
                  <span>{dailyPage} / {dailyTotalPages}</span>
                  <button onClick={() => setDailyPage(Math.min(dailyTotalPages, dailyPage + 1))} disabled={dailyPage >= dailyTotalPages}
                    className="rounded border border-border-default px-2 py-1 disabled:opacity-40 hover:bg-surface-hover">下一页</button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {preview && (
        <ImportPreviewModal
          kind="linkPerformance"
          items={preview}
          onConfirm={confirmImport}
          onCancel={() => setPreview(null)}
        />
      )}
    </div>
  );
}
