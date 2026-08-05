/**
 * Campaign 组件二次编辑面板：
 * - publisher-table: 行编辑（publisher/clicks/conversions/revenue/status）
 * - campaign-summary: metrics 行编辑 + customerSplit
 * - revenue-timeline: 数据点编辑（date/revenue/spend/commission/orders）
 * - geo-distribution: items 编辑（code/name/value/display/share）
 * - timeline-compare: headers + rows（字符串二维表）
 * - product-performance: rows 编辑
 */
import { useEditorStore } from '../../store';
import type { EditorComponent } from '@mediakit/shared';
import type {
  PublisherTableData,
  CampaignSummaryData,
  RevenueTimelineData,
  GeoDistributionData,
  TimelineCompareData,
  ProductPerformanceData,
} from '@mediakit/shared';

function updateData<T>(compId: string, updater: (data: T) => void) {
  const state = useEditorStore.getState();
  const { pages, currentPageId } = state;
  if (!currentPageId) return;
  const page = pages.find((p) => p.id === currentPageId);
  if (!page) return;
  const target = page.components.find((c) => c.id === compId);
  if (!target) return;
  const data = { ...(target.data as unknown as T) };
  updater(data);
  state.updateComponent(compId, { data: data as unknown as EditorComponent['data'] });
}

const inputCls = 'w-full rounded border border-border-default px-2 py-1 text-xs';

/* ====================== Publisher Table ====================== */

export function PublisherTableFields({ comp }: { comp: EditorComponent }) {
  const data = comp.data as PublisherTableData;
  const rows = data.rows ?? [];
  const statusOpts: ('good' | 'warn' | 'bad')[] = ['good', 'warn', 'bad'];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground-secondary">合作方行（{rows.length}）</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="space-y-1 rounded-lg border border-border-default p-2">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-foreground-muted">#{i + 1}</span>
            <input
              className={inputCls}
              value={r.publisher}
              placeholder="Publisher"
              onChange={(e) => updateData<PublisherTableData>(comp.id, (d) => { d.rows![i] = { ...d.rows![i], publisher: e.target.value }; })}
            />
            <button onClick={() => updateData<PublisherTableData>(comp.id, (d) => { d.rows = d.rows!.filter((_, j) => j !== i); })}
              className="rounded px-1 text-xs text-red hover:bg-red/10">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <input className={inputCls} value={r.clicks ?? ''} placeholder="Clicks" onChange={(e) => updateData<PublisherTableData>(comp.id, (d) => { d.rows![i] = { ...d.rows![i], clicks: e.target.value }; })} />
            <input className={inputCls} value={r.conversions ?? ''} placeholder="Conv." onChange={(e) => updateData<PublisherTableData>(comp.id, (d) => { d.rows![i] = { ...d.rows![i], conversions: e.target.value }; })} />
            <input className={inputCls} value={r.revenue ?? ''} placeholder="Revenue" onChange={(e) => updateData<PublisherTableData>(comp.id, (d) => { d.rows![i] = { ...d.rows![i], revenue: e.target.value }; })} />
            <input className={inputCls} value={r.roas ?? ''} placeholder="ROAS" onChange={(e) => updateData<PublisherTableData>(comp.id, (d) => { d.rows![i] = { ...d.rows![i], roas: e.target.value }; })} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-foreground-muted">状态</span>
            {statusOpts.map((s) => (
              <button key={s} onClick={() => updateData<PublisherTableData>(comp.id, (d) => { d.rows![i] = { ...d.rows![i], status: s }; })}
                className={`rounded px-1.5 py-0.5 text-[10px] ${r.status === s ? 'bg-accent-primary/10 text-accent-primary' : 'text-foreground-muted hover:bg-surface-hover'}`}>{s}</button>
            ))}
          </div>
        </div>
      ))}
      <button onClick={() => updateData<PublisherTableData>(comp.id, (d) => { d.rows = [...(d.rows ?? []), { publisher: 'New', clicks: '0', conversions: '0', revenue: '0', status: 'good' } as typeof d.rows[number]]; })}
        className="w-full rounded-lg border border-dashed border-border-default px-3 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover">+ 添加行</button>
    </div>
  );
}

/* ====================== Campaign Summary ====================== */

