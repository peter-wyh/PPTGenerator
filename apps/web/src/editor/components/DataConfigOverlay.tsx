import { useEffect, useState } from 'react';
import type {
  Campaign,
  CampaignMetric,
  ReportCampaign,
  ReportCreator,
} from '@mediakit/shared';
import { CREATOR_METRIC_CATALOG } from '@mediakit/shared';
import { useEditorStore } from '../store';
import { listCampaigns } from '../../api/campaigns';
import { listCreators, type Creator } from '../../api/creators';

interface Props {
  onClose: () => void;
}

/**
 * 报告数据配置浮层：
 * - 绑定 / 切换 Campaign（含投放表现指标预览）
 * - 选择达人（多选），可编辑粉丝 / 互动率等 KPI
 * 选中的数据存入 store.reportData（随 projectMeta.reportData 持久化），
 * 各业务组件属性面板可一键从 reportData 取数填充。
 */
export function DataConfigOverlay({ onClose }: Props) {
  const reportData = useEditorStore((s) => s.reportData);
  const setReportData = useEditorStore((s) => s.setReportData);

  // ---- Campaign 列表 ----
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [campaignFailed, setCampaignFailed] = useState(false);
  const selectedCampaignId = reportData.campaign?.id ?? '';

  useEffect(() => {
    let alive = true;
    setCampaigns(null);
    setCampaignFailed(false);
    listCampaigns()
      .then((list) => alive && setCampaigns(list))
      .catch(() => alive && setCampaignFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  // ---- Creator 列表 ----
  const [allCreators, setAllCreators] = useState<Creator[] | null>(null);
  const [creatorFailed, setCreatorFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setAllCreators(null);
    setCreatorFailed(false);
    listCreators()
      .then((list) => alive && setAllCreators(list))
      .catch(() => alive && setCreatorFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  // ---- Campaign 绑定 ----
  function selectCampaign(id: string) {
    const c = campaigns?.find((x) => x.id === id);
    if (!c) return;
    const rc: ReportCampaign = {
      id: c.id,
      name: c.name,
      advertiser: c.advertiser,
      platform: c.platform,
      startDate: c.startDate,
      endDate: c.endDate,
      budget: c.budget,
      status: c.status,
      metrics: c.metrics,
    };
    setReportData({ ...reportData, campaign: rc });
  }

  function clearCampaign() {
    setReportData({ ...reportData, campaign: null });
  }

  // ---- Creator 增删 ----
  function toggleCreator(c: Creator) {
    const existing = reportData.creators ?? [];
    const idx = existing.findIndex((x) => x.id === c.id);
    let next: ReportCreator[];
    if (idx >= 0) {
      next = existing.filter((_, i) => i !== idx);
    } else {
      // 新增达人时，从上游字段自动填充 followers / engagement 等 KPI。
      const stats = buildDefaultStats(c);
      next = [
        ...existing,
        {
          id: c.id,
          name: c.name,
          handle: c.handle,
          platform: c.platform,
          tier: c.tier,
          followers: c.followers,
          engagement: c.engagement,
          category: c.category,
          region: c.region,
          stats,
        },
      ];
    }
    setReportData({ ...reportData, creators: next });
  }

  /** 编辑达人某一项 KPI 值。 */
  function updateCreatorStat(creatorId: string, statIndex: number, value: string) {
    const creators = [...(reportData.creators ?? [])];
    const ci = creators.findIndex((x) => x.id === creatorId);
    if (ci < 0) return;
    const creator = { ...creators[ci] };
    const stats = [...(creator.stats ?? [])];
    if (stats[statIndex]) {
      stats[statIndex] = { ...stats[statIndex], value };
      creator.stats = stats;
      creators[ci] = creator;
      setReportData({ ...reportData, creators });
    }
  }

  /** 删除达人某一项 KPI。 */
  function removeCreatorStat(creatorId: string, statIndex: number) {
    const creators = [...(reportData.creators ?? [])];
    const ci = creators.findIndex((x) => x.id === creatorId);
    if (ci < 0) return;
    const creator = { ...creators[ci] };
    creator.stats = (creator.stats ?? []).filter((_, i) => i !== statIndex);
    creators[ci] = creator;
    setReportData({ ...reportData, creators });
  }

  /** 给达人添加一项 KPI（从指标库中选一个未添加的）。 */
  function addCreatorStat(creatorId: string, metricKey: string) {
    const metric = CREATOR_METRIC_CATALOG.find((m) => m.key === metricKey);
    if (!metric) return;
    const creators = [...(reportData.creators ?? [])];
    const ci = creators.findIndex((x) => x.id === creatorId);
    if (ci < 0) return;
    const creator = { ...creators[ci] };
    creator.stats = [
      ...(creator.stats ?? []),
      { key: metric.key, label: metric.label, value: '', color: metric.color },
    ];
    creators[ci] = creator;
    setReportData({ ...reportData, creators });
  }

  const selectedCreators = reportData.creators ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-[720px] flex-col gap-4 overflow-auto rounded-xl bg-surface-primary p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="font-headings text-base font-semibold text-foreground-primary">
            报告数据配置
          </div>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-foreground-secondary hover:bg-surface-hover"
          >
            ✕
          </button>
        </div>

        {/* ===== Campaign 区域 ===== */}
        <section className="rounded-lg border border-border-default p-3">
          <h3 className="mb-2 text-sm font-semibold text-foreground-primary">投放 Campaign</h3>

          {campaignFailed && (
            <p className="text-xs text-red">加载 Campaign 失败，请重试。</p>
          )}
          {!campaigns && !campaignFailed && (
            <p className="text-xs text-foreground-muted">加载中…</p>
          )}

          {campaigns && (
            <>
              <label className="block text-xs text-foreground-secondary">
                <span className="mb-1 block">选择 Campaign</span>
                <select
                  value={selectedCampaignId}
                  onChange={(e) =>
                    e.target.value ? selectCampaign(e.target.value) : clearCampaign()
                  }
                  className="w-full rounded border border-border-default bg-surface-primary px-2 py-1"
                >
                  <option value="">— 不绑定 —</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}（{c.advertiser}）
                    </option>
                  ))}
                </select>
              </label>

              {reportData.campaign && (
                <div className="mt-2 rounded border border-border-default p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-foreground-muted">
                      投放表现指标（将供 KPI 看板导入）
                    </span>
                    <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-secondary">
                      {reportData.campaign.status}
                    </span>
                  </div>
                  {(reportData.campaign.metrics ?? []).length > 0 ? (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-foreground-muted">
                          <th className="text-left font-normal">指标</th>
                          <th className="text-right font-normal">数值</th>
                          <th className="text-right font-normal">对比</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reportData.campaign.metrics ?? []).map((mm: CampaignMetric) => (
                          <tr key={mm.label}>
                            <td className="text-left">{mm.label}</td>
                            <td className="text-right">{mm.value}</td>
                            <td
                              className="text-right"
                              style={{
                                color: mm.compare.trim().startsWith('-')
                                  ? 'var(--color-danger, #dc2626)'
                                  : 'var(--color-success, #16a34a)',
                              }}
                            >
                              {mm.compare}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-xs text-foreground-muted">该 Campaign 无指标数据</p>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        {/* ===== 达人区域 ===== */}
        <section className="rounded-lg border border-border-default p-3">
          <h3 className="mb-2 text-sm font-semibold text-foreground-primary">达人列表</h3>

          {creatorFailed && (
            <p className="text-xs text-red">加载达人失败，请重试。</p>
          )}
          {!allCreators && !creatorFailed && (
            <p className="text-xs text-foreground-muted">加载中…</p>
          )}

          {allCreators && (
            <div className="flex flex-wrap gap-1.5">
              {allCreators.map((c) => {
                const active = selectedCreators.some((x) => x.id === c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleCreator(c)}
                    className={
                      active
                        ? 'rounded border border-accent-primary bg-accent-primary px-2 py-1 text-xs text-white'
                        : 'rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover'
                    }
                  >
                    {c.name}
                    <span className="ml-1 text-[10px] opacity-70">
                      {c.platform} · {c.tier}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 已选达人详情 + KPI 编辑 */}
          {selectedCreators.length > 0 && (
            <div className="mt-3 space-y-2">
              {selectedCreators.map((cr) => (
                <div key={cr.id} className="rounded border border-border-default p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground-primary">
                      {cr.name}
                      <span className="ml-1 font-normal text-foreground-muted">
                        {cr.handle} · {cr.platform} · {cr.tier}
                      </span>
                    </span>
                    <button
                      onClick={() =>
                        toggleCreator(
                          allCreators?.find((x) => x.id === cr.id) ?? {
                            id: cr.id,
                            name: cr.name,
                            handle: cr.handle ?? '',
                            platform: cr.platform ?? '',
                            tier: cr.tier ?? '',
                            followers: cr.followers ?? '',
                            engagement: cr.engagement ?? '',
                            category: cr.category ?? '',
                            region: cr.region ?? '',
                          },
                        )
                      }
                      className="text-[10px] text-foreground-muted hover:text-red"
                    >
                      移除
                    </button>
                  </div>
                  <div className="space-y-1">
                    {(cr.stats ?? []).map((stat, si) => (
                      <div key={si} className="flex items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: stat.color }}
                        />
                        <span className="w-28 text-xs text-foreground-secondary">{stat.label}</span>
                        <input
                          value={stat.value}
                          onChange={(e) => updateCreatorStat(cr.id, si, e.target.value)}
                          className="flex-1 rounded border border-border-default bg-surface-primary px-1.5 py-0.5 text-xs"
                        />
                        <button
                          onClick={() => removeCreatorStat(cr.id, si)}
                          className="text-[10px] text-foreground-muted hover:text-red"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {/* 添加 KPI 行 */}
                    <AddStatRow
                      creatorId={cr.id}
                      existingKeys={(cr.stats ?? []).map((s) => s.key)}
                      onAdd={addCreatorStat}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 底部操作栏 */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded bg-accent-primary px-4 py-1.5 text-sm text-white hover:bg-accent-secondary"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================ 辅助函数 ============================ */

/** 从上游 Creator 构造默认 KPI 统计条（followers + engagement + reach）。 */
function buildDefaultStats(c: Creator): ReportCreator['stats'] {
  const stats: NonNullable<ReportCreator['stats']> = [];
  const followersMetric = CREATOR_METRIC_CATALOG.find((m) => m.key === 'followers');
  const engagementMetric = CREATOR_METRIC_CATALOG.find((m) => m.key === 'engagement');
  if (followersMetric) {
    stats.push({
      key: followersMetric.key,
      label: followersMetric.label,
      value: c.followers,
      color: followersMetric.color,
      selected: true,
    });
  }
  if (engagementMetric) {
    stats.push({
      key: engagementMetric.key,
      label: engagementMetric.label,
      value: c.engagement,
      color: engagementMetric.color,
      selected: true,
    });
  }
  return stats;
}

/** 添加 KPI 行：下拉选择指标库中未添加的指标。 */
function AddStatRow({
  creatorId,
  existingKeys,
  onAdd,
}: {
  creatorId: string;
  existingKeys: (string | undefined)[];
  onAdd: (creatorId: string, metricKey: string) => void;
}) {
  const available = CREATOR_METRIC_CATALOG.filter((m) => !existingKeys.includes(m.key));
  const [value, setValue] = useState('');
  if (available.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-foreground-muted">+ 添加指标</span>
      <select
        value={value}
        onChange={(e) => {
          if (e.target.value) {
            onAdd(creatorId, e.target.value);
            setValue('');
          }
        }}
        className="flex-1 rounded border border-border-default bg-surface-primary px-1.5 py-0.5 text-xs"
      >
        <option value="">选择指标…</option>
        {available.map((m) => (
          <option key={m.key} value={m.key}>
            {m.label}（{m.placeholder}）
          </option>
        ))}
      </select>
    </div>
  );
}
