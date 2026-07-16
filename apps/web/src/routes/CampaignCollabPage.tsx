/**
 * Campaign 合作列表页 —— 展示所有 Campaign × Creator 合作关系 + 达人完整合作详情。
 * 独立路由页面（/data/campaign-collabs）。
 * 支持 URL search params ?campaign=xxx 自动筛选。
 */
import { Fragment, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { campaignsApi, dtoToCampaign, dtoToCreator } from '@/api/campaignsApi';
import type { Campaign, Creator } from '@mediaket/shared';
import { CreatorAvatar } from '@/components/CreatorAvatar';
import { CollaborationDetail } from '@/components/CollaborationDetail';

interface CollabRow {
  linkId: string;
  campaign: Campaign;
  campaignId: string;
  creator: Creator;
  creatorId: string;
  collabType: string | null;
  status: string | null;
  contentType: string | null;
}

export function CampaignCollabPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // 从 URL params 或 router state 获取 campaignId 筛选
  const campaignFilterParam = searchParams.get('campaign') ?? location.state?.campaignId ?? '';

  const [rows, setRows] = useState<CollabRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCampaign, setFilterCampaign] = useState(campaignFilterParam);
  const [filterCreator, setFilterCreator] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // 同步 state → URL params
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
      const allLinks: CollabRow[] = [];
      await Promise.all(
        campaigns.map(async (c) => {
          const links = await campaignsApi.listLinks(c.id);
          for (const link of links) {
            if (link.creator) {
              allLinks.push({
                linkId: link.id,
                campaignId: c.id,
                campaign: dtoToCampaign(c),
                creatorId: link.creatorId,
                creator: dtoToCreator(link.creator),
                collabType: link.collabType,
                status: link.status,
                contentType: link.contentType,
              });
            }
          }
        }),
      );
      setRows(allLinks);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

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

  const heads = ['#', 'Campaign', '达人', '平台', '层级', '粉丝', '互动率', '合作方式', '状态', ''];

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
          <table className="w-full min-w-[1000px] border-collapse text-sm">
            <thead>
              <tr className="bg-surface-hover text-left text-xs text-foreground-muted">
                {heads.map((h, i) => (
                  <th key={i} className={`px-3 py-2 font-medium whitespace-nowrap ${i === 0 ? 'sticky left-0 z-10 bg-surface-hover' : ''} ${i === heads.length - 1 ? 'sticky right-0 z-10 bg-surface-hover text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => {
                const open = expandedRow === r.linkId;
                return (
                  <Fragment key={r.linkId}>
                    <tr className={`border-t border-border-subtle hover:bg-surface-hover/50 ${open ? 'bg-surface-hover/20' : ''}`}>
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-surface-primary px-3 py-2 font-mono text-xs tabular-nums text-foreground-muted hover:bg-surface-hover/50">{idx + 1}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-foreground-primary">{r.campaign.name}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <CreatorAvatar name={r.creator.name} avatar={r.creator.avatar} size={24} />
                          <div>
                            <div className="font-medium text-foreground-primary">{r.creator.name}</div>
                            <div className="text-xs text-foreground-muted">{r.creator.handle}</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{r.creator.platform}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{r.creator.tier}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{r.creator.followers}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{r.creator.engagement}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{r.collabType ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{r.status ?? '—'}</td>
                      <td className="sticky right-0 z-10 whitespace-nowrap bg-surface-primary px-3 py-2 text-right hover:bg-surface-hover/50">
                        <button
                          onClick={() => setExpandedRow(open ? null : r.linkId)}
                          className="text-xs text-accent-primary hover:underline"
                        >
                          {open ? '收起' : '详情'}
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={heads.length} className="bg-surface-primary px-4 py-3">
                          <CollabDetail row={r} onUpdate={() => { setExpandedRow(null); void reload(); }} />
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

/** 展开行：达人完整信息 + CollaborationDetail 全量合作详情 */
function CollabDetail({ row, onUpdate }: { row: CollabRow; onUpdate: () => void }) {
  const [collabType, setCollabType] = useState(row.collabType ?? '');
  const [status, setStatus] = useState(row.status ?? '');
  const [contentType, setContentType] = useState(row.contentType ?? '');
  const [busy, setBusy] = useState(false);

  const creator = row.creator;
  const metrics = creator.metrics ?? [];

  async function save() {
    setBusy(true);
    try {
      await campaignsApi.updateLink(row.linkId, {
        collabType: collabType || undefined,
        status: status || undefined,
        contentType: contentType || undefined,
      });
      onUpdate();
    } catch {
      window.alert('保存失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-xs">
      <div className="grid grid-cols-12 gap-4">
        {/* 左侧：达人详情（占 7 列） */}
        <div className="col-span-7">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">达人信息</div>
          <div className="grid grid-cols-3 gap-px rounded-lg overflow-hidden border border-border-subtle">
            {([
              ['Platform', creator.platform],
              ['Tier', creator.tier],
              ['Followers', creator.followers],
              ['Engagement', creator.engagement],
              ['Category', creator.category],
              ['Region', creator.region],
            ] as const).map(([label, value]) => (
              <div key={label} className="bg-surface-primary p-2.5">
                <div className="text-[10px] uppercase tracking-wide text-foreground-muted">{label}</div>
                <div className="text-sm font-medium text-foreground-primary">{value || '—'}</div>
              </div>
            ))}
          </div>
          {/* 频道 KPI */}
          {metrics.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">频道 KPI</div>
              <div className="grid grid-cols-3 gap-2">
                {metrics.map((m, i) => (
                  <div key={`${m.label}-${i}`} className="rounded-md border border-border-subtle p-2.5">
                    <div className="text-[10px] text-foreground-muted">{m.label}</div>
                    <div className="text-sm font-semibold text-foreground-primary">{m.value}</div>
                    {m.compare && (
                      <div className="text-[10px] text-foreground-secondary">{m.compare}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 中间：Campaign 信息（占 2 列） */}
        <div className="col-span-2">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">Campaign</div>
          <div className="rounded-lg border border-border-subtle p-3 space-y-1.5">
            <div className="font-medium text-foreground-primary">{row.campaign.name}</div>
            <div className="text-foreground-secondary">{row.campaign.businessLine}</div>
            <div className="text-foreground-secondary">{row.campaign.platform}</div>
            <div className="text-foreground-secondary">{row.campaign.startDate} ~ {row.campaign.endDate}</div>
          </div>
        </div>

        {/* 右侧：合作字段编辑（占 3 列） */}
        <div className="col-span-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">合作设置</div>
          <div className="rounded-lg border border-border-subtle p-3 space-y-2">
            <label className="flex flex-col gap-0.5 text-foreground-secondary">
              <span className="text-[10px]">合作方式</span>
              <input value={collabType} onChange={(e) => setCollabType(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary" />
            </label>
            <label className="flex flex-col gap-0.5 text-foreground-secondary">
              <span className="text-[10px]">内容类型</span>
              <input value={contentType} onChange={(e) => setContentType(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary" />
            </label>
            <label className="flex flex-col gap-0.5 text-foreground-secondary">
              <span className="text-[10px]">状态</span>
              <input value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary" />
            </label>
            <button disabled={busy} onClick={() => void save()} className="mt-2 w-full rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50">
              保存
            </button>
          </div>
        </div>
      </div>

      {/* 全量合作详情（deliverables/screenshots/metrics/audience/wordcloud） */}
      <div className="mt-4 border-t border-border-subtle pt-3">
        <CollaborationDetail
          campaignId={row.campaignId}
          creatorId={row.creatorId}
          creatorName={row.creator.name}
          onChange={onUpdate}
        />
      </div>
    </div>
  );
}