export function CampaignSummaryFields({ comp }: { comp: EditorComponent }) {
  const data = comp.data as CampaignSummaryData;
  const metrics = data.metrics ?? [];

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <label className="text-[10px] text-foreground-muted">Campaign 名称</label>
        <input className={inputCls} value={data.campaignName ?? ''} onChange={(e) => updateData<CampaignSummaryData>(comp.id, (d) => { d.campaignName = e.target.value; })} />
        <label className="text-[10px] text-foreground-muted">周期</label>
        <input className={inputCls} value={data.period ?? ''} onChange={(e) => updateData<CampaignSummaryData>(comp.id, (d) => { d.period = e.target.value; })} />
      </div>
      <div className="text-xs font-semibold text-foreground-secondary">指标行（{metrics.length}）</div>
      {metrics.map((m, i) => (
        <div key={i} className="grid grid-cols-3 gap-1 rounded-lg border border-border-default p-1.5">
          <input className={inputCls} value={m.label} placeholder="标签" onChange={(e) => updateData<CampaignSummaryData>(comp.id, (d) => { d.metrics[i] = { ...d.metrics[i], label: e.target.value }; })} />
          <input className={inputCls} value={m.value} placeholder="数值" onChange={(e) => updateData<CampaignSummaryData>(comp.id, (d) => { d.metrics[i] = { ...d.metrics[i], value: e.target.value }; })} />
          <div className="flex gap-0.5">
            <input className={inputCls} value={m.compare ?? ''} placeholder="对比" onChange={(e) => updateData<CampaignSummaryData>(comp.id, (d) => { d.metrics[i] = { ...d.metrics[i], compare: e.target.value }; })} />
            <button onClick={() => updateData<CampaignSummaryData>(comp.id, (d) => { d.metrics = d.metrics.filter((_, j) => j !== i); })}
              className="rounded px-1 text-xs text-red hover:bg-red/10">✕</button>
          </div>
        </div>
      ))}
      <button onClick={() => updateData<CampaignSummaryData>(comp.id, (d) => { d.metrics = [...d.metrics, { label: '新指标', value: '0' }]; })}
        className="w-full rounded-lg border border-dashed border-border-default px-3 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover">+ 添加指标</button>
    </div>
  );
}

/* ====================== Revenue Timeline ====================== */

export function RevenueTimelineFields({ comp }: { comp: EditorComponent }) {
  const data = comp.data as RevenueTimelineData;
  const points = data.points ?? [];

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-foreground-secondary">数据点（{points.length}）</div>
      <div className="max-h-[300px] space-y-1 overflow-auto">
        {points.map((p, i) => (
          <div key={i} className="grid grid-cols-5 gap-0.5 rounded border border-border-subtle p-1">
            <input className="w-full rounded border border-border-subtle px-1 py-0.5 text-[10px]" value={p.date} placeholder="Date" onChange={(e) => updateData<RevenueTimelineData>(comp.id, (d) => { d.points[i] = { ...d.points[i], date: e.target.value }; })} />
            <input className="w-full rounded border border-border-subtle px-1 py-0.5 text-[10px]" value={p.revenue} placeholder="Rev" type="number" onChange={(e) => updateData<RevenueTimelineData>(comp.id, (d) => { d.points[i] = { ...d.points[i], revenue: Number(e.target.value) }; })} />
            <input className="w-full rounded border border-border-subtle px-1 py-0.5 text-[10px]" value={p.spend} placeholder="Spend" type="number" onChange={(e) => updateData<RevenueTimelineData>(comp.id, (d) => { d.points[i] = { ...d.points[i], spend: Number(e.target.value) }; })} />
            <input className="w-full rounded border border-border-subtle px-1 py-0.5 text-[10px]" value={p.orders} placeholder="Orders" type="number" onChange={(e) => updateData<RevenueTimelineData>(comp.id, (d) => { d.points[i] = { ...d.points[i], orders: Number(e.target.value) }; })} />
            <button onClick={() => updateData<RevenueTimelineData>(comp.id, (d) => { d.points = d.points.filter((_, j) => j !== i); })}
              className="text-[10px] text-red hover:text-red/70">✕</button>
          </div>
        ))}
      </div>
      <button onClick={() => updateData<RevenueTimelineData>(comp.id, (d) => { d.points = [...(d.points ?? []), { date: 'Day N', revenue: 0, spend: 0, commission: 0, orders: 0 }]; })}
        className="w-full rounded-lg border border-dashed border-border-default px-3 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover">+ 添加数据点</button>
    </div>
  );
}

/* ====================== Geo Distribution ====================== */

export function GeoDistributionFields({ comp }: { comp: EditorComponent }) {
  const data = comp.data as GeoDistributionData;
  const items = data.items ?? [];

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-foreground-secondary">地域行（{items.length}）</div>
      {items.map((it, i) => (
        <div key={i} className="space-y-1 rounded-lg border border-border-default p-1.5">
          <div className="flex gap-1">
            <input className={inputCls} value={it.name} placeholder="国家/地区" onChange={(e) => updateData<GeoDistributionData>(comp.id, (d) => { d.items[i] = { ...d.items[i], name: e.target.value }; })} />
            <input className="w-20 rounded border border-border-default px-2 py-1 text-xs" value={it.code} placeholder="代码" onChange={(e) => updateData<GeoDistributionData>(comp.id, (d) => { d.items[i] = { ...d.items[i], code: e.target.value }; })} />
            <button onClick={() => updateData<GeoDistributionData>(comp.id, (d) => { d.items = d.items.filter((_, j) => j !== i); })}
              className="rounded px-1 text-xs text-red hover:bg-red/10">✕</button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <input className={inputCls} value={it.value} placeholder="数值" type="number" onChange={(e) => updateData<GeoDistributionData>(comp.id, (d) => { d.items[i] = { ...d.items[i], value: Number(e.target.value) }; })} />
            <input className={inputCls} value={it.display} placeholder="显示值" onChange={(e) => updateData<GeoDistributionData>(comp.id, (d) => { d.items[i] = { ...d.items[i], display: e.target.value }; })} />
            <input className={inputCls} value={it.share} placeholder="占比" onChange={(e) => updateData<GeoDistributionData>(comp.id, (d) => { d.items[i] = { ...d.items[i], share: e.target.value }; })} />
          </div>
        </div>
      ))}
      <button onClick={() => updateData<GeoDistributionData>(comp.id, (d) => { d.items = [...(d.items ?? []), { code: 'XX', name: 'New Region', value: 0, display: '$0', share: '0%' }]; })}
        className="w-full rounded-lg border border-dashed border-border-default px-3 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover">+ 添加地域</button>
    </div>
  );
}

