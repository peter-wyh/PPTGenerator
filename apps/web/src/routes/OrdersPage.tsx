/**
 * 订单明细页（/data/orders）——数据管理独立菜单。
 * 全字段罗列：CampaignOrder 保留列并入主表（0909 瘦身后 18 列），商品行展开。
 * 数据源：GET /campaigns/orders/list（admin 全局视角）。
 */
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { campaignsApi, type OrderRow, type OrdersPage } from '@/api/campaignsApi';
import { fmtMoney } from '@/utils/money';
import { buildPreviewFromRows, downloadTemplate, type ImportKind, type PreviewItem } from '@/editor/dataImport';
import { parseFile } from '@/editor/datasource/parse';
import { toast } from '@/components/Toast';
import { ImportPreviewModal } from '@/editor/components/ImportPreviewModal';

function fmtDate(v: string | null) {
  return v ? v.slice(0, 10) : '—';
}
function fmtDateTime(v: string | null | undefined) {
  if (!v) return '—';
  return /^\d{4}-\d{2}-\d{2}T/.test(v) ? v.slice(0, 19).replace('T', ' ') : v;
}
function orderTotal(row: OrderRow) {
  return row.items.reduce((s, it) => s + parseFloat(it.lineTotal) * it.qty, 0);
}
/** Lead 单（平台 type=lead）金额恒 £1 占位——金额列显示占位标注，佣金才是真实收益。
 *  0909 type 列已删：按金额占位特征（saleAmount ≤ 1 且佣金 > 0）识别。 */
