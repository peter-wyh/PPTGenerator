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

// ─── Awin 镜像字段面板（数据管理-订单明细：展示全部未列入主表的字段） ──────────
// label 按 Awin transactions 导出列语义命名；row 上不存在的 key 渲染 —。
const AWIN_FIELD_GROUPS: { title: string; fields: [keyof OrderRow, string][] }[] = [
  {
    title: '转化归因',
    fields: [
      ['clickRef', '点击引用'],
      ['clickThroughTime', '点击时间'],
      ['lapseTime', '转化时滞(秒)'],
      ['clickDevice', '点击设备'],
      ['transactionDevice', '交易设备'],
      ['customerCountry', '客户国家'],
      ['type', '交易类型'],
      ['siteName', '发布商站点'],
      ['campaignLabel', 'Campaign 标签'],
    ],
  },
  {
    title: '审核与支付',
    fields: [
      ['validationDate', '审核通过时间'],
      ['paidToPublisher', '已付发布商'],
      ['paymentStatus', '支付状态'],
      ['paymentId', '支付 ID'],
      ['transactionQueryId', '查询 ID'],
    ],
  },
  {
    title: '修改与风控',
    fields: [
      ['amended', '是否修改'],
      ['amendReason', '修改原因'],
      ['oldSaleAmount', '修改前金额'],
      ['oldCommission', '修改前佣金'],
      ['declineReason', '拒单原因'],
    ],
  },
  {
    title: '佣金与用券',
    fields: [
      ['transactionParts', '佣金构成'],
      ['commissionSharingPublisherId', '分成发布商 ID'],
      ['commissionSharingPublisher', '分成发布商'],
      ['commissionSharingSelectedRatePublisherId', '所选分成率发布商 ID'],
      ['voucherCodeUsed', '是否用券'],
      ['voucherCode', '券码'],
    ],
  },
  {
    title: '其他',
    fields: [
      ['awinId', 'Awin 交易 ID'],
      ['advertiserId', '广告主 ID'],
      ['saleAmount', '订单金额(原始)'],
      ['url', '落地页'],
      ['publisherUrl', '发布商跟踪 URL'],
      ['customParameters', '自定义参数'],
      ['products', '商品明细(原始)'],
      ['customerAcquisition', '新客标记'],
      ['differentCurrency', '币种差异'],
      ['clickRef2', '点击引用2'],
      ['clickRef3', '点击引用3'],
      ['clickRef4', '点击引用4'],
      ['clickRef5', '点击引用5'],
      ['clickRef6', '点击引用6'],
    ],
  },
];

/** 单个字段值：null/undefined/空串 → —；ISO 时间取前 19 位（本地显示去 Z）；其余原样。 */
function fmtAwinValue(row: OrderRow, key: keyof OrderRow): string {
  const v = row[key];
  if (v === null || v === undefined || v === '') return '—';
  const s = String(v);
  // ISO datetime（含 T）截到秒，避免长串毫秒+Z 噪音
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? s.slice(0, 19).replace('T', ' ') : s;
}

function AwinDetailPanel({ row }: { row: OrderRow }) {
  return (
    <div className="mt-3 space-y-3">
      <p className="text-[11px] font-medium text-foreground-secondary">Awin 明细（transactions 导出全字段）</p>
      {AWIN_FIELD_GROUPS.map((g) => (
        <div key={g.title}>
          <p className="mb-1 text-[11px] text-foreground-muted">{g.title}</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 md:grid-cols-3 lg:grid-cols-4">
            {g.fields.map(([key, label]) => (
              <div key={String(key)} className="flex gap-2 text-[11px]">
                <span className="shrink-0 text-foreground-muted">{label}</span>
                <span className="min-w-0 break-all font-mono text-foreground-primary">
                  {fmtAwinValue(row, key)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
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
                  <th className="px-3 py-2 text-right">佣金</th>
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
                        <td className="px-3 py-2 text-right font-medium text-accent-primary">
                          {row.commission != null ? fmtMoney(row.commission) : <span className="text-foreground-muted">—</span>}
                        </td>
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
                          <td colSpan={9} className="bg-surface-secondary/50 px-3 py-2">
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
                            <AwinDetailPanel row={row} />
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
