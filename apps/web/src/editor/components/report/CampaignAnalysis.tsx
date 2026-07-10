/**
 * CampaignAnalysis — Campaign 单达人维度分析图表（≈PRD CMP-B17）：radar / combo / funnel。
 */
import type { CampaignAnalysisData } from '@mediakit/shared';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CAMPAIGN_COLORS } from './shared';

export function CampaignAnalysis({ data }: { data: CampaignAnalysisData }) {
  const { variant = 'radar', title, subtitle, dimensions = [], series = [], funnelSteps = [], insight } = data;

  return (
    <div className="flex h-full w-full flex-col gap-2 rounded-xl border border-border-default bg-surface-primary p-3">
      {(title || subtitle) && (
        <div className="flex flex-none flex-col">
          {title && <div className="text-sm font-semibold text-foreground-primary">{title}</div>}
          {subtitle && <div className="text-[11px] text-foreground-secondary">{subtitle}</div>}
        </div>
      )}
      <div className="min-h-0 flex-1">
        {variant === 'radar' && <CampaignRadar dimensions={dimensions} />}
        {variant === 'combo' && <CampaignCombo series={series} />}
        {variant === 'funnel' && <CampaignFunnel steps={funnelSteps} />}
      </div>
      {insight && (
        <div className="flex-none rounded-lg bg-primary/5 p-2.5">
          <div className="mb-0.5 text-[11px] font-semibold text-primary">Insight</div>
          <div className="text-[11px] text-foreground-secondary">{insight}</div>
        </div>
      )}
    </div>
  );
}

function CampaignRadar({ dimensions }: { dimensions: CampaignAnalysisData['dimensions'] }) {
  if (!dimensions || dimensions.length === 0) {
    return <div className="flex h-full items-center justify-center text-xs text-foreground-muted">无维度数据</div>;
  }
  const data = dimensions.map((d) => ({ label: d.label, value: d.value, max: d.max ?? 100 }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="var(--color-border-default, #E5E7EB)" />
        <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-foreground-secondary, #6B7280)' }} />
        <PolarRadiusAxis angle={90} domain={[0, 'auto']} tick={{ fontSize: 9, fill: 'var(--color-foreground-muted, #9CA3AF)' }} />
        <Radar dataKey="value" stroke="#FF5C00" fill="#FF5C00" fillOpacity={0.35} />
        <Tooltip formatter={(v: number) => v} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function CampaignCombo({ series }: { series: CampaignAnalysisData['series'] }) {
  if (!series || series.length === 0) {
    return <div className="flex h-full items-center justify-center text-xs text-foreground-muted">无系列数据</div>;
  }
  const data = series.map((s) => ({ label: s.label, barValue: s.barValue, lineValue: s.lineValue }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle, #F3F4F6)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip />
        <Bar yAxisId="left" dataKey="barValue" radius={[4, 4, 0, 0]} fill="#FF5C00" barSize="40%" />
        <Line yAxisId="right" dataKey="lineValue" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function CampaignFunnel({ steps }: { steps: CampaignAnalysisData['funnelSteps'] }) {
  if (!steps || steps.length === 0) {
    return <div className="flex h-full items-center justify-center text-xs text-foreground-muted">无漏斗数据</div>;
  }
  const max = Math.max(...steps.map((s) => s.value), 1);
  return (
    <div className="flex h-full w-full flex-col justify-center gap-2">
      {steps.map((s, i) => {
        const pct = Math.round((s.value / max) * 100);
        const color = CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length];
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="w-16 flex-none text-right text-[11px] text-foreground-secondary">{s.label}</span>
            <div className="relative h-7 flex-1 overflow-hidden rounded bg-surface-hover">
              <div
                className="flex h-full items-center justify-end rounded px-2 text-[10px] font-medium text-white"
                style={{
                  width: `${Math.max(pct, 12)}%`,
                  background: `linear-gradient(90deg, ${color}, ${color}CC)`,
                }}
              >
                {s.value}
              </div>
            </div>
            <span className="w-10 flex-none text-right text-[10px] text-foreground-muted">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}
