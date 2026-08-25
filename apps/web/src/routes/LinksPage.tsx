/**
 * 链接数据页（/data/links）——数据管理独立菜单。
 * trackingUrl 视角：LinkPerformance 全量罗列 + 媒体（Publisher）归属 + 导入入口。
 * 数据源：GET /campaigns/links/list；导入：POST /campaigns/import/link-performance。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { campaignsApi, type LinkRow } from '@/api/campaignsApi';
import { buildPreviewFromRows, downloadTemplate, type PreviewItem } from '@/editor/dataImport';
import { parseFile } from '@/editor/datasource/parse';
import { ImportPreviewModal } from '@/editor/components/ImportPreviewModal';
import { toast } from '@/components/Toast';

function fmtMoney(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? `${n < 0 ? '-' : ''}£${Math.abs(n).toFixed(2)}` : '—';
}
function pct(n: number, d: number) {
  if (!d) return '—';
  return `${((n / d) * 100).toFixed(2)}%`;
}

const PUBLISHER_TYPE_LABEL: Record<string, string> = {
  creator: '达人',
  community: '社群',
  content_site: '内容站',
  media_site: '媒体站',
};

export default function LinksPage() {
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pageSize = 20;

  // 导入
  const csvRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await campaignsApi.listLinkPerformances({
        campaignId: campaignId || undefined,
        page,
        pageSize,
      });
      setRows(r.rows);
      setTotal(r.total);
      setError('');
    } catch {
      setError('加载链接数据失败');
    } finally {
      setLoading(false);
    }
  }, [campaignId, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    campaignsApi.list().then((r) => setCampaigns(
      (r as unknown as { id: string; name: string }[]).map((c) => ({ id: c.id, name: c.name })),
    )).catch(() => {});
  }, []);

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
      toast.success(`链接数据导入完成:更新 ${r.upserted},跳过 ${r.skipped}`);
      load();
    } catch {
      toast.error('链接数据导入失败');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const sumClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const sumOrders = rows.reduce((s, r) => s + r.orders, 0);
  const sumCommission = rows.reduce((s, r) => s + r.commission, 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-headings text-lg font-semibold text-foreground-primary">链接数据</h1>
          <p className="mt-0.5 text-xs text-foreground-secondary">
            trackingUrl 跟踪链接 × 流量/成交（Click References 口径）— 媒体归因与 EPC/CVR 的数据底座
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            onChange={(e) => { if (e.target.value) downloadTemplate(e.target.value as 'linkPerformance'); e.target.value = ''; }}
            className="rounded border border-border-default bg-surface-primary px-2 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover"
            defaultValue=""
          >
            <option value="" disabled>下载模板</option>
            <option value="linkPerformance">链接数据模板</option>
          </select>
          <button
            onClick={() => csvRef.current?.click()}
            className="rounded bg-accent-primary px-3 py-1.5 text-xs text-foreground-inverse hover:bg-accent-secondary"
          >
            导入链接数据 CSV
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

      <input ref={csvRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onCsv} />

      {error && <p className="mb-3 text-xs text-red-500">{error}</p>}
      {loading ? (
        <div className="py-12 text-center text-sm text-foreground-secondary">加载中…</div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-foreground-secondary">
          暂无链接数据——点击右上「导入链接数据 CSV」从 Awin Click References 导入。
        </div>
      ) : (
        <>
          <div className="overflow-auto rounded-lg border border-border-default">
            <table className="w-full text-xs">
              <thead className="bg-surface-secondary text-foreground-secondary">
                <tr>
                  <th className="sticky left-0 z-10 bg-surface-secondary px-2 py-2 text-left">Campaign</th>
                  <th className="px-2 py-2 text-left">Tracking URL</th>
                  <th className="px-2 py-2 text-left">媒体</th>
                  <th className="px-2 py-2 text-left">类型</th>
                  <th className="px-2 py-2 text-right">Clicks</th>
                  <th className="px-2 py-2 text-right">Impressions</th>
                  <th className="px-2 py-2 text-right">Orders</th>
                  <th className="px-2 py-2 text-right">CVR</th>
                  <th className="px-2 py-2 text-right">GMV</th>
                  <th className="px-2 py-2 text-right">Commission</th>
                  <th className="px-2 py-2 text-right">EPC</th>
                  <th className="px-2 py-2 text-right">Spend</th>
                  <th className="px-2 py-2 text-right">日明细</th>
                  <th className="px-2 py-2 text-right">更新时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {rows.map((r) => (
                  <tr key={r.id} className="bg-surface-primary hover:bg-surface-hover/50">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-surface-primary px-2 py-2">{r.campaignName || r.campaignId}</td>
                    <td className="max-w-[280px] truncate px-2 py-2 font-mono text-[10px]" title={r.trackingUrl ?? undefined}>
                      {r.trackingUrl ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">{r.publisher?.name ?? r.publisher?.domain ?? '—'}</td>
                    <td className="whitespace-nowrap px-2 py-2">{r.publisher ? (PUBLISHER_TYPE_LABEL[r.publisher.type] ?? r.publisher.type) : '—'}</td>
                    <td className="px-2 py-2 text-right">{r.clicks.toLocaleString()}</td>
                    <td className="px-2 py-2 text-right">{r.impressions ? r.impressions.toLocaleString() : '—'}</td>
                    <td className="px-2 py-2 text-right">{r.orders.toLocaleString()}</td>
                    <td className="px-2 py-2 text-right text-foreground-secondary">{pct(r.orders, r.clicks)}</td>
                    <td className="px-2 py-2 text-right">{fmtMoney(r.gmv)}</td>
                    <td className="px-2 py-2 text-right">{fmtMoney(r.commission)}</td>
                    <td className="px-2 py-2 text-right text-foreground-secondary">{r.clicks ? fmtMoney(r.commission / r.clicks) : '—'}</td>
                    <td className="px-2 py-2 text-right">{r.spend ? fmtMoney(r.spend) : '—'}</td>
                    <td className="px-2 py-2 text-right text-foreground-secondary">{r.dailyDays || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">
                      {new Date(r.updatedAt).toLocaleString('zh-CN', { hour12: false })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border-default bg-surface-secondary font-medium">
                <tr>
                  <td className="sticky left-0 z-10 bg-surface-secondary px-2 py-2" colSpan={4}>本页合计（{rows.length} 条）</td>
                  <td className="px-2 py-2 text-right">{sumClicks.toLocaleString()}</td>
                  <td />
                  <td className="px-2 py-2 text-right">{sumOrders.toLocaleString()}</td>
                  <td className="px-2 py-2 text-right text-foreground-secondary">{pct(sumOrders, sumClicks)}</td>
                  <td />
                  <td className="px-2 py-2 text-right">{fmtMoney(sumCommission)}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-foreground-secondary">
            <span>共 {total} 条链接</span>
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

      {/* 导入预览弹窗（链接数据） */}
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