function isLead(row: OrderRow) {
  const amt = parseFloat(row.saleAmount ?? '0');
  const comm = parseFloat(row.commission ?? '0');
  return amt > 0 && amt <= 1 && comm > 0;
}
function cellText(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

// ─── Awin 全字段已并入主表（AWIN_FIELD_GROUPS/AwinDetailPanel 于全字段改造后移除） ──

export default function OrdersPage() {
  const [data, setData] = useState<OrdersPage | null>(null);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pageSize = 20;

  // ── 订单导入（自 CampaignCollabPage 迁入——数据在哪个页面看，就在哪个页面导入）──
  const ordersCsvRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);

  function onCsvOrders(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    parseFile(f)
      .then((sheets) => setPreview(buildPreviewFromRows('orders', sheets[0]?.rows ?? [])))
      .catch(() => toast.error('Failed to parse file'));
  }

  async function confirmOrdersImport(validItems: Record<string, unknown>[]) {
    setPreview(null);
    try {
      const r = await campaignsApi.importOrders(validItems);
      toast.success(`Orders import done: ${r.updated} updated, ${r.skipped} skipped`);
      load();
    } catch {
      toast.error('Orders import failed');
    }
  }

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
      setError('Failed to load orders');
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
            导入的订单流水（订单号 · 商品行 · 归因达人）——Top 销售 / 篮子分析的数据底座
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            onChange={(e) => { if (e.target.value) downloadTemplate(e.target.value as ImportKind); e.target.value = ''; }}
            className="rounded border border-border-default bg-surface-primary px-2 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover"
            defaultValue=""
          >
            <option value="" disabled>下载模板</option>
            <option value="orders">订单模板</option>
          </select>
          <button
            onClick={() => ordersCsvRef.current?.click()}
            className="rounded bg-accent-primary px-3 py-1.5 text-xs text-foreground-inverse hover:bg-accent-secondary"
          >
            导入订单 CSV
          </button>
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
      </div>

      <input ref={ordersCsvRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onCsvOrders} />

      {error && <p className="mb-3 text-xs text-red-500">{error}</p>}
      {loading ? (
        <div className="py-12 text-center text-sm text-foreground-secondary">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-foreground-secondary">
          暂无订单。请到「合作列表」或本页导入订单 CSV。
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border-default">
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-border-default bg-surface-secondary text-left text-foreground-secondary">
                  {/* 核心区（0917 表头中文化） */}
                  <th className="px-3 py-2">订单号</th>
                  <th className="px-3 py-2">Campaign</th>
                  <th className="px-3 py-2">媒体</th>
                  <th className="px-3 py-2">归因达人</th>
                  <th className="px-3 py-2">下单时间</th>
                  <th className="px-3 py-2">状态</th>
                  <th className="px-3 py-2">来源</th>
                  <th className="px-3 py-2 text-right">件数</th>
                  <th className="px-3 py-2 text-right">金额</th>
                  <th className="px-3 py-2 text-right">佣金</th>
                  {/* 转化归因区（0909 瘦身：仅留有消费方的列） */}
                  <th className="px-3 py-2 border-l border-border-subtle">点击Ref</th>
                  <th className="px-3 py-2">点击设备</th>
                  <th className="px-3 py-2">国家</th>
                  <th className="px-3 py-2">站点</th>
                  <th className="px-3 py-2">跟踪链接</th>
                  {/* 审核支付区 */}
                  <th className="px-3 py-2 border-l border-border-subtle">核销时间</th>
                  {/* 其他 */}
                  <th className="px-3 py-2 border-l border-border-subtle">上游交易号</th>
                  <th className="px-3 py-2">新客</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {rows.map((row) => {
                  const isOpen = !!expanded[row.id];
                  const lead = isLead(row);
                  return (
                    <Fragment key={row.id}>
                      <tr className="hover:bg-surface-hover/50">
                        <td className="px-3 py-2 font-mono text-[11px]">{row.orderId}</td>
                        <td className="px-3 py-2">{row.campaign?.name ?? '—'}</td>
                        <td className="px-3 py-2" title={row.publisher?.domain}>
                          {row.publisher ? `${row.publisher.name}` : <span className="text-foreground-muted">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          {row.campaignCreator?.creator?.name ?? <span className="text-foreground-muted">未归因</span>}
                        </td>
                        <td className="px-3 py-2">{fmtDate(row.orderDate)}</td>
                        <td className="px-3 py-2">{row.orderStatus ?? '—'}</td>
                        <td className="px-3 py-2">{cellText(row.source)}</td>
                        <td className="px-3 py-2 text-right">{row.items.length}</td>
                        <td className="px-3 py-2 text-right font-medium">
                          {lead ? (
                            <span title="Lead order amount is a platform placeholder; commission is the real payout">
                              {fmtMoney(row.saleAmount)}<span className="ml-0.5 text-[10px] text-orange-500">placeholder</span>
                            </span>
                          ) : (
                            fmtMoney(row.saleAmount ?? orderTotal(row))
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-accent-primary">
                          {fmtMoney(row.commission)}
                        </td>
                        {/* 转化归因 */}
                        <td className="px-3 py-2 border-l border-border-subtle font-mono text-[11px] max-w-[180px] truncate" title={cellText(row.clickRef)}>{cellText(row.clickRef)}</td>
                        <td className="px-3 py-2">{cellText(row.clickDevice)}</td>
                        <td className="px-3 py-2">{cellText(row.customerCountry)}</td>
                        <td className="px-3 py-2">{cellText(row.siteName)}</td>
                        <td className="px-3 py-2 font-mono text-[11px] max-w-[180px] truncate" title={cellText(row.publisherUrl)}>{cellText(row.publisherUrl)}</td>
                        {/* 审核支付 */}
                        <td className="px-3 py-2 border-l border-border-subtle">{fmtDateTime(row.validationDate)}</td>
                        {/* 其他 */}
                        <td className="px-3 py-2 border-l border-border-subtle font-mono text-[11px]">{cellText(row.externalTxnId)}</td>
                        <td className="px-3 py-2">{cellText(row.customerAcquisition)}</td>
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
                          <td colSpan={40} className="bg-surface-secondary/50 px-3 py-2">
                            <table className="w-full text-[11px]">
                              <thead>
                                <tr className="text-left text-foreground-muted">
                                  <th className="py-1 pr-2">商品</th>
                                  <th className="py-1 pr-2">类目</th>
                                  <th className="py-1 pr-2">SKU</th>
                                  <th className="py-1 pr-2 text-right">数量</th>
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
            <span>{total} 条订单</span>
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

      {/* 导入预览弹窗（订单明细） */}
      {preview && (
        <ImportPreviewModal
          kind="orders"
          items={preview}
          onConfirm={confirmOrdersImport}
          onCancel={() => setPreview(null)}
        />
      )}
    </div>
  );
}
