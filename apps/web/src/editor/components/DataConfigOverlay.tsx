import { Fragment, useEffect, useState } from 'react';
import type {
  Campaign,
  CampaignMetric,
  ReportCampaign,
  ReportCreator,
  ReportDataContext,
} from '@mediakit/shared';
import { CREATOR_METRIC_CATALOG } from '@mediakit/shared';
import { useEditorStore } from '../store';
import { listCampaigns, reportCampaignFrom } from '../../api/campaigns';
import { listCreators, listCampaignCreators, type Creator } from '../../api/creators';
import { campaignCreatorWorks, type CreatorWithWorks } from '../../api/mock/creatorPerformance';

interface Props {
  onClose: () => void;
}

/**
 * 报告数据配置浮层（两大分类）：
 *
 * ① Campaign — 绑定 Campaign + 查看该 campaign 下参与合作的达人
 * ② Creator Library — 从达人库独立选择达人
 *
 * 选中的数据存入 store.reportData（随 projectMeta.reportData 持久化），
 * 各业务组件属性面板可一键从 reportData 取数填充。
 */
export function DataConfigOverlay({ onClose }: Props) {
  // Draft 模式：本地拷贝 reportData，点击保存才提交到 store。
  const commitReportData = useEditorStore((s) => s.setReportData);
  const [reportData, setLocalReportData] = useState<ReportDataContext>(() => useEditorStore.getState().reportData);
  // 同名函数替换 store 的 setReportData，所有下游代码零改动。
  const setReportData = (data: ReportDataContext) => setLocalReportData(data);

  // 项目业务线（只读；用于过滤 campaign 下拉）。存量项目无业务线 → 显示全部。
  const projectBusinessLine = useEditorStore((s) => s.projectMeta?.businessLine);
  // 项目创建时绑定的上游 campaign（从 projectMeta.campaignId 读取）。
  const projectIdCampaign = useEditorStore((s) => s.projectMeta?.campaignId);

  function handleSave() {
    commitReportData(reportData);
    onClose();
  }

  const [activeTab, setActiveTab] = useState<'campaign' | 'library'>('campaign');

  // ---- Campaign 列表 ----
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [campaignFailed, setCampaignFailed] = useState(false);
  const selectedCampaignId = reportData.campaign?.id ?? '';

  // 按项目业务线过滤；无业务线（存量项目）显示全部；已绑定 campaign 即便不在过滤内也保留
  const visibleCampaigns =
    campaigns?.filter((c) => !projectBusinessLine || c.businessLine === projectBusinessLine) ?? [];
  const boundMissing =
    selectedCampaignId && !visibleCampaigns.some((c) => c.id === selectedCampaignId)
      ? campaigns?.find((c) => c.id === selectedCampaignId) ?? null
      : null;
  const dropdownCampaigns = boundMissing ? [boundMissing, ...visibleCampaigns] : visibleCampaigns;

  useEffect(() => {
    let alive = true;
    setCampaigns(null);
    setCampaignFailed(false);
    listCampaigns()
      .then((list) => {
        if (!alive) return;
        setCampaigns(list);
        // 自动回显：reportData.campaign 为空但项目绑定了 campaign → 自动选中并加载达人。
        const hasReport = !!useEditorStore.getState().reportData.campaign;
        const targetId = projectIdCampaign;
        if (!hasReport && targetId) {
          const c = list.find((x) => x.id === targetId);
          if (c) {
            const rc: ReportCampaign = {
              id: c.id,
              name: c.name,
              advertiser: c.advertiser,
              platform: c.platform,
              platforms: c.platforms,
              startDate: c.startDate,
              endDate: c.endDate,
              budget: c.budget,
              status: c.status,
              metrics: c.metrics,
            };
            setLocalReportData((prev) => ({ ...prev, campaign: rc }));
          }
        }
      })
      .catch(() => alive && setCampaignFailed(true));
    return () => {
      alive = false;
    };
  }, [projectIdCampaign]);

  // ---- Campaign 达人列表（随 campaign 切换动态加载）----
  const [campaignCreators, setCampaignCreators] = useState<Creator[] | null>(null);
  const [ccLoading, setCcLoading] = useState(false);
  const [ccFailed, setCcFailed] = useState(false);
  // ---- 达人合作作品列表（与 campaignCreators 同时加载）----
  const [creatorWorks, setCreatorWorks] = useState<CreatorWithWorks[] | null>(null);

  useEffect(() => {
    if (!selectedCampaignId) {
      setCampaignCreators(null);
      setCreatorWorks(null);
      return;
    }
    let alive = true;
    setCcLoading(true);
    setCcFailed(false);
    setCampaignCreators(null);
    setCreatorWorks(null);
    listCampaignCreators(selectedCampaignId)
      .then((list) => {
        if (!alive) return;
        setCampaignCreators(list);
        // 同步加载达人合作作品（mock 数据，确定性）
        setCreatorWorks(campaignCreatorWorks(selectedCampaignId));
        // 自动回显：如果 reportData.campaignCreators 为空（首次打开），自动全选该 campaign 的合作达人。
        const existing = useEditorStore.getState().reportData.campaignCreators;
        if ((!existing || existing.length === 0) && list.length > 0) {
          const autoSelected: ReportCreator[] = list.map((c) => ({
            id: c.id,
            name: c.name,
            handle: c.handle,
            platform: c.platform,
            tier: c.tier,
            followers: c.followers,
            engagement: c.engagement,
            category: c.category,
            region: c.region,
            stats: buildDefaultStats(c),
          }));
          setLocalReportData((prev) => ({ ...prev, campaignCreators: autoSelected }));
        }
      })
      .catch(() => alive && setCcFailed(true))
      .finally(() => alive && setCcLoading(false));
    return () => {
      alive = false;
    };
  }, [selectedCampaignId]);

  // ---- 达人库列表 ----
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

  /* ============ Campaign 绑定 ============ */

  function selectCampaign(id: string) {
    const c = campaigns?.find((x) => x.id === id);
    if (!c) return;
    const rc = reportCampaignFrom(c);
    // 切换 Campaign 时清空旧的 campaign 达人选择
    setReportData({ ...reportData, campaign: rc, campaignCreators: [] });
  }

  function clearCampaign() {
    setReportData({ ...reportData, campaign: null, campaignCreators: [] });
  }

  /* ============ Campaign 达人增删 ============ */

  function toggleCampaignCreator(c: Creator) {
    const existing = reportData.campaignCreators ?? [];
    const idx = existing.findIndex((x) => x.id === c.id);
    let next: ReportCreator[];
    if (idx >= 0) {
      next = existing.filter((_, i) => i !== idx);
    } else {
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
          avatar: c.avatar,
          stats,
        },
      ];
    }
    setReportData({ ...reportData, campaignCreators: next });
  }

  /* ============ 达人库达人增删 ============ */

  function toggleCreator(c: Creator) {
    const existing = reportData.creators ?? [];
    const idx = existing.findIndex((x) => x.id === c.id);
    let next: ReportCreator[];
    if (idx >= 0) {
      next = existing.filter((_, i) => i !== idx);
    } else {
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
          avatar: c.avatar,
          stats,
        },
      ];
    }
    setReportData({ ...reportData, creators: next });
  }

  /* ============ 达人 KPI 编辑（两类共用）============ */

  function updateCreatorStat(
    section: 'campaignCreators' | 'creators',
    creatorId: string,
    statIndex: number,
    value: string,
  ) {
    const list = [...(reportData[section] ?? [])];
    const ci = list.findIndex((x) => x.id === creatorId);
    if (ci < 0) return;
    const creator = { ...list[ci] };
    const stats = [...(creator.stats ?? [])];
    if (stats[statIndex]) {
      stats[statIndex] = { ...stats[statIndex], value };
      creator.stats = stats;
      list[ci] = creator;
      setReportData({ ...reportData, [section]: list });
    }
  }

  function removeCreatorStat(
    section: 'campaignCreators' | 'creators',
    creatorId: string,
    statIndex: number,
  ) {
    const list = [...(reportData[section] ?? [])];
    const ci = list.findIndex((x) => x.id === creatorId);
    if (ci < 0) return;
    const creator = { ...list[ci] };
    creator.stats = (creator.stats ?? []).filter((_, i) => i !== statIndex);
    list[ci] = creator;
    setReportData({ ...reportData, [section]: list });
  }

  function addCreatorStat(
    section: 'campaignCreators' | 'creators',
    creatorId: string,
    metricKey: string,
  ) {
    const metric = CREATOR_METRIC_CATALOG.find((m) => m.key === metricKey);
    if (!metric) return;
    const list = [...(reportData[section] ?? [])];
    const ci = list.findIndex((x) => x.id === creatorId);
    if (ci < 0) return;
    const creator = { ...list[ci] };
    creator.stats = [
      ...(creator.stats ?? []),
      { key: metric.key, label: metric.label, value: '', color: metric.color },
    ];
    list[ci] = creator;
    setReportData({ ...reportData, [section]: list });
  }

  const selectedCampaignCreators = reportData.campaignCreators ?? [];
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
            Report Data
          </div>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-foreground-secondary hover:bg-surface-hover"
          >
            ✕
          </button>
        </div>

        {/* ===== Tab 切换 ===== */}
        <div className="flex gap-2">
          <TabButton
            active={activeTab === 'campaign'}
            onClick={() => setActiveTab('campaign')}
          >
            Campaign & Creators
          </TabButton>
          <TabButton
            active={activeTab === 'library'}
            onClick={() => setActiveTab('library')}
          >
            Creator Library
          </TabButton>
        </div>

        {/* ===== Tab 1: Campaign + 合作达人 ===== */}
        {activeTab === 'campaign' && (
          <div className="space-y-4">
            {/* Campaign 选择 */}
            <section className="rounded-lg border border-border-default p-3">
              <h3 className="mb-2 text-sm font-semibold text-foreground-primary">Campaign</h3>

              {campaignFailed && (
                <p className="text-xs text-red">Failed to load campaigns.</p>
              )}
              {!campaigns && !campaignFailed && (
                <p className="text-xs text-foreground-muted">Loading…</p>
              )}

              {campaigns && (
                <>
                  <select
                    value={selectedCampaignId}
                    onChange={(e) =>
                      e.target.value ? selectCampaign(e.target.value) : clearCampaign()
                    }
                    className="w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-sm"
                  >
                    <option value="">— No campaign —</option>
                    {dropdownCampaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}（{c.advertiser}）
                      </option>
                    ))}
                  </select>

                  {reportData.campaign && (
                    <div className="mt-2 rounded border border-border-default p-2">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs text-foreground-muted">
                          Campaign metrics (for KPI board import)
                        </span>
                        <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-secondary">
                          {reportData.campaign.status}
                        </span>
                      </div>
                      {(reportData.campaign.metrics ?? []).length > 0 ? (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-foreground-muted">
                              <th className="text-left font-normal">Metric</th>
                              <th className="text-right font-normal">Value</th>
                              <th className="text-right font-normal">Compare</th>
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
                        <p className="text-xs text-foreground-muted">No metrics</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>

            {/* Campaign 合作达人 */}
            {selectedCampaignId && (
              <section className="rounded-lg border border-border-default p-3">
                <h3 className="mb-2 text-sm font-semibold text-foreground-primary">
                  Campaign Creators
                </h3>

                {ccFailed && (
                  <p className="text-xs text-red">Failed to load creators.</p>
                )}
                {ccLoading && (
                  <p className="text-xs text-foreground-muted">Loading…</p>
                )}

                {campaignCreators && campaignCreators.length === 0 && (
                  <p className="text-xs text-foreground-muted">
                    No creators found in this campaign.
                  </p>
                )}

                {campaignCreators && campaignCreators.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {campaignCreators.map((c) => {
                      const active = selectedCampaignCreators.some((x) => x.id === c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() => toggleCampaignCreator(c)}
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

                {/* 已选达人详情 + KPI 表格编辑 */}
                {selectedCampaignCreators.length > 0 && (
                  <div className="mt-3">
                    <CreatorTable
                      creators={selectedCampaignCreators}
                      section="campaignCreators"
                      onUpdateStat={updateCreatorStat}
                      onRemoveStat={removeCreatorStat}
                      onAddStat={addCreatorStat}
                      onRemoveCreator={(creatorId) => {
                        const orig = campaignCreators?.find((x) => x.id === creatorId);
                        if (orig) toggleCampaignCreator(orig);
                      }}
                    />
                  </div>
                )}

                {/* 达人合作作品 + 数据指标 */}
                {creatorWorks && creatorWorks.length > 0 && (
                  <div className="mt-3">
                    <h4 className="mb-2 text-xs font-semibold text-foreground-primary">
                      Creator Posts（合作作品及效果数据）
                    </h4>
                    <CreatorWorksTable works={creatorWorks} />
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {/* ===== Tab 2: 达人库 ===== */}
        {activeTab === 'library' && (
          <section className="rounded-lg border border-border-default p-3">
            <h3 className="mb-2 text-sm font-semibold text-foreground-primary">
              Creator Library
            </h3>

            {creatorFailed && (
              <p className="text-xs text-red">Failed to load creators.</p>
            )}
            {!allCreators && !creatorFailed && (
              <p className="text-xs text-foreground-muted">Loading…</p>
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

            {/* 已选达人详情 + KPI 表格编辑 */}
            {selectedCreators.length > 0 && (
              <div className="mt-3">
                <CreatorTable
                  creators={selectedCreators}
                  section="creators"
                  onUpdateStat={updateCreatorStat}
                  onRemoveStat={removeCreatorStat}
                  onAddStat={addCreatorStat}
                  onRemoveCreator={(creatorId) => {
                    const orig = allCreators?.find((x) => x.id === creatorId);
                    if (orig) toggleCreator(orig);
                  }}
                />
              </div>
            )}
          </section>
        )}

        {/* 底部操作栏 */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border border-border-default px-4 py-1.5 text-sm text-foreground-secondary hover:bg-surface-hover"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="rounded bg-accent-primary px-4 py-1.5 text-sm text-white hover:bg-accent-secondary"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================ 子组件 ============================ */

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active
          ? 'bg-accent-primary text-white'
          : 'text-foreground-secondary hover:bg-surface-hover'
      }`}
    >
      {children}
    </button>
  );
}

/** 达人数据可编辑表格：行=达人，列=KPI 指标，单元格直接编辑。 */
function CreatorTable({
  creators,
  section,
  onUpdateStat,
  onRemoveStat,
  onAddStat,
  onRemoveCreator,
}: {
  creators: ReportCreator[];
  section: 'campaignCreators' | 'creators';
  onUpdateStat: (section: 'campaignCreators' | 'creators', creatorId: string, statIndex: number, value: string) => void;
  onRemoveStat: (section: 'campaignCreators' | 'creators', creatorId: string, statIndex: number) => void;
  onAddStat: (section: 'campaignCreators' | 'creators', creatorId: string, metricKey: string) => void;
  onRemoveCreator: (creatorId: string) => void;
}) {
  if (creators.length === 0) return null;

  // 收集所有出现过的 metric key（保持插入顺序）作为动态列。
  const metricKeys: string[] = [];
  const keySet = new Set<string>();
  for (const cr of creators) {
    for (const s of cr.stats ?? []) {
      const k = s.key;
      if (k && !keySet.has(k)) {
        keySet.add(k);
        metricKeys.push(k);
      }
    }
  }

  const colLabel = (key: string) =>
    CREATOR_METRIC_CATALOG.find((m) => m.key === key)?.label ?? key;

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-border-default text-foreground-muted">
            <th className="sticky left-0 z-10 bg-surface-primary px-2 py-1 text-left font-normal">达人</th>
            <th className="px-2 py-1 text-left font-normal">平台</th>
            {metricKeys.map((k) => (
              <th key={k} className="px-2 py-1 text-right font-normal whitespace-nowrap">
                {colLabel(k)}
              </th>
            ))}
            <th className="px-2 py-1 text-center font-normal">操作</th>
          </tr>
        </thead>
        <tbody>
          {creators.map((cr) => {
            const existingKeys = (cr.stats ?? []).map((s) => s.key);
            return (
              <tr key={cr.id} className="border-b border-border-subtle hover:bg-surface-hover/50">
                <td className="sticky left-0 z-10 bg-surface-primary px-2 py-1 text-left font-medium text-foreground-primary whitespace-nowrap">
                  {cr.name}
                  <span className="ml-1 text-[10px] font-normal text-foreground-muted">{cr.tier}</span>
                </td>
                <td className="px-2 py-1 text-left text-foreground-secondary whitespace-nowrap">{cr.platform}</td>
                {metricKeys.map((mk) => {
                  const si = (cr.stats ?? []).findIndex((s) => s.key === mk);
                  const stat = si >= 0 ? cr.stats![si] : null;
                  return (
                    <td key={mk} className="px-1 py-0.5 text-right">
                      {stat ? (
                        <div className="flex items-center gap-0.5 justify-end">
                          <input
                            value={stat.value}
                            onChange={(e) => onUpdateStat(section, cr.id, si, e.target.value)}
                            className="w-20 rounded border border-border-default bg-surface-primary px-1 py-0.5 text-right text-xs"
                          />
                          <button
                            onClick={() => onRemoveStat(section, cr.id, si)}
                            className="text-[10px] text-foreground-muted hover:text-red"
                            title="移除该指标"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <span className="text-foreground-muted">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-1 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <AddStatInline
                      existingKeys={existingKeys}
                      onAdd={(key) => onAddStat(section, cr.id, key)}
                    />
                    <button
                      onClick={() => onRemoveCreator(cr.id)}
                      className="rounded px-1.5 py-0.5 text-[10px] text-foreground-muted hover:bg-red/10 hover:text-red"
                    >
                      移除
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** 行内添加指标：紧凑下拉。 */
function AddStatInline({
  existingKeys,
  onAdd,
}: {
  existingKeys: (string | undefined)[];
  onAdd: (metricKey: string) => void;
}) {
  const available = CREATOR_METRIC_CATALOG.filter((m) => !existingKeys.includes(m.key));
  if (available.length === 0) return null;
  return (
    <select
      value=""
      onChange={(e) => {
        if (e.target.value) onAdd(e.target.value);
      }}
      className="rounded border border-border-default bg-surface-primary px-1 py-0.5 text-[10px] text-foreground-secondary"
      title="添加指标"
    >
      <option value="">+ 指标</option>
      {available.map((m) => (
        <option key={m.key} value={m.key}>
          {m.label}
        </option>
      ))}
    </select>
  );
}

/** 从上游 Creator 构造默认 KPI 统计条（followers + engagement）。 */
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

/** 达人合作作品表格：按达人分组，展示每条作品的曝光/互动/互动率等指标。 */
function CreatorWorksTable({ works }: { works: CreatorWithWorks[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const totalPosts = works.reduce((sum, w) => sum + w.posts.length, 0);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="overflow-auto rounded border border-border-default">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-border-default bg-surface-hover text-foreground-muted">
            <th className="px-2 py-1 text-left font-normal">达人</th>
            <th className="px-2 py-1 text-left font-normal">平台</th>
            <th className="px-2 py-1 text-center font-normal">作品</th>
            <th className="px-2 py-1 text-right font-normal">总曝光</th>
            <th className="px-2 py-1 text-right font-normal">总互动</th>
            <th className="px-2 py-1 text-right font-normal">平均互动率</th>
            <th className="px-2 py-1 text-center font-normal">展开</th>
          </tr>
        </thead>
        <tbody>
          {works.map((cw) => {
            const isOpen = expanded.has(cw.creatorId);
            const totalImpressions = cw.posts.reduce(
              (s, p) => s + Number(p.impressions.replace(/[^0-9.]/g, '')) || 0,
              0,
            );
            const totalEngagement = cw.posts.reduce((s, p) => {
              const likes = Number(p.likes.replace(/[^0-9.]/g, '')) || 0;
              const comments = Number(p.comments.replace(/[^0-9.]/g, '')) || 0;
              const shares = Number(p.shares.replace(/[^0-9.]/g, '')) || 0;
              return s + likes + comments + shares;
            }, 0);
            const avgEngRate =
              cw.posts.length > 0
                ? cw.posts.reduce((s, p) => {
                    const r = Number(p.engagementRate.replace(/[^0-9.]/g, '')) || 0;
                    return s + r;
                  }, 0) / cw.posts.length
                : 0;
            return (
              <Fragment key={cw.creatorId}>
                <tr className="border-b border-border-subtle hover:bg-surface-hover/50">
                  <td className="px-2 py-1 text-left font-medium text-foreground-primary whitespace-nowrap">
                    {cw.creatorName}
                    <span className="ml-1 text-[10px] font-normal text-foreground-muted">{cw.tier}</span>
                  </td>
                  <td className="px-2 py-1 text-left text-foreground-secondary whitespace-nowrap">{cw.platform}</td>
                  <td className="px-2 py-1 text-center text-foreground-secondary">{cw.posts.length}</td>
                  <td className="px-2 py-1 text-right text-foreground-secondary tabular-nums">
                    {totalImpressions.toLocaleString()}
                  </td>
                  <td className="px-2 py-1 text-right text-foreground-secondary tabular-nums">
                    {totalEngagement.toLocaleString()}
                  </td>
                  <td className="px-2 py-1 text-right text-foreground-secondary tabular-nums">
                    {avgEngRate.toFixed(1)}%
                  </td>
                  <td className="px-2 py-1 text-center">
                    <button
                      onClick={() => toggle(cw.creatorId)}
                      className="text-[10px] text-accent-primary hover:underline"
                    >
                      {isOpen ? '收起' : `查看 ${cw.posts.length} 条`}
                    </button>
                  </td>
                </tr>
                {isOpen && cw.collab && (
                  <tr className="border-b border-border-subtle bg-accent-primary/5">
                    <td colSpan={7} className="px-3 py-2">
                      <div className="grid grid-cols-4 gap-x-4 gap-y-1 text-[11px]">
                        <div><span className="text-foreground-muted">合作方式：</span><span className="font-medium text-foreground-primary">{cw.collab.collabType}</span></div>
                        <div><span className="text-foreground-muted">合作状态：</span><span className="font-medium text-foreground-primary">{cw.collab.status}</span></div>
                        <div><span className="text-foreground-muted">内容形式：</span><span className="text-foreground-secondary">{cw.collab.contentType}</span></div>
                        <div><span className="text-foreground-muted">合同金额：</span><span className="font-medium text-foreground-primary">{cw.collab.contractFee}</span></div>
                        <div><span className="text-foreground-muted">投放周期：</span><span className="text-foreground-secondary">{cw.collab.period}</span></div>
                        <div><span className="text-foreground-muted">预估曝光：</span><span className="text-foreground-secondary tabular-nums">{cw.collab.estImpressions}</span></div>
                        <div><span className="text-foreground-muted">实际曝光：</span><span className="font-medium text-foreground-primary tabular-nums">{cw.collab.actualImpressions}</span></div>
                        <div><span className="text-foreground-muted">品牌提及：</span><span className="text-foreground-secondary">{cw.collab.brandMentions} 次</span></div>
                        <div><span className="text-foreground-muted">CPE：</span><span className="text-foreground-secondary tabular-nums">{cw.collab.cpe}</span></div>
                        <div><span className="text-foreground-muted">CPM：</span><span className="text-foreground-secondary tabular-nums">{cw.collab.cpm}</span></div>
                        <div><span className="text-foreground-muted">ROI：</span><span className="font-medium text-accent-primary tabular-nums">{cw.collab.roi}</span></div>
                        <div><span className="text-foreground-muted">链接点击：</span><span className="text-foreground-secondary tabular-nums">{cw.collab.linkClicks}</span></div>
                        <div className="col-span-4 mt-1 border-t border-border-subtle pt-1">
                          <span className="text-foreground-muted">评价：</span>
                          <span className="text-foreground-secondary">{'★'.repeat(cw.collab.rating)}{'☆'.repeat(5 - cw.collab.rating)} </span>
                          <span className="text-foreground-secondary">{cw.collab.comment}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                {isOpen &&
                  cw.posts.map((post) => (
                    <tr key={post.postId} className="border-b border-border-subtle bg-surface-hover/30">
                      <td className="px-2 py-1 pl-6 text-left text-foreground-secondary" colSpan={2}>
                        <div className="flex items-center gap-2">
                          {post.cover && (
                            <img
                              src={post.cover}
                              alt=""
                              className="h-8 w-8 flex-shrink-0 rounded object-cover"
                            />
                          )}
                          <div className="min-w-0">
                            <div className="truncate text-foreground-primary" title={post.title}>
                              {post.title}
                            </div>
                            <div className="text-[10px] text-foreground-muted">
                              {post.platform} · {post.publishedAt}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-1 text-center text-foreground-muted">—</td>
                      <td className="px-2 py-1 text-right tabular-nums text-foreground-secondary">{post.impressions}</td>
                      <td className="px-2 py-1 text-right tabular-nums text-foreground-secondary">
                        {(
                          (Number(post.likes.replace(/[^0-9.]/g, '')) || 0) +
                          (Number(post.comments.replace(/[^0-9.]/g, '')) || 0) +
                          (Number(post.shares.replace(/[^0-9.]/g, '')) || 0)
                        ).toLocaleString()}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums text-foreground-secondary">{post.engagementRate}</td>
                      <td className="px-2 py-1 text-center">
                        <div className="flex flex-col items-end gap-0.5 text-[10px] text-foreground-muted">
                          <span>👍 {post.likes}</span>
                          <span>💬 {post.comments}</span>
                          <span>↗ {post.shares}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <div className="border-t border-border-default px-2 py-1 text-[10px] text-foreground-muted">
        共 {works.length} 位达人 · {totalPosts} 条合作作品
      </div>
    </div>
  );
}