/* ====================== Timeline Compare ====================== */

export function TimelineCompareFields({ comp }: { comp: EditorComponent }) {
  const data = comp.data as TimelineCompareData;
  const headers = data.headers ?? [];
  const rows = data.rows ?? [];

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-foreground-secondary">对比表</div>
      {rows.map((row, ri) => (
        <div key={ri} className="flex items-center gap-0.5 rounded border border-border-subtle p-1">
          <span className="flex-none text-[10px] text-foreground-muted">#{ri + 1}</span>
          {row.map((cell, ci) => (
            <input key={ci} className="w-full min-w-0 rounded border border-border-subtle px-1 py-0.5 text-[10px]"
              value={cell} placeholder={headers[ci] ?? `列${ci + 1}`}
              onChange={(e) => updateData<TimelineCompareData>(comp.id, (d) => { d.rows[ri] = d.rows[ri].map((c, j) => j === ci ? e.target.value : c); })}
            />
          ))}
          <button onClick={() => updateData<TimelineCompareData>(comp.id, (d) => { d.rows = d.rows.filter((_, j) => j !== ri); })}
            className="flex-none rounded px-1 text-[10px] text-red hover:bg-red/10">✕</button>
        </div>
      ))}
      <button onClick={() => updateData<TimelineCompareData>(comp.id, (d) => { d.rows = [...(d.rows ?? []), headers.map(() => '')]; })}
        className="w-full rounded-lg border border-dashed border-border-default px-3 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover">+ 添加行</button>
    </div>
  );
}

/* ====================== Product Performance ====================== */

export function ProductPerformanceFields({ comp }: { comp: EditorComponent }) {
  const data = comp.data as ProductPerformanceData;
  const headers = data.headers ?? ['商品', '图片URL', '销量', '占比', '品类'];
  const rows = data.rows ?? [];

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-foreground-secondary">商品行（{rows.length}）</div>
      {rows.map((row, ri) => (
        <div key={ri} className="space-y-1 rounded-lg border border-border-default p-1.5">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-foreground-muted">#{ri + 1}</span>
            <input className={inputCls} value={row[0] ?? ''} placeholder="商品名" onChange={(e) => updateData<ProductPerformanceData>(comp.id, (d) => { d.rows![ri] = d.rows![ri].map((c, j) => j === 0 ? e.target.value : c); })} />
            <button onClick={() => updateData<ProductPerformanceData>(comp.id, (d) => { d.rows = d.rows!.filter((_, j) => j !== ri); })}
              className="rounded px-1 text-xs text-red hover:bg-red/10">✕</button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <input className={inputCls} value={row[2] ?? ''} placeholder="销量" onChange={(e) => updateData<ProductPerformanceData>(comp.id, (d) => { d.rows![ri] = d.rows![ri].map((c, j) => j === 2 ? e.target.value : c); })} />
            <input className={inputCls} value={row[3] ?? ''} placeholder="占比" onChange={(e) => updateData<ProductPerformanceData>(comp.id, (d) => { d.rows![ri] = d.rows![ri].map((c, j) => j === 3 ? e.target.value : c); })} />
            <input className={inputCls} value={row[4] ?? ''} placeholder="品类" onChange={(e) => updateData<ProductPerformanceData>(comp.id, (d) => { d.rows![ri] = d.rows![ri].map((c, j) => j === 4 ? e.target.value : c); })} />
          </div>
          <input className={inputCls} value={row[1] ?? ''} placeholder="图片URL" onChange={(e) => updateData<ProductPerformanceData>(comp.id, (d) => { d.rows![ri] = d.rows![ri].map((c, j) => j === 1 ? e.target.value : c); })} />
        </div>
      ))}
      <button onClick={() => updateData<ProductPerformanceData>(comp.id, (d) => { d.rows = [...(d.rows ?? []), headers.map(() => '')]; })}
        className="w-full rounded-lg border border-dashed border-border-default px-3 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover">+ 添加商品</button>
    </div>
  );
}
