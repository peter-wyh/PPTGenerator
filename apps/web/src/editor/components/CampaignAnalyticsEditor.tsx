/**
 * Campaign 分析数据编辑器。
 * 用于管理 DG 报告所需的 6 项分析数据：
 * - New Customer Acquisition
 * - AOV (客单价)
 * - Top-Selling Categories
 * - Top-Selling Products
 * - Top Markets (地域)
 * - Top Promotion Offers (促销活动)
 *
 * 数据存储在 Campaign.analytics JSON 字段，通过 GET/PUT /campaigns/:id/analytics API 读写。
 */
import { useEffect, useState, useCallback } from 'react';
import { campaignsApi } from '@/api/campaignsApi';
import type {
  CampaignAnalytics,
  CampaignTrendPoint,
  CampaignInsight,
  InsightKind,
  InsightSeverity,
  InsightSubject,
  CategoryPerformance,
  ProductPerformance,
  MarketPerformance,
  PromotionOffer,
} from '@mediakit/shared';

interface Props {
  campaignId: string;
  campaignName?: string;
}

/** 空白 analytics 初始值。 */
const EMPTY: CampaignAnalytics = {
  trend: [],
  weeklyTrend: [],
  insights: [],
};

export function CampaignAnalyticsEditor({ campaignId, campaignName }: Props) {
  const [data, setData] = useState<CampaignAnalytics>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await campaignsApi.getAnalytics(campaignId);
      setData((raw as unknown as CampaignAnalytics) ?? EMPTY);
      setError('');
    } catch {
      setError('加载分析数据失败');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    try {
      await campaignsApi.updateAnalytics(campaignId, data as unknown as Record<string, unknown>);
      setError('');
    } catch {
      setError('保存失败');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-8 text-center text-sm text-foreground-muted">加载中…</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm skin-fw-heading text-foreground">
            分析数据 · {campaignName ?? campaignId.slice(0, 8)}
          </h3>
          <p className="text-xs text-foreground-muted mt-0.5">Campaign Analytics — 品类 / 产品 / 地域 / 优惠码 / 新客 / 客单价</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="rounded px-3 py-1.5 text-xs skin-fw-body bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
        >
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* KPI 行：New Customers + AOV */}
      <Section title="KPI 补充" desc="DG 报告核心指标">
        <div className="grid grid-cols-2 skin-gap-md">
          <Field label="New Customer Acquisition" value={String(data.newCustomers ?? '')}
            onChange={(v) => setData({ ...data, newCustomers: parseInt(v) || 0 })} placeholder="1,604" />
          <Field label="AOV（客单价）" value={data.aov ?? ''}
            onChange={(v) => setData({ ...data, aov: v })} placeholder="$189" />
        </div>
      </Section>

      {/* Top Categories */}
      <ListSection<CategoryPerformance>
        title="Top-Selling Categories" desc="品类销售占比"
        items={data.topCategories ?? []}
        onChange={(items) => setData({ ...data, topCategories: items })}
        newItem={() => ({ name: '', share: 0 })}
        renderRow={(item, onChange) => (
          <>
            <input className="flex-1 min-w-0 border rounded px-2 py-1 text-xs" value={item.name}
              onChange={(e) => onChange({ ...item, name: e.target.value })} placeholder="Skincare" />
            <input className="w-20 border rounded px-2 py-1 text-xs text-right" value={String(item.share ?? '')}
              onChange={(e) => onChange({ ...item, share: parseFloat(e.target.value) || 0 })} placeholder="72" />
            <span className="text-xs text-foreground-muted w-6">%</span>
          </>
        )}
      />

      {/* Top Products */}
      <ListSection<ProductPerformance>
        title="Top-Selling Products" desc="热销产品排行"
        items={data.topProducts ?? []}
        onChange={(items) => setData({ ...data, topProducts: items })}
        newItem={() => ({ name: '', revenue: '' })}
        renderRow={(item, onChange) => (
          <>
            <input className="flex-[2] min-w-0 border rounded px-2 py-1 text-xs" value={item.name}
              onChange={(e) => onChange({ ...item, name: e.target.value })} placeholder="Sensitive Skin Serum 30ml" />
            <input className="w-32 border rounded px-2 py-1 text-xs text-right" value={item.revenue ?? ''}
              onChange={(e) => onChange({ ...item, revenue: e.target.value })} placeholder="$368,071" />
          </>
        )}
      />

      {/* Top Markets */}
      <ListSection<MarketPerformance>
        title="Top Markets" desc="地域销售维度"
        items={data.topMarkets ?? []}
        onChange={(items) => setData({ ...data, topMarkets: items })}
        newItem={() => ({ name: '', revenue: '', share: 0 })}
        renderRow={(item, onChange) => (
          <>
            <input className="flex-[2] min-w-0 border rounded px-2 py-1 text-xs" value={item.name}
              onChange={(e) => onChange({ ...item, name: e.target.value })} placeholder="United States" />
            <input className="w-28 border rounded px-2 py-1 text-xs text-right" value={item.revenue ?? ''}
              onChange={(e) => onChange({ ...item, revenue: e.target.value })} placeholder="$481,998" />
            <input className="w-16 border rounded px-2 py-1 text-xs text-right" value={String(item.share ?? '')}
              onChange={(e) => onChange({ ...item, share: parseFloat(e.target.value) || 0 })} placeholder="55" />
            <span className="text-xs text-foreground-muted w-6">%</span>
          </>
        )}
      />

      {/* Promotion Offers */}
      <ListSection<PromotionOffer>
        title="Top Promotion Offers" desc="促销活动 / 优惠码效果"
        items={data.promotionOffers ?? []}
        onChange={(items) => setData({ ...data, promotionOffers: items })}
        newItem={() => ({ name: '', type: 'Code', revenue: '', usageCount: 0 })}
        renderRow={(item, onChange) => (
          <>
            <input className="flex-[2] min-w-0 border rounded px-2 py-1 text-xs" value={item.name}
              onChange={(e) => onChange({ ...item, name: e.target.value })} placeholder="Creator Exclusive 15% OFF" />
            <input className="w-20 border rounded px-2 py-1 text-xs" value={item.type ?? ''}
              onChange={(e) => onChange({ ...item, type: e.target.value })} placeholder="Code" />
            <input className="w-28 border rounded px-2 py-1 text-xs text-right" value={item.revenue ?? ''}
              onChange={(e) => onChange({ ...item, revenue: e.target.value })} placeholder="$340,500" />
            <input className="w-20 border rounded px-2 py-1 text-xs text-right" value={String(item.usageCount ?? '')}
              onChange={(e) => onChange({ ...item, usageCount: parseInt(e.target.value) || 0 })} placeholder="1,802" />
          </>
        )}
      />

      {/* Performance Trend — DG 报告日维度趋势 */}
      <ListSection<CampaignTrendPoint>
        title="Performance Trend" desc="日维度收入 / 花费 / 订单趋势"
        items={data.trend ?? []}
        onChange={(items) => setData({ ...data, trend: items })}
        newItem={() => ({ date: '', revenue: 0, spend: 0, commission: 0, orders: 0, roas: 0 })}
        renderRow={(item, onChange) => (
          <>
            <input className="w-28 border rounded px-2 py-1 text-xs" value={item.date}
              onChange={(e) => onChange({ ...item, date: e.target.value })} placeholder="Oct 12" />
            <input className="w-24 border rounded px-2 py-1 text-xs text-right" type="number"
              value={item.revenue || ''} onChange={(e) => onChange({ ...item, revenue: parseFloat(e.target.value) || 0 })} placeholder="Revenue" />
            <input className="w-24 border rounded px-2 py-1 text-xs text-right" type="number"
              value={item.spend || ''} onChange={(e) => onChange({ ...item, spend: parseFloat(e.target.value) || 0 })} placeholder="Spend" />
            <input className="w-24 border rounded px-2 py-1 text-xs text-right" type="number"
              value={item.orders || ''} onChange={(e) => onChange({ ...item, orders: parseInt(e.target.value) || 0 })} placeholder="Orders" />
            <input className="w-24 border rounded px-2 py-1 text-xs text-right" type="number"
              value={item.commission || ''} onChange={(e) => onChange({ ...item, commission: parseFloat(e.target.value) || 0 })} placeholder="Commission" />
          </>
        )}
      />

      {/* Customer Split — 新老客分析 */}
      <Section title="New Customer Analysis" desc="新老客占比与环比变化">
        <div className="grid grid-cols-3 skin-gap-md">
          <Field label="New Customers" value={String(data.customerSplit?.newCustomers ?? data.newCustomers ?? '')}
            onChange={(v) => setData({ ...data, newCustomers: parseInt(v) || 0, customerSplit: { ...(data.customerSplit ?? { newCustomers: 0, returningCustomers: 0, newCustomerRate: '' }), newCustomers: parseInt(v) || 0 } })}
            placeholder="1,604" />
          <Field label="Returning Customers" value={String(data.customerSplit?.returningCustomers ?? '')}
            onChange={(v) => setData({ ...data, customerSplit: { ...(data.customerSplit ?? { newCustomers: data.newCustomers ?? 0, returningCustomers: 0, newCustomerRate: '' }), returningCustomers: parseInt(v) || 0 } })}
            placeholder="3,032" />
          <Field label="New Customer Rate" value={data.customerSplit?.newCustomerRate ?? ''}
            onChange={(v) => setData({ ...data, customerSplit: { ...(data.customerSplit ?? { newCustomers: data.newCustomers ?? 0, returningCustomers: 0, newCustomerRate: '' }), newCustomerRate: v } })}
            placeholder="34.6%" />
        </div>
      </Section>

      {/* Actionable Insights — DG 报告 5 列洞察卡片 */}
      <ListSection<CampaignInsight>
        title="Actionable Insights" desc="5 维度洞察（Top Performers / High Traffic Low CVR / Best Placement / Creative / Action）"
        items={data.insights ?? []}
        onChange={(items) => setData({ ...data, insights: items })}
        newItem={() => ({
          kind: 'scale-opportunity',
          severity: 'good',
          subjectType: 'creator',
          subjectName: '',
          metrics: [],
          rationale: '',
          action: '',
        })}
        renderRow={(item, onChange) => (
          <div className="flex flex-col skin-gap-xs w-full">
            <div className="flex skin-gap-xs">
              <select className="border rounded px-1 py-0.5 text-[11px] w-28"
                value={item.kind} onChange={(e) => onChange({ ...item, kind: e.target.value as InsightKind })}>
                <option value="scale-opportunity">Top Performer</option>
                <option value="high-traffic-low-cvr">High Traffic</option>
                <option value="best-placement">Best Placement</option>
                <option value="best-creator">Best Creator</option>
                <option value="roas-warning">Action Required</option>
              </select>
              <select className="border rounded px-1 py-0.5 text-[11px] w-20"
                value={item.severity} onChange={(e) => onChange({ ...item, severity: e.target.value as InsightSeverity })}>
                <option value="good">Good</option>
                <option value="warn">Warn</option>
                <option value="opportunity">Opportunity</option>
              </select>
              <select className="border rounded px-1 py-0.5 text-[11px] w-20"
                value={item.subjectType} onChange={(e) => onChange({ ...item, subjectType: e.target.value as InsightSubject })}>
                <option value="creator">Creator</option>
                <option value="placement">Placement</option>
                <option value="campaign">Campaign</option>
              </select>
              <input className="flex-1 min-w-0 border rounded px-1 py-0.5 text-[11px]" value={item.subjectName}
                onChange={(e) => onChange({ ...item, subjectName: e.target.value })} placeholder="Publisher / Placement name" />
            </div>
            <input className="border rounded px-1 py-0.5 text-[11px]" value={item.rationale}
              onChange={(e) => onChange({ ...item, rationale: e.target.value })} placeholder="Reason (e.g. ROAS 4.10)" />
            <input className="border rounded px-1 py-0.5 text-[11px]" value={item.action}
              onChange={(e) => onChange({ ...item, action: e.target.value })} placeholder="Action recommendation" />
          </div>
        )}
      />
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="border border-border-subtle rounded-lg p-4">
      <div className="flex items-baseline skin-gap-sm mb-3">
        <span className="text-xs skin-fw-heading text-foreground">{title}</span>
        <span className="text-[10px] text-foreground-muted">{desc}</span>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="block">
      <span className="text-[10px] text-foreground-muted mb-1 block">{label}</span>
      <input className="w-full border rounded px-2 py-1.5 text-xs" value={value}
        onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

interface ListSectionProps<T> {
  title: string;
  desc: string;
  items: T[];
  onChange: (items: T[]) => void;
  newItem: () => T;
  renderRow: (item: T, onChange: (updated: T) => void) => React.ReactNode;
}

function ListSection<T>({ title, desc, items, onChange, newItem, renderRow }: ListSectionProps<T>) {
  return (
    <Section title={title} desc={desc}>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center skin-gap-sm">
            {renderRow(item, (updated) => {
              const next = [...items];
              next[i] = updated;
              onChange(next);
            })}
            <button className="text-foreground-muted hover:text-red-500 text-xs px-1 shrink-0"
              onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button className="text-xs text-accent hover:underline mt-1"
          onClick={() => onChange([...items, newItem()])}>+ 添加</button>
      </div>
    </Section>
  );
}
