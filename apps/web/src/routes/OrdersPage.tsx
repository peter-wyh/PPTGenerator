/**
 * 订单明细页（/data/orders）——数据管理独立菜单。
 * 展示导入的订单（CampaignOrder）：campaign 筛选 + 分页 + 商品行展开。
 * 数据源：GET /campaigns/orders/list（admin 全局视角）。
 */
import { Fragment, useCallback, useEffect, useState } from 'react';
import { campaignsApi, type OrderRow, type OrdersPage } from '@/api/campaignsApi';

function fmtDate(v: string | null) {
  return v ? v.slice(0, 10) : '—';
}
function fmtMoney(v: string | number) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : '—';
}
function orderTotal(row: OrderRow) {
  return row.items.reduce((s, it) => s + parseFloat(it.lineTotal) * it.qty, 0);
}

export default function OrdersPage() {
  const [data, setData] = useState<OrdersPage | null>(null);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await campaignsApi.listOrders({
        campaignId: campaignId || undefined,
        page,
        pageSize,
      });
      setData(r);
      setError('');
    } catch {
      setError('加载订单失败');
    } finally {
      setLoading(false);
    }
  }, [campaignId, page]);

  useEffect(() => { load(); }, [load]);

  // campaign 下拉选项（admin list 全量）
  useEffect(() => {
    campaignsApi.list().then((r) => setCampaigns(
      (r as unknown as { id: string; name: string }[]).map((c) => ({ id: c.id, name: c.name })),
    )).catch(() => {});
  }, []);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-headings text-lg font-semibold text-foreground-primary">订单明细</h1>
          <p className="mt-0.5 text-xs text-foreground-secondary">
            已导入的订单（订单号 · 商品行 · 归因达人）— Top-Sales / 购物篮分析的数据底座
          </p>
        </div>
        <select
          value={campaignId}
          onChange={(e) => { setCampaignId(e.target.value); setPage(1); }}
          className="rounded border border-border-default bg-surface-primary px-2 py-1.5 text-xs text-foreground-primary min-w-[220px]"
        >
          <option value="">全部 Campaign</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {error && <p className="mb-3 text-xs text-red-500">{error}</p>}
      {loading ? (
        <div className="py-12 text-center text-sm text-foreground-secondary">加载中…</div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-foreground-secondary">
          暂无订单。前往 <span className="text-accent-primary">合作列表</span> 导入「订单明细 CSV」。
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border-default">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-default bg-surface-secondary text-left text-foreground-secondary">
                  <th className="px-3 py-2">订单号</th>
                  <th className="px-3 py-2">Campaign</th>
                  <th className="px-3 py-2">达人</th>
                  <th className="px-3 py-2">下单时间</th>
                  <th className="px-3 py-2">状态</th>
                  <th className="px-3 py-2 text-right">商品数</th>
                  <th className="px-3 py-2 text-right">订单金额</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {rows.map((row) => {
                  const isOpen = !!expanded[row.id];
                  return (
                    <Fragment key={row.id}>
                      <tr className="hover:bg-surface-hover/50">
                        <td className="px-3 py-2 font-mono text-[11px]">{row.orderId}</td>
                        <td className="px-3 py-2">{row.campaign?.name ?? '—'}</td>
                        <td className="px-3 py-2">
                          {row.campaignCreator?.creator?.name ?? <span className="text-foreground-muted">未归因</span>}
                        </td>
                        <td className="px-3 py-2">{fmtDate(row.orderDate)}</td>
                        <td className="px-3 py-2">{row.orderStatus ?? '—'}</td>
                        <td className="px-3 py-2 text-right">{row.items.length}</td>
                        <td className="px-3 py-2 text-right font-medium">{fmtMoney(orderTotal(row))}</td>
                        <td className="px-3 py-2 text-right">
                          {row.items.length > 0 && (
                            <button
                              onClick={() => setExpanded({ ...expanded, [row.id]: !isOpen })}
                              className="rounded px-1.5 py-0.5 text-[11px] text-accent-primary hover:bg-accent-primary/10"
                            >
                              {isOpen ? '收起' : '商品'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={8} className="bg-surface-secondary/50 px-3 py-2">
                            <table className="w-full text-[11px]">
                              <thead>
                                <tr className="text-left text-foreground-muted">
                                  <th className="py-1 pr-2">商品</th>
                                  <th className="py-1 pr-2">品类</th>
                                  <th className="py-1 pr-2">SKU</th>
                                  <th className="py-1 pr-2 text-right">QTY</th>
                                  <th className="py-1 pr-2 text-right">单价</th>
                                  <th className="py-1 text-right">小计</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border-subtle">
                                {row.items.map((it) => (
                                  <tr key={it.id}>
                                    <td className="py-1 pr-2">{it.productName}</td>
                                    <td className="py-1 pr-2">{it.category ?? '—'}</td>
                                    <td className="py-1 pr-2 font-mono">{it.sku ?? '—'}</td>
                                    <td className="py-1 pr-2 text-right">{it.qty}</td>
                                    <td className="py-1 pr-2 text-right">{fmtMoney(it.unitPrice)}</td>
                                    <td className="py-1 text-right">{fmtMoney(it.lineTotal)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-foreground-secondary">
            <span>共 {total} 单</span>
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
        </>
      )}
    </div>
  );
}
