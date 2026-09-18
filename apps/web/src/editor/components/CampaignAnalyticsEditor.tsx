/**
 * Campaign 分析数据编辑器。
 * 0918 收敛：数字块（KPI/品类/产品/市场/促销/趋势/新老客/Insights）全部移除——
 * 生成链（ai-generate）已从订单中间层现算全部数字，analytics 数字字段不进 prompt。
 * 仅保留生成链白名单消费的两块手录：
 * - Media Placements（媒体方站内资源位截图——入口已收敛到广告位截图页，此处只读提示）
 * - Competitor Share of Voice（竞品声量——FT 提案 deck 竞品屏数据源）
 *
 * 数据存储在 Campaign.analytics JSON 字段，通过 GET/PUT /campaigns/:id/analytics API 读写。
 */
import { useEffect, useState, useCallback } from 'react';
import { campaignsApi } from '@/api/campaignsApi';
import type {
  CampaignAnalytics,
  CompetitorVoice,
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
          <p className="text-xs text-foreground-muted mt-0.5">手录补录项（数字指标由订单数据生成时自动计算）：竞品声量 · 资源位截图</p>
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

      {/* 0917 收敛：Media Placements 编辑入口移除——字段能力分叉（此处单图旧形态 vs 广告位截图页多图+曝光区间）
          且整份 PUT 全量覆盖有冲掉他处改动风险。统一到 数据管理→广告位截图（读-改-写，能力超集）。 */}
      <Section title="Media Placements" desc="媒体方站内资源位截图">
        <p className="text-[11px] text-foreground-muted leading-5">
          广告位截图请到 <b>数据管理 → 广告位截图</b> 维护（支持多图、曝光区间、平台字段）。
          {data.mediaPlacements?.length ? `当前 ${data.mediaPlacements.length} 条（只读，随生成链生效）。` : '当前无条目。'}
        </p>
      </Section>

      {/* Competitor Share of Voice — 竞品声量（0909 新增，FT 提案 deck 竞品屏数据源） */}
      <ListSection<CompetitorVoice>
        title="Competitor Share of Voice" desc="竞品声量对比——有数据渲染提案 deck 竞品屏，无数据省略"
        items={data.competitors ?? []}
        onChange={(items) => setData({ ...data, competitors: items })}
        newItem={() => ({ name: '', shareOfVoice: 0 })}
        renderRow={(item, onChange) => (
          <>
            <input className="flex-[2] min-w-0 border rounded px-2 py-1 text-xs" value={item.name}
              onChange={(e) => onChange({ ...item, name: e.target.value })} placeholder="竞品名（含自家品牌行，如 GlowLab）" />
            <input className="w-16 border rounded px-2 py-1 text-xs text-right" value={String(item.shareOfVoice ?? '')}
              onChange={(e) => onChange({ ...item, shareOfVoice: parseFloat(e.target.value) || 0 })} placeholder="32" />
            <span className="text-xs text-foreground-muted w-6">%</span>
            <input className="w-24 border rounded px-2 py-1 text-xs text-right" value={item.mentions ? String(item.mentions) : ''}
              onChange={(e) => onChange({ ...item, mentions: parseInt(e.target.value) || undefined })} placeholder="提及数" />
            <input className="w-20 border rounded px-2 py-1 text-xs text-right" value={item.trend ?? ''}
              onChange={(e) => onChange({ ...item, trend: e.target.value })} placeholder="+12%" />
            <input className="flex-1 min-w-0 border rounded px-2 py-1 text-xs" value={item.source ?? ''}
              onChange={(e) => onChange({ ...item, source: e.target.value })} placeholder="口径（TikTok mentions, Jul 2026）" />
          </>
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
