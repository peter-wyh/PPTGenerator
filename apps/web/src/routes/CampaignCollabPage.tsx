/**
 * Campaign 合作列表页 —— 展示所有 Campaign × Creator 合作关系。
 * 独立路由页面（/data/campaign-collabs）。
 * 支持 URL search params ?campaign=xxx 自动筛选。
 *
 * 表格行 = Campaign × Creator，达人信息/合作方式/作品类型/效果指标累加全部平铺在列中。
 * 点击行展开后显示每部作品的详细数据（CollaborationDetail）。
 */
import { Fragment, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { campaignsApi, dtoToCampaign, dtoToCreator } from '@/api/campaignsApi';
import type { Campaign, Creator } from '@mediaket/shared';
import { getCollaboration, saveCollaboration } from '@/api/collaborations';
import { collaborationLabel, type CollaborationData, type CollaborationDeliverable } from '@mediaket/shared';
import { buildSeedCollaboration } from '@/api/mock/collaborationSeed';

/* ============================= 类型 ============================= */

interface CollabRow {
  linkId: string;
  campaign: Campaign;
  campaignId: string;
  creator: Creator;
  creatorId: string;
  collabType: string | null;
  status: string | null;
  contentType: string | null;
  /** 加载后填充 */
  collabData?: CollaborationData | null;
}

/* ============================= 页面 ============================= */

export function CampaignCollabPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const campaignFilterParam = searchParams.get('campaign') ?? location.state?.campaignId ?? '';

  const [rows, setRows] = useState<CollabRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCampaign, setFilterCampaign] = useState(campaignFilterParam);
  const [filterCreator, setFilterCreator] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [editingLink, setEditingLink] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (filterCampaign) {
      setSearchParams((prev) => { prev.set('campaign', filterCampaign); return prev; }, { replace: true });
    } else {
      setSearchParams((prev) => { prev.delete('campaign'); return prev; }, { replace: true });
    }
  }, [filterCampaign, setSearchParams]);

  /** 加载所有 campaign × creator link + 每行的合作详情 */
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const campaigns = await campaignsApi.list();
      const allRows: CollabRow[] = [];
      await Promise.all(
        campaigns.map(async (c) => {
          const links = await campaignsApi.listLinks(c.id);
          // 并行加载每条 link 的合作详情
          const rowsWithCollab = await Promise.all(
            links.filter((l) => l.creator).map(async (link) => {
              let collabData: CollaborationData | null = null;
              try {
                collabData = await getCollaboration(c.id, link.creatorId);
              } catch {
                collabData = null;
              }
              if (!collabData) {
                collabData = buildSeedCollaboration(c.id, link.creatorId);
              }
              return {
                linkId: link.id,
                campaignId: c.id,
                campaign: dtoToCampaign(c),
                creatorId: link.creatorId,
                creator: dtoToCreator(link.creator!),
                collabType: link.collabType,
                status: link.status,
                contentType: link.contentType,
                collabData,
              } satisfies CollabRow;
            }),
          );
          allRows.push(...rowsWithCollab);
        }),
      );
      setRows(allRows);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload, tick]);

  const filtered = rows.filter((r) => {
    if (filterCampaign && !r.campaign.name.toLowerCase().includes(filterCampaign.toLowerCase()) && r.campaignId !== filterCampaign) return false;
    if (filterCreator && !r.creator.name.toLowerCase().includes(filterCreator.toLowerCase())) return false;
    if (filterStatus && (r.status ?? '—') !== filterStatus) return false;
    return true;
  });

  const statusSet = [...new Set(rows.map((r) => r.status ?? '—').filter(Boolean))];

  if (loading) {
    return <p className="text-sm text-foreground-muted">加载合作列表…</p>;
  }

  const heads = [
    '#', 'Campaign', '达人', 'Handle', '平台', '层级',
    '粉丝', '互动率', '类目', '地区',
    '合作方式', '作品类型', 'Views', 'Likes', 'Comments', 'Shares',
    '状态', '',
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-foreground-secondary">
          共 <span className="font-medium text-foreground-primary">{filtered.length}</span> 条合作关系
          {filterCampaign && (
            <span className="ml-2">
              · 筛选: <span className="text-accent-primary">{filterCampaign}</span>
              <button onClick={() => setFilterCampaign('')} className="ml-1 text-foreground-muted hover:text-foreground-primary">✕</button>
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            placeholder="搜索 Campaign…"
            value={filterCampaign}
            onChange={(e) => setFilterCampaign(e.target.value)}
            className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary placeholder:text-foreground-muted w-36"
          />
          <input
            placeholder="搜索达人…"
            value={filterCreator}
            onChange={(e) => setFilterCreator(e.target.value)}
            className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary placeholder:text-foreground-muted w-36"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-secondary"
          >
            <option value="">全部状态</option>
            {statusSet.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-foreground-muted">暂无合作关系数据。</p>
      ) : (
        <div className="overflow-auto rounded-lg border border-border-default">
          <table className="w-full min-w-[1600px] border-collapse text-xs">
            <thead>
              <tr className="bg-surface-hover text-left text-[10px] text-foreground-muted">
                {heads.map((h, i) => (
                  <th key={i} className={`px-2 py-2 font-medium whitespace-nowrap ${i === 0 ? 'sticky left-0 z-10 bg-surface-hover' : ''} ${i === heads.length - 1 ? 'sticky right-0 z-10 bg-surface-hover text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => {
                const open = expandedRow === r.linkId;
                const editing = editingLink === r.linkId;
                const agg = aggregateMetrics(r.collabData?.deliverables);
                const contentTypes = r.collabData?.deliverables.map((d) => d.contentType) ?? [];
                const collabLabel = r.collabData ? collaborationLabel(r.collabData) : (r.collabType ?? '—');
                return (
                  <Fragment key={r.linkId}>
                    <tr className={`border-t border-border-subtle hover:bg-surface-hover/50 ${open ? 'bg-surface-hover/20' : ''}`}>
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-surface-primary px-2 py-2 font-mono text-[10px] tabular-nums text-foreground-muted hover:bg-surface-hover/50">{idx + 1}</td>
                      <td className="whitespace-nowrap px-2 py-2 font-medium text-foreground-primary">{r.campaign.name}</td>
                      <td className="whitespace-nowrap px-2 py-2 font-medium text-foreground-primary">{r.creator.name}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{r.creator.handle}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{r.creator.platform}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{r.creator.tier}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{r.creator.followers}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{r.creator.engagement}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{r.creator.category || '—'}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{r.creator.region || '—'}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{collabLabel}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1">
                          {contentTypes.length === 0 ? (
                            <span className="text-foreground-muted">—</span>
                          ) : contentTypes.map((t, i) => (
                            <span key={i} className="inline-block rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-secondary">{t}</span>
                          ))}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 tabular-nums text-foreground-secondary">{agg.views}</td>
                      <td className="whitespace-nowrap px-2 py-2 tabular-nums text-foreground-secondary">{agg.likes}</td>
                      <td className="whitespace-nowrap px-2 py-2 tabular-nums text-foreground-secondary">{agg.comments}</td>
                      <td className="whitespace-nowrap px-2 py-2 tabular-nums text-foreground-secondary">{agg.shares}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{r.status ?? '—'}</td>
                      <td className="sticky right-0 z-10 whitespace-nowrap bg-surface-primary px-2 py-2 text-right hover:bg-surface-hover/50">
                        <button
                          onClick={() => { setExpandedRow(open ? null : r.linkId); if (open) setEditingLink(null); }}
                          className="text-[10px] text-accent-primary hover:underline"
                        >
                          {open ? '收起' : '详情'}
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={heads.length} className="bg-surface-primary px-4 py-3">
                          <CollabExpandedRow
                            row={r}
                            editing={editing}
                            onToggleEdit={() => setEditingLink(editing ? null : r.linkId)}
                            onUpdate={() => { setExpandedRow(null); setEditingLink(null); setTick((t) => t + 1); }}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ============================= 展开行 ============================= */

function CollabExpandedRow({
  row,
  editing,
  onToggleEdit,
  onUpdate,
}: {
  row: CollabRow;
  editing: boolean;
  onToggleEdit: () => void;
  onUpdate: () => void;
}) {
  const [collabData, setCollabData] = useState<CollaborationData>(row.collabData ?? buildSeedCollaboration(row.campaignId, row.creatorId));
  const [collabType, setCollabType] = useState(row.collabType ?? '');
  const [status, setStatus] = useState(row.status ?? '');
  const [busy, setBusy] = useState(false);

  const creator = row.creator;
  const metrics = creator.metrics ?? [];

  async function save() {
    setBusy(true);
    try {
      // 保存 link 字段
      await campaignsApi.updateLink(row.linkId, {
        collabType: collabType || undefined,
        status: status || undefined,
      });
      // 保存合作详情
      await saveCollaboration(collabData);
      onUpdate();
    } catch {
      window.alert('保存失败');
    } finally {
      setBusy(false);
    }
  }

  function patch(fn: (d: CollaborationData) => CollaborationData) {
    setCollabData((prev) => fn(prev));
  }
  const setDeliverable = (i: number, del: CollaborationDeliverable) =>
    patch((d) => ({ ...d, deliverables: d.deliverables.map((x, idx) => (idx === i ? del : x)) }));
  const removeDeliverable = (i: number) =>
    patch((d) => ({ ...d, deliverables: d.deliverables.filter((_, idx) => idx !== i) }));
  const addDeliverable = () =>
    patch((d) => ({ ...d, deliverables: [...d.deliverables, { contentType: 'post' }] }));

  return (
    <div className="text-xs">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold text-foreground-primary">
          {row.creator.name} × {row.campaign.name}
        </span>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button disabled={busy} onClick={() => void save()} className="rounded bg-accent-primary px-3 py-1 text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50">保存</button>
              <button onClick={onToggleEdit} className="text-foreground-secondary hover:underline">取消</button>
            </>
          ) : (
            <button onClick={onToggleEdit} className="text-accent-primary hover:underline">编辑</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* 左侧：达人频道 KPI（占 4 列） */}
        <div className="col-span-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">频道 KPI</div>
          {metrics.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {metrics.map((m, i) => (
                <div key={`${m.label}-${i}`} className="rounded-md border border-border-subtle p-2">
                  <div className="text-[10px] text-foreground-muted">{m.label}</div>
                  <div className="text-sm font-semibold text-foreground-primary">{m.value}</div>
                  {m.compare && <div className="text-[10px] text-foreground-secondary">{m.compare}</div>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-foreground-muted">—</p>
          )}
        </div>

        {/* 中间：Campaign 信息（占 3 列） */}
        <div className="col-span-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Campaign</div>
          <div className="rounded-lg border border-border-subtle p-3 space-y-1.5">
            <div className="font-medium text-foreground-primary">{row.campaign.name}</div>
            <div className="text-foreground-secondary">{row.campaign.businessLine}</div>
            <div className="text-foreground-secondary">{row.campaign.platform}</div>
            <div className="text-foreground-secondary">{row.campaign.startDate} ~ {row.campaign.endDate}</div>
            <div className="text-foreground-secondary">{row.campaign.budget}</div>
          </div>
          {/* 合作字段编辑 */}
          <div className="mt-3 space-y-2">
            {editing && (
              <>
                <label className="flex flex-col gap-0.5 text-foreground-secondary">
                  <span className="text-[10px]">合作方式</span>
                  <input value={collabType} onChange={(e) => setCollabType(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1" />
                </label>
                <label className="flex flex-col gap-0.5 text-foreground-secondary">
                  <span className="text-[10px]">状态</span>
                  <input value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1" />
                </label>
              </>
            )}
          </div>
        </div>

        {/* 右侧：作品明细（占 5 列） */}
        <div className="col-span-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">作品明细</span>
            {editing && (
              <button onClick={addDeliverable} className="text-accent-primary hover:underline">+ 添加</button>
            )}
          </div>
          {collabData.deliverables.length === 0 ? (
            <p className="text-foreground-muted">未设置作品。</p>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-auto">
              {collabData.deliverables.map((del, i) => (
                <DeliverableCard
                  key={`${del.contentType}-${i}`}
                  deliverable={del}
                  index={i}
                  editing={editing}
                  onChange={(d) => setDeliverable(i, d)}
                  onRemove={() => removeDeliverable(i)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================= 作品卡片 ============================= */

function DeliverableCard({
  deliverable,
  index,
  editing,
  onChange,
  onRemove,
}: {
  deliverable: CollaborationDeliverable;
  index: number;
  editing: boolean;
  onChange: (d: CollaborationDeliverable) => void;
  onRemove: () => void;
}) {
  const { contentType, screenshots = [], metrics = [], audience, wordcloud = [] } = deliverable;
  const CONTENT_TYPES: string[] = ['post', 'reels', 'video', 'image', 'live', 'story'];

  const patch = (p: Partial<CollaborationDeliverable>) => onChange({ ...deliverable, ...p });
  const setScreenshots = (s: typeof screenshots) => patch({ screenshots: s });
  const setMetrics = (m: typeof metrics) => patch({ metrics: m });
  const setWords = (w: typeof wordcloud) => patch({ wordcloud: w });

  return (
    <div className="rounded border border-border-subtle p-3">
      <div className="mb-2 flex items-center gap-2">
        {editing ? (
          <select
            value={contentType}
            onChange={(e) => patch({ contentType: e.target.value as CollaborationDeliverable['contentType'] })}
            className="rounded border border-border-default px-1.5 py-0.5"
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        ) : (
          <span className="rounded bg-surface-hover px-1.5 py-0.5 font-medium text-foreground-primary">{contentType}</span>
        )}
        <span className="text-foreground-muted text-[10px]">#{index + 1}</span>
        {editing && (
          <button onClick={onRemove} className="ml-auto text-red hover:underline text-[10px]">移除</button>
        )}
      </div>

      {/* 截图 */}
      <div className="mb-2">
        <div className="flex items-center gap-1 text-[10px] text-foreground-secondary mb-1">
          <span>作品截图</span>
          {editing && (
            <button onClick={() => setScreenshots([...screenshots, { src: '' }])} className="text-accent-primary hover:underline">+ 添加</button>
          )}
        </div>
        {screenshots.length === 0 ? (
          <span className="text-foreground-muted">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {screenshots.map((s, i) => (
              <div key={i} className="flex items-center gap-1">
                {s.src ? (
                  <img src={s.src} alt="" className="h-8 w-8 rounded object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded bg-surface-hover flex items-center justify-center text-[8px] text-foreground-muted">N/A</div>
                )}
                {editing && (
                  <>
                    <input
                      value={s.src}
                      placeholder="URL"
                      onChange={(e) => setScreenshots(screenshots.map((x, idx) => (idx === i ? { ...x, src: e.target.value } : x)))}
                      className="w-28 rounded border border-border-default bg-surface-primary px-1 py-0.5"
                    />
                    <input
                      value={s.caption ?? ''}
                      placeholder="说明"
                      onChange={(e) => setScreenshots(screenshots.map((x, idx) => (idx === i ? { ...x, caption: e.target.value } : x)))}
                      className="w-16 rounded border border-border-default bg-surface-primary px-1 py-0.5"
                    />
                    <button onClick={() => setScreenshots(screenshots.filter((_, idx) => idx !== i))} className="text-red">✕</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 效果数据 */}
      <div className="mb-2">
        <div className="flex items-center gap-1 text-[10px] text-foreground-secondary mb-1">
          <span>效果数据</span>
          {editing && (
            <button onClick={() => setMetrics([...metrics, { label: '', value: '' }])} className="text-accent-primary hover:underline">+ 添加</button>
          )}
        </div>
        {metrics.length === 0 ? (
          <span className="text-foreground-muted">—</span>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            {metrics.map((m, i) => editing ? (
              <div key={i} className="flex items-center gap-1">
                <input
                  value={m.label}
                  placeholder="指标"
                  onChange={(e) => setMetrics(metrics.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
                  className="w-16 rounded border border-border-default bg-surface-primary px-1 py-0.5"
                />
                <input
                  value={m.value}
                  placeholder="数值"
                  onChange={(e) => setMetrics(metrics.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))}
                  className="w-20 rounded border border-border-default bg-surface-primary px-1 py-0.5"
                />
                <button onClick={() => setMetrics(metrics.filter((_, idx) => idx !== i))} className="text-red">✕</button>
              </div>
            ) : (
              <div key={i} className="rounded bg-surface-hover px-2 py-1">
                <span className="text-foreground-muted">{m.label}</span>{' '}
                <span className="font-medium text-foreground-primary">{m.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 评论词云 */}
      {wordcloud.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center gap-1 text-[10px] text-foreground-secondary mb-1">
            <span>评论词云</span>
            {editing && (
              <button onClick={() => setWords([...wordcloud, { text: '', weight: 50, sentiment: 'neutral' }])} className="text-accent-primary hover:underline">+ 添加</button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {wordcloud.map((w, i) => (
              <span key={i} className={`rounded px-1.5 py-0.5 text-[10px] ${w.sentiment === 'pos' ? 'bg-green/10 text-green' : w.sentiment === 'neg' ? 'bg-red/10 text-red' : 'bg-surface-hover text-foreground-secondary'}`}>
                {w.text} ({w.weight})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 受众画像 */}
      {audience && (
        <div>
          <div className="text-[10px] text-foreground-secondary mb-1">受众画像</div>
          <div className="grid grid-cols-2 gap-2">
            {audience.topCities?.length ? (
              <div className="rounded bg-surface-hover p-1.5">
                <div className="text-[9px] text-foreground-muted">城市</div>
                {audience.topCities.map((c, i) => (
                  <div key={i} className="text-[10px]"><span className="text-foreground-secondary">{c.label}</span> <span className="text-foreground-primary">{c.value}%</span></div>
                ))}
              </div>
            ) : null}
            {audience.genderSplit?.length ? (
              <div className="rounded bg-surface-hover p-1.5">
                <div className="text-[9px] text-foreground-muted">性别</div>
                {audience.genderSplit.map((g, i) => (
                  <div key={i} className="text-[10px]"><span className="text-foreground-secondary">{g.label}</span> <span className="text-foreground-primary">{g.value}%</span></div>
                ))}
              </div>
            ) : null}
            {audience.ageRange?.length ? (
              <div className="rounded bg-surface-hover p-1.5">
                <div className="text-[9px] text-foreground-muted">年龄</div>
                {audience.ageRange.map((a, i) => (
                  <div key={i} className="text-[10px]"><span className="text-foreground-secondary">{a.label}</span> <span className="text-foreground-primary">{a.value}%</span></div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================= 工具函数 ============================= */

/** 从所有 deliverables 的 metrics 中累加 Views/Likes/Comments/Shares */
function aggregateMetrics(deliverables?: CollaborationDeliverable[]): { views: string; likes: string; comments: string; shares: string } {
  if (!deliverables?.length) return { views: '—', likes: '—', comments: '—', shares: '—' };

  const sum = new Map<string, number>();
  for (const del of deliverables) {
    for (const m of del.metrics ?? []) {
      const label = m.label.toLowerCase();
      const num = parseMetricValue(m.value);
      if (num === null) continue;
      // 合并同义标签
      const key = label.includes('view') ? 'views'
        : label.includes('like') ? 'likes'
        : label.includes('comment') ? 'comments'
        : label.includes('share') ? 'shares'
        : label;
      sum.set(key, (sum.get(key) ?? 0) + num);
    }
  }

  const fmt = (v: number) => {
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K';
    return String(v);
  };

  return {
    views: sum.has('views') ? fmt(sum.get('views')!) : '—',
    likes: sum.has('likes') ? fmt(sum.get('likes')!) : '—',
    comments: sum.has('comments') ? fmt(sum.get('comments')!) : '—',
    shares: sum.has('shares') ? fmt(sum.get('shares')!) : '—',
  };
}

/** 解析 metric value 字符串为数字（支持 "1.2M" / "45K" / "12,345" / "1234"） */
function parseMetricValue(value: string): number | null {
  if (!value || value === '—') return null;
  const s = value.trim().replace(/,/g, '');
  if (s.endsWith('M') || s.endsWith('m')) return parseFloat(s) * 1_000_000;
  if (s.endsWith('K') || s.endsWith('k')) return parseFloat(s) * 1_000;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
