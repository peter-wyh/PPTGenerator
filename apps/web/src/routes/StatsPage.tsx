/**
 * 数据统计页（/data/stats）——中间层统计表透出。
 * Tab1 订单日统计（OrderDailyStat）：campaign 聚合 + creator×date 明细切换。
 * Tab2 媒体日统计（PublisherDailyStat）：publisher × 日，成交+流量双口径。
 * 数据由 recompute 接口从真源（订单表 / LinkPerformance.daily）物化——页面只读。
 */
import { useCallback, useEffect, useState } from 'react';
import {
  campaignsApi,
  type OrderDailyRow,
  type PublisherDailyRow,
} from '@/api/campaignsApi';

function fmtMoney(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? `${n < 0 ? '-' : ''}£${Math.abs(n).toFixed(2)}` : '—';
}

export default function StatsPage() {
  const [tab, setTab] = useState<'order' | 'publisher'>('order');
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [creatorBreakdown, setCreatorBreakdown] = useState(false);
  const [orderRows, setOrderRows] = useState<OrderDailyRow[]>([]);
  const [pubRows, setPubRows] = useState<PublisherDailyRow[]>([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const [pubTotal, setPubTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pageSize = 50;

  useEffect(() => {
    campaignsApi.list().then((r) => setCampaigns(
      (r as unknown as { id: string; name: string }[]).map((c) => ({ id: c.id, name: c.name })),
    )).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      if (tab === 'order') {
        const r = await campaignsApi.listOrderDailyStats({ campaignId, creatorBreakdown, page, pageSize });
        setOrderRows(r.rows);
        setOrderTotal(r.total);
      } else {
        const r = await campaignsApi.listPublisherDailyStats({ campaignId, page, pageSize });
        setPubRows(r.rows);
        setPubTotal(r.total);
      }
      setError('');
    } catch {
      setError('加载统计数据失败');
    } finally {
      setLoading(false);
    }
  }, [tab, campaignId, creatorBreakdown, page]);

  useEffect(() => { load(); }, [load]);

  const total = tab === 'order' ? orderTotal : pubTotal;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function recompute(kind: 'order' | 'publisher') {
    if (!campaignId) return;
    try {
      const r = await campaignsApi.recomputeStats(campaignId, kind);
      window.alert(`重算完成：写入 ${r.rows} 行${r.dropped ? `，跳过 ${r.dropped} 条无媒体/无日期订单` : ''}`);
      load();
    } catch {
      window.alert('重算失败');
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-headings text-lg font-semibold text-foreground-primary">数据统计</h1>
          <p className="mt-0.5 text-xs text-foreground-secondary">
            中间层统计表透出——订单按日（OrderDailyStat）与媒体×日（PublisherDailyStat），从订单真源/TrackingLink 物化
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={campaignId}
            onChange={(e) => { setCampaignId(e.target.value); setPage(1); }}
            className="rounded border border-border-default bg-surface-primary px-2 py-1.5 text-xs text-foreground-primary min-w-[220px]"
          >
            <option value="">选择 Campaign…</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={() => recompute(tab === 'order' ? 'order' : 'publisher')}
            disabled={!campaignId}
            className="rounded border border-border-default px-3 py-1.5 text-xs text-foreground-primary hover:bg-surface-hover disabled:opacity-40"
          >
            重算{tab === 'order' ? '订单日统计' : '媒体日统计'}
          </button>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-4 border-b border-border-default">
        <button
          onClick={() => { setTab('order'); setPage(1); }}
          className={`px-3 py-2 text-sm ${tab === 'order' ? 'border-b-2 border-accent-primary font-medium text-foreground-primary' : 'text-foreground-secondary hover:text-foreground-primary'}`}
        >订单按日</button>
        <button
          onClick={() => { setTab('publisher'); setPage(1); }}
          className={`px-3 py-2 text-sm ${tab === 'publisher' ? 'border-b-2 border-accent-primary font-medium text-foreground-primary' : 'text-foreground-secondary hover:text-foreground-primary'}`}
        >媒体×日</button>
        {tab === 'order' && (
          <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-foreground-secondary">
            <input
              type="checkbox"
              checked={creatorBreakdown}
              onChange={(e) => { setCreatorBreakdown(e.target.checked); setPage(1); }}
            />
            按达人拆分行（creator × date）
          </label>
        )}
      </div>

      {!campaignId ? (
        <div className="py-12 text-center text-sm text-foreground-secondary">请先选择 Campaign</div>
      ) : loading ? (
        <div className="py-12 text-center text-sm text-foreground-secondary">加载中…</div>
      ) : error ? (
        <p className="mb-3 text-xs text-red-500">{error}</p>
      ) : tab === 'order' ? (
        orderRows.length === 0 ? (
          <div className="py-12 text-center text-sm text-foreground-secondary">
            无订单日统计——点右上「重算订单日统计」从订单表物化。
          </div>
        ) : (
          <div className="overflow-auto rounded-lg border border-border-default">
            <table className="w-full text-xs">
              <thead className="bg-surface-secondary text-foreground-secondary">
                <tr>
                  {creatorBreakdown && <th className="px-2 py-2 text-left">达人</th>}
                  <th className="px-2 py-2 text-left">日期</th>
                  <th className="px-2 py-2 text-right">订单</th>
                  <th className="px-2 py-2 text-right">Approved</th>
                  <th className="px-2 py-2 text-right">Pending</th>
                  <th className="px-2 py-2 text-right">Other</th>
                  <th className="px-2 py-2 text-right">Commission</th>
                  <th className="px-2 py-2 text-right">新客单</th>
                  <th className="px-2 py-2 text-left">Top 国家</th>
                  <th className="px-2 py-2 text-left">Top 设备</th>
                  <th className="px-2 py-2 text-right">重算时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {orderRows.map((r) => (
                  <tr key={`${r.campaignCreatorId}-${r.statDate}`} className="bg-surface-primary hover:bg-surface-hover/50">
                    {creatorBreakdown && <td className="whitespace-nowrap px-2 py-2">{r.creatorName ?? r.campaignCreatorId}</td>}
                    <td className="whitespace-nowrap px-2 py-2">{r.statDate}</td>
                    <td className="px-2 py-2 text-right">{r.orders}</td>
                    <td className="px-2 py-2 text-right">{r.approvedOrders}</td>
                    <td className="px-2 py-2 text-right">{r.pendingOrders}</td>
                    <td className="px-2 py-2 text-right text-foreground-secondary">{r.otherOrders}</td>
                    <td className="px-2 py-2 text-right">{fmtMoney(r.commission)}</td>
                    <td className="px-2 py-2 text-right">{r.hasNewCustomerTag ? r.newCustomerOrders : 'N/A'}</td>
                    <td className="max-w-[180px] truncate px-2 py-2 text-foreground-secondary" title={(r.topCountries ?? []).map((c) => `${c.country}(${c.orders})`).join('、')}>
                      {(r.topCountries ?? []).slice(0, 3).map((c) => `${c.country}(${c.orders})`).join('、') || '—'}
                    </td>
                    <td className="max-w-[140px] truncate px-2 py-2 text-foreground-secondary" title={(r.topDevices ?? []).map((d) => `${d.device}(${d.orders})`).join('、')}>
                      {(r.topDevices ?? []).slice(0, 2).map((d) => `${d.device}(${d.orders})`).join('、') || '—'}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">
                      {new Date(r.recomputedAt).toLocaleString('zh-CN', { hour12: false })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : pubRows.length === 0 ? (
        <div className="py-12 text-center text-sm text-foreground-secondary">
          无媒体日统计——点右上「重算媒体日统计」从订单表+TrackingLink 物化。
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-border-default">
          <table className="w-full text-xs">
            <thead className="bg-surface-secondary text-foreground-secondary">
              <tr>
                <th className="px-2 py-2 text-left">日期</th>
                <th className="px-2 py-2 text-left">媒体</th>
                <th className="px-2 py-2 text-right">Clicks</th>
                <th className="px-2 py-2 text-right">Impressions</th>
                <th className="px-2 py-2 text-right">Orders</th>
                <th className="px-2 py-2 text-right">CVR</th>
                <th className="px-2 py-2 text-right">GMV</th>
                <th className="px-2 py-2 text-right">Commission</th>
                <th className="px-2 py-2 text-right">重算时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {pubRows.map((r) => (
                <tr key={`${r.publisherId}-${r.statDate}`} className="bg-surface-primary hover:bg-surface-hover/50">
                  <td className="whitespace-nowrap px-2 py-2">{r.statDate}</td>
                  <td className="whitespace-nowrap px-2 py-2">{r.publisher?.name ?? r.publisherId}</td>
                  <td className="px-2 py-2 text-right">{r.clicks.toLocaleString()}</td>
                  <td className="px-2 py-2 text-right">{r.impressions ? r.impressions.toLocaleString() : '—'}</td>
                  <td className="px-2 py-2 text-right">{r.orders}</td>
                  <td className="px-2 py-2 text-right text-foreground-secondary">{r.clicks ? `${((r.orders / r.clicks) * 100).toFixed(2)}%` : '—'}</td>
                  <td className="px-2 py-2 text-right">{fmtMoney(r.gmv)}</td>
                  <td className="px-2 py-2 text-right">{fmtMoney(r.commission)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">
                    {new Date(r.recomputedAt).toLocaleString('zh-CN', { hour12: false })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {campaignId && total > 0 && (
        <div className="mt-3 flex items-center justify-between text-xs text-foreground-secondary">
          <span>共 {total} 行</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded border border-border-default px-2 py-1 disabled:opacity-40 hover:bg-surface-hover"
            >上一页</button>
            <span>{page} / {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="rounded border border-border-default px-2 py-1 disabled:opacity-40 hover:bg-surface-hover"
            >下一页</button>
          </div>
        </div>
      )}
    </div>
  );
}
