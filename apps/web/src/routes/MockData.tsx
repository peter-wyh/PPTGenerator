import { useEffect, useState } from 'react';
import type {
  Campaign,
  CreatorCampaignPerformance,
  PlacementTypeSummary,
} from '@mediakit/shared';
import { listCampaigns } from '@/api/campaigns';
import { listCreators, type Creator } from '@/api/creators';
import { listCreatorPerformance, listPlacementTypeSummary } from '@/api/creatorPerformance';

/** Mock 数据展示页：上游接口（campaign / 达人 / 达人执行效果）的 mock 数据一览。 */
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

  /** 取达人频道 KPI 指标值（按 label 查找，如 'Avg Reach'）。 */
  const metric = (c: Creator, label: string) =>
    c.metrics.find((m) => m.label === label)?.value ?? '—';

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-headings text-xl font-semibold text-foreground-primary">Mock 数据</h1>
      <p className="mt-1 text-sm text-foreground-secondary">
        上游接口的 mock 数据展示（campaign / 达人 / 达人执行效果）。真实环境对接投放系统与达人库。
      </p>

      {/* Campaign 数据 */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          Campaign 数据 · {campaigns.length}
        </h2>
        <DataTable
          loading={loadingCamps}
          headers={['Campaign', '广告主', '业务线', '平台', '周期', '预算', '状态', '负责人']}
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

      {/* 达人库 */}
      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          达人库 · {creators.length}
        </h2>
        <DataTable
          loading={loadingCreators}
          headers={['达人', 'Handle', '平台', '层级', '粉丝', '互动率', '类目', '地区', 'Avg Reach', 'Impressions', 'Follower Growth', 'CPM']}
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

      {/* 达人执行效果（按 Campaign）：帖子效果 + CPS */}
      <CreatorPerformanceSection campaignIds={campaigns.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  );
}

/** 达人执行效果区：选 Campaign → 展示该 campaign 下各达人的帖子效果 + CPS 数据。 */
function CreatorPerformanceSection({
  campaignIds,
}: {
  campaignIds: { id: string; name: string }[];
}) {
  const [selectedId, setSelectedId] = useState('');
  const [perf, setPerf] = useState<CreatorCampaignPerformance[]>([]);
  const [summary, setSummary] = useState<PlacementTypeSummary[]>([]);
  const [loading, setLoading] = useState(false);

  // 首批 campaign 到达后默认选第一个。
  useEffect(() => {
    if (!selectedId && campaignIds.length > 0) setSelectedId(campaignIds[0].id);
  }, [campaignIds, selectedId]);

  // 切换 campaign 时拉取执行效果 + 投放位汇总。
  useEffect(() => {
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
          达人执行效果（帖子 + 投放位 + CPS）· {perf.length}
        </h2>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={campaignIds.length === 0}
          className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs"
        >
          {campaignIds.length === 0 && <option value="">无 Campaign</option>}
          {campaignIds.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">
          加载中…
        </p>
      )}
      {!loading && perf.length === 0 && (
        <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">
          该 Campaign 暂无达人执行效果数据
        </p>
      )}

      {!loading && summary.length > 0 && (
        <div className="mb-4">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
            投放位类型汇总（campaign 维度）
          </div>
          <PlacementSummaryTable summary={summary} />
        </div>
      )}

      {!loading && perf.length > 0 && (
        <div className="space-y-4">
          {perf.map((p) => (
            <PerfCard key={p.creatorId} perf={p} />
          ))}
        </div>
      )}
    </section>
  );
}

