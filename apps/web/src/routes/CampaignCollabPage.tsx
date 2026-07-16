/**
 * Campaign 合作列表页 —— 展示所有 Campaign × Creator 合作关系。
 * 独立路由页面（/data/campaign-collabs）。
 * 支持 URL search params ?campaign=xxx 自动筛选。
 *
 * 表格行 = Campaign × Creator，达人头像/合作方式/作品截图/效果指标累加全部平铺在列中。
 * 点击「详情」打开右侧浮窗，展示每部作品的详细数据。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { campaignsApi, dtoToCampaign, dtoToCreator } from '@/api/campaignsApi';
import type { Campaign, Creator } from '@mediaket/shared';
import { getCollaboration, saveCollaboration } from '@/api/collaborations';
import { collaborationLabel, type CollaborationData, type CollaborationDeliverable } from '@mediaket/shared';
import { buildSeedCollaboration } from '@/api/mock/collaborationSeed';
import { CreatorAvatar } from '@/components/CreatorAvatar';

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
  const [drawerRow, setDrawerRow] = useState<CollabRow | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (filterCampaign) {
      setSearchParams((prev) => { prev.set('campaign', filterCampaign); return prev; }, { replace: true });
    } else {
      setSearchParams((prev) => { prev.delete('campaign'); return prev; }, { replace: true });
    }
  }, [filterCampaign, setSearchParams]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const campaigns = await campaignsApi.list();
      const allRows: CollabRow[] = [];
      await Promise.all(
        campaigns.map(async (c) => {
          const links = await campaignsApi.listLinks(c.id);
          const rowsWithCollab = await Promise.all(
            links.filter((l) => l.creator).map(async (link) => {
              let collabData: CollaborationData | null = null;
              try {
                collabData = await getCollaboration(c.id, link.creatorId);
              } catch {
                collabData = null;
              }
              if (!collabData || !collabData.deliverables?.length) {
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
    '合作方式', '作品(截图+数据)', '',
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
          <table className="w-full min-w-[1400px] border-collapse text-xs">
            <thead>
              <tr className="bg-surface-hover text-left text-[10px] text-foreground-muted">
                {heads.map((h, i) => (
                  <th key={i} className={`px-2 py-2 font-medium whitespace-nowrap ${i === 0 ? 'sticky left-0 z-10 bg-surface-hover' : ''} ${i === heads.length - 1 ? 'sticky right-0 z-10 bg-surface-hover text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => {
                const agg = aggregateMetrics(r.collabData?.deliverables);
                const collabLabel = r.collabData ? collaborationLabel(r.collabData) : (r.collabType ?? '—');
                const deliverables = r.collabData?.deliverables ?? [];
                // 每个 deliverable 的单项指标
                const perDel = deliverables.map((d) => aggregateMetrics([d]));
                return (
                  <tr key={r.linkId} className="border-t border-border-subtle hover:bg-surface-hover/50">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-surface-primary px-2 py-2 font-mono text-[10px] tabular-nums text-foreground-muted hover:bg-surface-hover/50">{idx + 1}</td>
                    <td className="whitespace-nowrap px-2 py-2 font-medium text-foreground-primary">{r.campaign.name}</td>
                    {/* 达人带头像 */}
                    <td className="whitespace-nowrap px-2 py-2">
                      <div className="flex items-center gap-1.5">
                        <CreatorAvatar name={r.creator.name} avatar={r.creator.avatar} size={28} />
                        <span className="font-medium text-foreground-primary">{r.creator.name}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{r.creator.handle}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{r.creator.platform}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{r.creator.tier}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{r.creator.followers}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{r.creator.engagement}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{r.creator.category || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{r.creator.region || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{collabLabel}</td>
                    {/* 作品列：每个作品一行（截图 + type + 单品数据） */}
                    <td className="px-2 py-2 min-w-[320px]">
                      {deliverables.length === 0 ? (
                        <span className="text-foreground-muted">—</span>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {/* 汇总行 */}
                          <div className="flex items-center gap-2 rounded bg-surface-hover px-1.5 py-1">
                            <span className="text-[9px] text-foreground-muted">合计({deliverables.length}作品)</span>
                            <MetricBadge label="Views" value={agg.views} />
                            <MetricBadge label="Likes" value={agg.likes} />
                            <MetricBadge label="Comments" value={agg.comments} />
                            <MetricBadge label="Shares" value={agg.shares} />
                          </div>
                          {/* 每个作品一行 */}
                          {deliverables.map((del, di) => {
                            const shots = (del.screenshots ?? []).filter((s) => s.src).slice(0, 2);
                            const m = perDel[di];
                            return (
                              <div key={`${del.contentType}-${di}`} className="flex items-center gap-2 rounded border border-border-subtle px-1.5 py-1">
                                {/* 截图 */}
                                {shots.length > 0 ? (
                                  <div className="flex gap-0.5">
                                    {shots.map((s, si) => (
                                      <a key={si} href={s.url ?? s.src} target="_blank" rel="noopener noreferrer" title={s.caption ?? ''}>
                                        <img src={s.src} alt={s.caption ?? ''} className="h-8 w-8 rounded border border-border-subtle object-cover hover:opacity-80" />
                                      </a>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="flex h-8 w-8 items-center justify-center rounded bg-surface-hover text-[8px] text-foreground-muted">N/A</div>
                                )}
                                {/* type pill */}
                                <span className="rounded bg-surface-hover px-1 py-0.5 text-[10px] text-foreground-secondary">{del.contentType}</span>
                                {/* 单品指标 */}
                                <MetricBadge label="Views" value={m.views} dim />
                                <MetricBadge label="Likes" value={m.likes} dim />
                                <MetricBadge label="Comments" value={m.comments} dim />
                                <MetricBadge label="Shares" value={m.shares} dim />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    {/* 达人补充数据 */}
                    <td className="px-2 py-2 whitespace-nowrap text-foreground-secondary">
                      <div className="text-[10px]">
                        <div><span className="text-foreground-muted">近90天</span> {r.creator.recentPostsCount ?? '—'}</div>
                        <div><span className="text-foreground-muted">互动中位</span> {r.creator.engagementMedian ?? '—'}</div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-foreground-secondary">{r.status ?? '—'}</td>
                    <td className="sticky right-0 z-10 whitespace-nowrap bg-surface-primary px-2 py-2 text-right hover:bg-surface-hover/50">
                      <button onClick={() => setDrawerRow(r)} className="text-[10px] text-accent-primary hover:underline">详情</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 右侧浮窗 */}
      {drawerRow && (
        <CollabDrawer
          row={drawerRow}
          onClose={() => setDrawerRow(null)}
          onUpdate={() => { setDrawerRow(null); setTick((t) => t + 1); }}
        />
      )}
    </div>
  );
}

/* ============================= 右侧浮窗 ============================= */

function CollabDrawer({ row, onClose, onUpdate }: { row: CollabRow; onClose: () => void; onUpdate: () => void }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCloseRef.current(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const [collabData, setCollabData] = useState<CollaborationData>(row.collabData ?? buildSeedCollaboration(row.campaignId, row.creatorId));
  const [collabType, setCollabType] = useState(row.collabType ?? '');
  const [status, setStatus] = useState(row.status ?? '');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const creator = row.creator;
  const metrics = creator.metrics ?? [];

  async function save() {
    setBusy(true);
    try {
      await campaignsApi.updateLink(row.linkId, {
        collabType: collabType || undefined,
        status: status || undefined,
      });
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
    <div className="fixed inset-0 z-50 animate-fadeIn bg-black/40" onClick={onClose} role="presentation">
      <aside
        className="absolute right-0 top-0 flex h-full w-[680px] max-w-[92vw] animate-slideInRight flex-col bg-surface-primary shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="合作详情"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <CreatorAvatar name={creator.name} avatar={creator.avatar} size={36} />
            <div className="min-w-0">
              <div className="font-headings text-sm font-semibold text-foreground-primary truncate">{creator.name}</div>
              <div className="text-xs text-foreground-muted truncate">{row.campaign.name} · {creator.handle}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {editing ? (
              <>
                <button disabled={busy} onClick={() => void save()} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50">保存</button>
                <button onClick={() => setEditing(false)} className="text-xs text-foreground-secondary hover:underline">取消</button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="text-xs text-accent-primary hover:underline">编辑</button>
            )}
            <button onClick={onClose} aria-label="关闭" className="rounded p-1 text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary">✕</button>
          </div>
        </div>

        {/* 内容 */}
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {/* 达人信息卡 */}
          <div className="mb-4">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">达人信息</div>
            <div className="grid grid-cols-5 gap-px rounded-lg overflow-hidden border border-border-subtle">
              {([
                ['Platform', creator.platform],
                ['Tier', creator.tier],
                ['Followers', creator.followers],
                ['Engagement', creator.engagement],
                ['Category', creator.category],
                ['Region', creator.region],
                ['近90天作品', String(creator.recentPostsCount ?? '—')],
                ['互动中位数', creator.engagementMedian ?? '—'],
                ['合作方式', collaborationLabel(collabData)],
                ['状态', row.status ?? '—'],
              ] as const).map(([label, value]) => (
                <div key={label} className="bg-surface-primary p-2">
                  <div className="text-[10px] uppercase tracking-wide text-foreground-muted">{label}</div>
                  <div className="text-xs font-medium text-foreground-primary truncate">{value || '—'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 频道 KPI */}
          {metrics.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">频道 KPI</div>
              <div className="grid grid-cols-3 gap-2">
                {metrics.map((m, i) => (
                  <div key={`${m.label}-${i}`} className="rounded-md border border-border-subtle p-2.5">
                    <div className="text-[10px] text-foreground-muted">{m.label}</div>
                    <div className="text-sm font-semibold text-foreground-primary">{m.value}</div>
                    {m.compare && <div className="text-[10px] text-foreground-secondary">{m.compare}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 合作字段编辑 */}
          {editing && (
            <div className="mb-4 grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
                合作方式
                <input value={collabType} onChange={(e) => setCollabType(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
                状态
                <input value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1" />
              </label>
            </div>
          )}

          {/* 作品明细 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">作品明细 · {collabData.deliverables.length}</span>
              {editing && (
                <button onClick={addDeliverable} className="text-xs text-accent-primary hover:underline">+ 添加作品</button>
              )}
            </div>
            {collabData.deliverables.length === 0 ? (
              <p className="text-xs text-foreground-muted">未设置作品。</p>
            ) : (
              <div className="space-y-3">
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
      </aside>
    </div>
  );
}

/* ============================= 作品卡片 ============================= */

const CONTENT_TYPES: string[] = ['post', 'reels', 'video', 'image', 'live', 'story'];

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

  const patch = (p: Partial<CollaborationDeliverable>) => onChange({ ...deliverable, ...p });
  const setScreenshots = (s: typeof screenshots) => patch({ screenshots: s });
  const setMetrics = (m: typeof metrics) => patch({ metrics: m });
  const setWords = (w: typeof wordcloud) => patch({ wordcloud: w });

  // 查找是否有链接型截图（src 是 URL）
  const firstLink = screenshots.find((s) => s.src && s.src.startsWith('http'))?.src;

  return (
    <div className="rounded-lg border border-border-subtle p-3">
      <div className="mb-2 flex items-center gap-2">
        {editing ? (
          <select
            value={contentType}
            onChange={(e) => patch({ contentType: e.target.value as CollaborationDeliverable['contentType'] })}
            className="rounded border border-border-default px-1.5 py-0.5 text-xs"
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        ) : (
          <span className="rounded bg-surface-hover px-1.5 py-0.5 font-medium text-foreground-primary">{contentType}</span>
        )}
        <span className="text-foreground-muted text-[10px]">#{index + 1}</span>
        {firstLink && !editing && (
          <a href={firstLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent-primary hover:underline">↗ 作品链接</a>
        )}
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
                  <a href={s.url ?? s.src} target="_blank" rel="noopener noreferrer" title={s.caption ?? ''}>
                    <img src={s.src} alt={s.caption ?? ''} className="h-12 w-12 rounded border border-border-subtle object-cover hover:opacity-80" />
                  </a>
                ) : (
                  <div className="h-12 w-12 rounded bg-surface-hover flex items-center justify-center text-[8px] text-foreground-muted">N/A</div>
                )}
                {editing && (
                  <div className="flex flex-col gap-0.5">
                    <input
                      value={s.src}
                      placeholder="图片 URL"
                      onChange={(e) => setScreenshots(screenshots.map((x, idx) => (idx === i ? { ...x, src: e.target.value } : x)))}
                      className="w-28 rounded border border-border-default bg-surface-primary px-1 py-0.5"
                    />
                    <input
                      value={s.caption ?? ''}
                      placeholder="说明"
                      onChange={(e) => setScreenshots(screenshots.map((x, idx) => (idx === i ? { ...x, caption: e.target.value } : x)))}
                      className="w-28 rounded border border-border-default bg-surface-primary px-1 py-0.5"
                    />
                    <button onClick={() => setScreenshots(screenshots.filter((_, idx) => idx !== i))} className="text-red text-[10px]">✕ 删除</button>
                  </div>
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
                  className="w-20 rounded border border-border-default bg-surface-primary px-1 py-0.5"
                />
                <input
                  value={m.value}
                  placeholder="数值"
                  onChange={(e) => setMetrics(metrics.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))}
                  className="w-24 rounded border border-border-default bg-surface-primary px-1 py-0.5"
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
            {wordcloud.map((w, i) => editing ? (
              <div key={i} className="flex items-center gap-0.5">
                <input
                  value={w.text}
                  placeholder="词"
                  onChange={(e) => setWords(wordcloud.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)))}
                  className="w-16 rounded border border-border-default bg-surface-primary px-1 py-0.5"
                />
                <input
                  type="number"
                  value={w.weight}
                  onChange={(e) => setWords(wordcloud.map((x, idx) => (idx === i ? { ...x, weight: Number(e.target.value) } : x)))}
                  className="w-12 rounded border border-border-default bg-surface-primary px-1 py-0.5"
                />
                <select
                  value={w.sentiment}
                  onChange={(e) => setWords(wordcloud.map((x, idx) => (idx === i ? { ...x, sentiment: e.target.value as typeof w.sentiment } : x)))}
                  className="rounded border border-border-default bg-surface-primary px-1 py-0.5"
                >
                  <option value="pos">pos</option>
                  <option value="neg">neg</option>
                  <option value="neutral">neutral</option>
                </select>
                <button onClick={() => setWords(wordcloud.filter((_, idx) => idx !== i))} className="text-red">✕</button>
              </div>
            ) : (
              <span key={i} className={`rounded px-1.5 py-0.5 text-[10px] ${w.sentiment === 'pos' ? 'bg-green/10 text-green' : w.sentiment === 'neg' ? 'bg-red/10 text-red' : 'bg-surface-hover text-foreground-secondary'}`}>
                {w.text} ({w.weight})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 受众画像 */}
      {audience && (audience.topCities?.length || audience.genderSplit?.length || audience.ageRange?.length) && (
        <div>
          <div className="text-[10px] text-foreground-secondary mb-1">受众画像</div>
          <div className="grid grid-cols-3 gap-2">
            {audience.topCities?.length ? (
              <div className="rounded bg-surface-hover p-1.5">
                <div className="text-[9px] text-foreground-muted mb-0.5">城市</div>
                {audience.topCities.map((c, i) => (
                  <div key={i} className="text-[10px]"><span className="text-foreground-secondary">{c.label}</span> <span className="text-foreground-primary">{c.value}%</span></div>
                ))}
              </div>
            ) : null}
            {audience.genderSplit?.length ? (
              <div className="rounded bg-surface-hover p-1.5">
                <div className="text-[9px] text-foreground-muted mb-0.5">性别</div>
                {audience.genderSplit.map((g, i) => (
                  <div key={i} className="text-[10px]"><span className="text-foreground-secondary">{g.label}</span> <span className="text-foreground-primary">{g.value}%</span></div>
                ))}
              </div>
            ) : null}
            {audience.ageRange?.length ? (
              <div className="rounded bg-surface-hover p-1.5">
                <div className="text-[9px] text-foreground-muted mb-0.5">年龄</div>
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

/* ============================= 小组件 ============================= */

/** 指标 badge：label + value，dim 模式用淡色 */
function MetricBadge({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-0.5 whitespace-nowrap text-[10px] tabular-nums ${dim ? 'text-foreground-secondary' : 'font-medium text-foreground-primary'}`}>
      <span className="text-foreground-muted">{label}</span>
      <span>{value}</span>
    </span>
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
      const key = label.includes('view') || label.includes('曝光') || label.includes('impr') ? 'views'
        : label.includes('like') || label.includes('点赞') ? 'likes'
        : label.includes('comment') || label.includes('评论') ? 'comments'
        : label.includes('share') || label.includes('分享') ? 'shares'
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
