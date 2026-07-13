import { useEffect, useState } from 'react';
import type {
  Campaign,
  CreatorCampaignPerformance,
  PlacementTypeSummary,
} from '@mediakit/shared';
import { listCampaigns } from '@/api/campaigns';
import { listCreators, type Creator } from '@/api/creators';
import { listCreatorPerformance, listPlacementTypeSummary } from '@/api/creatorPerformance';

/** Mock data preview page: overview of upstream API data (campaign / creators / creator performance). */
export function MockData() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loadingCamps, setLoadingCamps] = useState(true);
  const [loadingCreators, setLoadingCreators] = useState(true);

  useEffect(() => {
    listCampaigns()
      .then(setCampaigns)
      .finally(() => setLoadingCamps(false));
    listCreators()
      .then(setCreators)
      .finally(() => setLoadingCreators(false));
  }, []);

  /** Returns a creator's channel-KPI metric value (by label, e.g. 'Avg Reach'). */
  const metric = (c: Creator, label: string) =>
    c.metrics.find((m) => m.label === label)?.value ?? '—';

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-headings text-xl font-semibold text-foreground-primary">Mock Data</h1>
      <p className="mt-1 text-sm text-foreground-secondary">
        Mock data preview for upstream APIs (campaign / creators / creator performance). In production, connects to the ad platform and creator database.
      </p>

      {/* Campaign Data */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          Campaigns · {campaigns.length}
        </h2>
        <DataTable
          loading={loadingCamps}
          headers={['Campaign', 'Advertiser', 'Business Line', 'Platform', 'Period', 'Budget', 'Status', 'Owner']}
          rows={campaigns.map((c) => [
            c.name,
            c.advertiser,
            c.businessLine,
            c.platform,
            `${c.startDate} ~ ${c.endDate}`,
            c.budget,
            c.status ?? '—',
            c.owner ?? '—',
          ])}
        />
      </section>

      {/* Creator Data */}
      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          Creators · {creators.length}
        </h2>
        <DataTable
          loading={loadingCreators}
          headers={['Creator', 'Handle', 'Platform', 'Tier', 'Followers', 'Engagement', 'Category', 'Region', 'Avg Reach', 'Impressions', 'Follower Growth', 'CPM']}
          rows={creators.map((c) => [
            c.name,
            c.handle,
            c.platform,
            c.tier,
            c.followers,
            c.engagement,
            c.category,
            c.region,
            metric(c, 'Avg Reach'),
            metric(c, 'Impressions'),
            metric(c, 'Follower Growth'),
            metric(c, 'CPM'),
          ])}
        />
      </section>

      {/* Creator Performance (by Campaign): post performance + CPS */}
      <CreatorPerformanceSection campaignIds={campaigns.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}

/** Creator performance section: select Campaign → show post performance + CPS data for creators in that campaign. */
function CreatorPerformanceSection({
  campaignIds,
}: {
  campaignIds: { id: string; name: string }[];
}) {
  const [selectedId, setSelectedId] = useState('');
  const [perf, setPerf] = useState<CreatorCampaignPerformance[]>([]);
  const [summary, setSummary] = useState<PlacementTypeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  /** Expanded creator ids (drill-down). Multi-expand; reset on campaign change. */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (creatorId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(creatorId)) next.delete(creatorId);
      else next.add(creatorId);
      return next;
    });

  // Select first campaign by default once available.
  useEffect(() => {
    if (!selectedId && campaignIds.length > 0) setSelectedId(campaignIds[0].id);
  }, [campaignIds, selectedId]);

  // Fetch performance + placement summary on campaign switch.
  useEffect(() => {
    // Switching campaign collapses all expanded creators — ids differ per campaign.
    setExpanded(new Set());
    if (!selectedId) {
      setPerf([]);
      setSummary([]);
      return;
    }
    let alive = true;
    setLoading(true);
    Promise.all([
      listCreatorPerformance(selectedId),
      listPlacementTypeSummary(selectedId),
    ])
      .then(([list, sum]) => {
        if (!alive) return;
        setPerf(list);
        setSummary(sum);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [selectedId]);

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          Creator Performance (Posts + Placements + CPS) · {perf.length}
        </h2>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={campaignIds.length === 0}
          className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs"
        >
          {campaignIds.length === 0 && <option value="">No campaigns</option>}
          {campaignIds.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">
          Loading…
        </p>
      )}
      {!loading && perf.length === 0 && (
        <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">
          No creator performance data for this campaign
        </p>
      )}

      {!loading && summary.length > 0 && (
        <div className="mb-4">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
            Placement Type Summary (campaign level)
          </div>
          <PlacementSummaryTable summary={summary} />
        </div>
      )}

      {!loading && perf.length > 0 && (
        <div className="space-y-2">
          {perf.map((p) => (
            <PerfCard
              key={p.creatorId}
              perf={p}
              expanded={expanded.has(p.creatorId)}
              onToggle={() => toggleExpanded(p.creatorId)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** Placement type summary table: Placement Type × Revenue/Share/ROAS/Clicks/CTR/Conv/CVR/EPC. */
function PlacementSummaryTable({ summary }: { summary: PlacementTypeSummary[] }) {
  return (
    <div className="overflow-auto rounded-lg border border-border-default">
      <table className="w-full min-w-[820px] border-collapse text-xs">
        <thead>
          <tr className="bg-surface-hover text-left text-foreground-muted">
            <th className="px-3 py-2 font-medium">Placement Type</th>
            <th className="px-3 py-2 text-right font-medium">Revenue</th>
            <th className="px-3 py-2 text-right font-medium">Share</th>
            <th className="px-3 py-2 text-right font-medium">ROAS</th>
            <th className="px-3 py-2 text-right font-medium">Clicks</th>
            <th className="px-3 py-2 text-right font-medium">CTR</th>
            <th className="px-3 py-2 text-right font-medium">Conversions</th>
            <th className="px-3 py-2 text-right font-medium">CVR</th>
            <th className="px-3 py-2 text-right font-medium">EPC</th>
          </tr>
        </thead>
        <tbody>
          {summary.map((s) => (
            <tr key={s.type} className="border-t border-border-subtle">
              <td className="px-3 py-1.5 font-medium text-foreground-primary">{s.type}</td>
              <td className="whitespace-nowrap px-3 py-1.5 text-right font-data text-foreground-primary">
                {s.revenue}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 text-right font-data text-foreground-secondary">
                {s.revenueShare}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 text-right font-data text-accent-primary">
                {s.roas}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 text-right font-data text-foreground-secondary">
                {s.clicks}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 text-right font-data text-foreground-secondary">
                {s.ctr}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 text-right font-data text-foreground-secondary">
                {s.conversions}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 text-right font-data text-foreground-secondary">
                {s.cvr}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 text-right font-data text-foreground-secondary">
                {s.epc}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Compact label+value metric used in the collapsed creator summary row. */
function RowMetric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <span>
      <span className="text-foreground-muted">{label} </span>
      <span className={`font-data ${accent ? 'text-accent-primary' : 'text-foreground-primary'}`}>
        {value}
      </span>
    </span>
  );
}

/** Single creator performance card: clickable summary row → expandable detail (posts / placements / daily / CPS). */
function PerfCard({
  perf,
  expanded,
  onToggle,
}: {
  perf: CreatorCampaignPerformance;
  expanded: boolean;
  onToggle: () => void;
}) {
  const cpsChips: { label: string; value: string }[] = [
    { label: 'GMV', value: perf.cps.gmv },
    { label: 'Orders', value: perf.cps.orders },
    { label: 'AOV', value: perf.cps.aov },
    { label: 'Clicks', value: perf.cps.clicks },
    { label: 'CTR', value: perf.cps.ctr },
    { label: 'CVR', value: perf.cps.cvr },
    { label: 'EPC', value: perf.cps.epc },
    { label: 'CPS Commission', value: perf.cps.commission },
    { label: 'CPS Spend', value: perf.cps.cpsSpend },
    { label: 'ROAS', value: perf.cps.roas },
  ];
  if (perf.cps.refundRate) cpsChips.push({ label: 'Refund Rate', value: perf.cps.refundRate });

  return (
    <div className="rounded-lg border border-border-default bg-surface-primary p-3">
      {/* Clickable summary row — always visible; click to drill into this creator */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full flex-wrap items-baseline gap-x-2 gap-y-1 rounded px-1.5 py-1 text-left transition-colors hover:bg-surface-hover/50"
      >
        <span className="inline-block w-3 text-foreground-muted">{expanded ? '▾' : '▸'}</span>
        <span className="text-sm font-semibold text-foreground-primary">{perf.creatorName}</span>
        <span className="text-xs text-foreground-muted">
          {perf.handle} · {perf.platform} · {perf.tier}
        </span>
        <span className="ml-auto flex flex-wrap items-baseline gap-x-2 text-[11px]">
          <RowMetric label="Posts" value={String(perf.summary.posts)} />
          <RowMetric label="Impr" value={perf.summary.totalImpressions} />
          <RowMetric label="ER" value={perf.summary.avgEngagementRate} />
          <RowMetric label="GMV" value={perf.cps.gmv} />
          <RowMetric label="ROAS" value={perf.cps.roas} accent />
        </span>
      </button>

      {expanded && (
        <>
      {/* Post performance table */}
      <div className="mt-2 overflow-auto">
        <table className="w-full min-w-[860px] border-collapse text-xs">
          <thead>
            <tr className="bg-surface-hover text-left text-foreground-muted">
              <th className="px-2 py-1.5 font-medium">Post</th>
              <th className="px-2 py-1.5 font-medium">Platform</th>
              <th className="px-2 py-1.5 font-medium">Published</th>
              <th className="px-2 py-1.5 font-medium">Type</th>
              <th className="px-2 py-1.5 text-right font-medium">Duration</th>
              <th className="px-2 py-1.5 text-right font-medium">Impr.</th>
              <th className="px-2 py-1.5 text-right font-medium">Plays</th>
              <th className="px-2 py-1.5 text-right font-medium">Likes</th>
              <th className="px-2 py-1.5 text-right font-medium">Cmts</th>
              <th className="px-2 py-1.5 text-right font-medium">Shares</th>
              <th className="px-2 py-1.5 text-right font-medium">Saves</th>
              <th className="px-2 py-1.5 text-right font-medium">ER</th>
            </tr>
          </thead>
          <tbody>
            {perf.posts.map((post) => (
              <tr key={post.id} className="border-t border-border-subtle">
                <td className="max-w-[280px] px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    {post.cover && (
                      <img
                        src={post.cover}
                        alt=""
                        className="h-8 w-12 flex-shrink-0 rounded object-cover"
                        loading="lazy"
                      />
                    )}
                    <div className="min-w-0">
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate font-medium text-foreground-primary hover:text-accent-primary"
                      >
                        {post.title}
                      </a>
                      {post.hashtags && (
                        <div className="truncate text-[10px] text-foreground-muted">{post.hashtags}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-foreground-secondary">{post.platform}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-foreground-secondary">{post.publishedAt}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-foreground-secondary">
                  {post.format === 'video' ? 'Video' : post.format === 'live-clip' ? 'Live Clip' : 'Image'}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-data text-foreground-secondary">
                  {post.duration ?? '—'}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-data text-foreground-primary">
                  {post.impressions}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-data text-foreground-secondary">
                  {post.plays ?? '—'}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-data text-foreground-secondary">{post.likes}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-data text-foreground-secondary">{post.comments}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-data text-foreground-secondary">{post.shares}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-data text-foreground-secondary">{post.saves}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-data text-accent-primary">
                  {post.engagementRate}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Placement details: Placement × Revenue/Share/Clicks/CTR/Conv/CVR/EPC/Commission/ROAS/Notes */}
      <div className="mt-2 overflow-auto">
        <table className="w-full min-w-[760px] border-collapse text-xs">
          <thead>
            <tr className="bg-surface-hover text-left text-foreground-muted">
              <th className="px-2 py-1.5 font-medium">Placement</th>
              <th className="px-2 py-1.5 text-right font-medium">Revenue</th>
              <th className="px-2 py-1.5 text-right font-medium">Share</th>
              <th className="px-2 py-1.5 text-right font-medium">Clicks</th>
              <th className="px-2 py-1.5 text-right font-medium">CTR</th>
              <th className="px-2 py-1.5 text-right font-medium">Conversions</th>
              <th className="px-2 py-1.5 text-right font-medium">CVR</th>
              <th className="px-2 py-1.5 text-right font-medium">EPC</th>
              <th className="px-2 py-1.5 text-right font-medium">Commission</th>
              <th className="px-2 py-1.5 text-right font-medium">ROAS</th>
              <th className="px-2 py-1.5 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {perf.placements.map((pl) => (
              <tr key={pl.type} className="border-t border-border-subtle">
                <td className="whitespace-nowrap px-2 py-1.5 font-medium text-foreground-primary">
                  {pl.type}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-data text-foreground-primary">
                  {pl.revenue}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-data text-foreground-secondary">
                  {pl.revenueShare}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-data text-foreground-secondary">
                  {pl.clicks}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-data text-foreground-secondary">
                  {pl.ctr}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-data text-foreground-secondary">
                  {pl.conversions}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-data text-foreground-secondary">
                  {pl.cvr}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-data text-foreground-secondary">
                  {pl.epc}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-data text-foreground-secondary">
                  {pl.commission}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right font-data text-accent-primary">
                  {pl.roas}
                </td>
                <td className="max-w-[160px] truncate px-2 py-1.5 text-foreground-muted">
                  {pl.notes ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Daily data series */}
      <div className="mt-2">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
          Daily · {perf.daily.length} days
        </div>
        <div className="max-h-44 overflow-auto rounded border border-border-subtle">
          <table className="w-full min-w-[560px] border-collapse text-xs">
            <thead className="sticky top-0">
              <tr className="bg-surface-hover text-left text-foreground-muted">
                <th className="px-2 py-1.5 font-medium">Date</th>
                <th className="px-2 py-1.5 text-right font-medium">Impr.</th>
                <th className="px-2 py-1.5 text-right font-medium">Eng.</th>
                <th className="px-2 py-1.5 text-right font-medium">Clicks</th>
                <th className="px-2 py-1.5 text-right font-medium">GMV</th>
                <th className="px-2 py-1.5 text-right font-medium">Orders</th>
              </tr>
            </thead>
            <tbody>
              {perf.daily.map((d) => (
                <tr key={d.date} className="border-t border-border-subtle">
                  <td className="whitespace-nowrap px-2 py-1 text-foreground-secondary">{d.date}</td>
                  <td className="whitespace-nowrap px-2 py-1 text-right font-data text-foreground-primary">{d.impressions}</td>
                  <td className="whitespace-nowrap px-2 py-1 text-right font-data text-foreground-secondary">{d.engagement}</td>
                  <td className="whitespace-nowrap px-2 py-1 text-right font-data text-foreground-secondary">{d.clicks}</td>
                  <td className="whitespace-nowrap px-2 py-1 text-right font-data text-accent-primary">{d.gmv}</td>
                  <td className="whitespace-nowrap px-2 py-1 text-right font-data text-foreground-secondary">{d.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CPS summary */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="self-center text-[11px] font-medium text-foreground-muted">CPS: </span>
        {cpsChips.map((chip) => (
          <span
            key={chip.label}
            className="rounded border border-border-subtle bg-surface-hover px-2 py-0.5 text-[11px] text-foreground-secondary"
          >
            {chip.label} <span className="font-data text-foreground-primary">{chip.value}</span>
          </span>
        ))}
      </div>
        </>
      )}
    </div>
  );
}

function DataTable({
  loading,
  headers,
  rows,
}: {
  loading: boolean;
  headers: string[];
  rows: string[][];
}) {
  if (loading) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">Loading…</p>;
  }
  if (rows.length === 0) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">No data</p>;
  }
  return (
    <div className="overflow-auto rounded-lg border border-border-default">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="bg-surface-hover text-left text-xs text-foreground-muted">
            {headers.map((h, i) => (
              <th key={i} className={`px-3 py-2 font-medium ${i === 0 ? '' : 'whitespace-nowrap'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-t border-border-subtle hover:bg-surface-hover/50">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-3 py-2 ${
                    ci === 0
                      ? 'font-medium text-foreground-primary'
                      : 'whitespace-nowrap text-foreground-secondary'
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