/** 投放位类型汇总表（≈看板截图 2）：Placement Type × Revenue/Share/ROAS/Clicks/CTR/Conv/CVR/EPC。 */
function PlacementSummaryTable({ summary }: { summary: PlacementTypeSummary[] }) {
  return (
    <div className="overflow-auto rounded-lg border border-border-default">
      <table className="w-full min-w-[820px] border-collapse text-xs">
        <thead>
          <tr className="bg-surface-hover text-left text-foreground-muted">
            <th className="px-3 py-2 font-medium">投放位类型</th>
            <th className="px-3 py-2 text-right font-medium">收入</th>
            <th className="px-3 py-2 text-right font-medium">占比</th>
            <th className="px-3 py-2 text-right font-medium">ROAS</th>
            <th className="px-3 py-2 text-right font-medium">点击</th>
            <th className="px-3 py-2 text-right font-medium">CTR</th>
            <th className="px-3 py-2 text-right font-medium">转化</th>
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

/** 单个达人的执行效果卡：汇总 → 帖子效果表 → CPS 汇总。 */
function PerfCard({ perf }: { perf: CreatorCampaignPerformance }) {
  const cpsChips: { label: string; value: string }[] = [
    { label: 'GMV', value: perf.cps.gmv },
    { label: '订单(转化)', value: perf.cps.orders },
    { label: '客单价', value: perf.cps.aov },
    { label: '点击', value: perf.cps.clicks },
    { label: 'CTR', value: perf.cps.ctr },
    { label: 'CVR', value: perf.cps.cvr },
    { label: 'EPC', value: perf.cps.epc },
    { label: 'CPS 佣金', value: perf.cps.commission },
    { label: 'CPS 花费', value: perf.cps.cpsSpend },
    { label: 'ROAS', value: perf.cps.roas },
  ];
  if (perf.cps.refundRate) cpsChips.push({ label: '退款率', value: perf.cps.refundRate });

  return (
    <div className="rounded-lg border border-border-default bg-surface-primary p-3">
      {/* 头部：达人 + 层级 + 平台 + 汇总 */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-sm font-semibold text-foreground-primary">{perf.creatorName}</span>
        <span className="text-xs text-foreground-muted">
          {perf.handle} · {perf.platform} · {perf.tier}
        </span>
        <span className="ml-auto text-[11px] text-foreground-secondary">
          上线 {perf.summary.posts} 帖 · 累计曝光 {perf.summary.totalImpressions} · 总互动{' '}
          {perf.summary.totalEngagement} · 平均互动率 {perf.summary.avgEngagementRate}
        </span>
      </div>

      {/* 帖子效果表 */}
      <div className="mt-2 overflow-auto">
        <table className="w-full min-w-[860px] border-collapse text-xs">
          <thead>
            <tr className="bg-surface-hover text-left text-foreground-muted">
              <th className="px-2 py-1.5 font-medium">作品</th>
              <th className="px-2 py-1.5 font-medium">平台</th>
              <th className="px-2 py-1.5 font-medium">发布</th>
              <th className="px-2 py-1.5 font-medium">类型</th>
              <th className="px-2 py-1.5 text-right font-medium">时长</th>
              <th className="px-2 py-1.5 text-right font-medium">曝光</th>
              <th className="px-2 py-1.5 text-right font-medium">播放</th>
              <th className="px-2 py-1.5 text-right font-medium">赞</th>
              <th className="px-2 py-1.5 text-right font-medium">评</th>
              <th className="px-2 py-1.5 text-right font-medium">转</th>
              <th className="px-2 py-1.5 text-right font-medium">藏</th>
              <th className="px-2 py-1.5 text-right font-medium">互动率</th>
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
                  {post.format === 'video' ? '视频' : post.format === 'live-clip' ? '直播切片' : '图文'}
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

      {/* 投放位明细（≈看板截图 1）：Placement × Revenue/Share/Clicks/CTR/Conv/CVR/EPC/Commission/ROAS/Notes */}
      <div className="mt-2 overflow-auto">
        <table className="w-full min-w-[760px] border-collapse text-xs">
          <thead>
            <tr className="bg-surface-hover text-left text-foreground-muted">
              <th className="px-2 py-1.5 font-medium">投放位</th>
              <th className="px-2 py-1.5 text-right font-medium">收入</th>
              <th className="px-2 py-1.5 text-right font-medium">占比</th>
              <th className="px-2 py-1.5 text-right font-medium">点击</th>
              <th className="px-2 py-1.5 text-right font-medium">CTR</th>
              <th className="px-2 py-1.5 text-right font-medium">转化</th>
              <th className="px-2 py-1.5 text-right font-medium">CVR</th>
              <th className="px-2 py-1.5 text-right font-medium">EPC</th>
              <th className="px-2 py-1.5 text-right font-medium">佣金</th>
              <th className="px-2 py-1.5 text-right font-medium">ROAS</th>
              <th className="px-2 py-1.5 font-medium">备注</th>
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

      {/* 每日数据序列 */}
      <div className="mt-2">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
          每日数据 · {perf.daily.length} 天
        </div>
        <div className="max-h-44 overflow-auto rounded border border-border-subtle">
          <table className="w-full min-w-[560px] border-collapse text-xs">
            <thead className="sticky top-0">
              <tr className="bg-surface-hover text-left text-foreground-muted">
                <th className="px-2 py-1.5 font-medium">日期</th>
                <th className="px-2 py-1.5 text-right font-medium">曝光</th>
                <th className="px-2 py-1.5 text-right font-medium">互动</th>
                <th className="px-2 py-1.5 text-right font-medium">点击</th>
                <th className="px-2 py-1.5 text-right font-medium">GMV</th>
                <th className="px-2 py-1.5 text-right font-medium">订单</th>
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

      {/* CPS 汇总 */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="self-center text-[11px] font-medium text-foreground-muted">CPS：</span>
        {cpsChips.map((chip) => (
          <span
            key={chip.label}
            className="rounded border border-border-subtle bg-surface-hover px-2 py-0.5 text-[11px] text-foreground-secondary"
          >
            {chip.label} <span className="font-data text-foreground-primary">{chip.value}</span>
          </span>
        ))}
      </div>
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
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">加载中…</p>;
  }
  if (rows.length === 0) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">暂无数据</p>;
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
