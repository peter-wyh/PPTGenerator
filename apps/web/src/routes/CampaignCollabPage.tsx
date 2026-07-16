/**
 * Campaign 合作列表页 —— 展示所有 Campaign × Creator 合作关系。
 * 独立路由页面（/data/campaign-collabs）。
 */
import { Fragment, useCallback, useEffect, useState } from 'react';
import { campaignsApi, dtoToCampaign, dtoToCreator } from '@/api/campaignsApi';
import type { Campaign, Creator } from '@mediaket/shared';
import { CreatorAvatar } from '@/components/CreatorAvatar';

interface CollabRow {
  linkId: string;
  campaign: Campaign;
  creator: Creator;
  collabType: string | null;
  status: string | null;
  contentType: string | null;
}

export function CampaignCollabPage() {
  const [rows, setRows] = useState<CollabRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCampaign, setFilterCampaign] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

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
                campaign: dtoToCampaign(c),
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
    if (filterCampaign && !r.campaign.name.toLowerCase().includes(filterCampaign.toLowerCase())) return false;
    if (filterStatus && (r.status ?? '—') !== filterStatus) return false;
    return true;
  });

  const statusSet = [...new Set(rows.map((r) => r.status ?? '—').filter(Boolean))];

  if (loading) {
    return <p className="text-sm text-foreground-muted">加载合作列表…</p>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-foreground-secondary">
          共 <span className="font-medium text-foreground-primary">{filtered.length}</span> 条合作关系
        </div>
        <div className="flex gap-2">
          <input
            placeholder="搜索 Campaign…"
            value={filterCampaign}
            onChange={(e) => setFilterCampaign(e.target.value)}
            className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary placeholder:text-foreground-muted w-44"
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
          <table className="w-full min-w-[800px] border-collapse text-sm">
            <thead>
              <tr className="bg-surface-hover text-left text-xs text-foreground-muted">
                {['#', 'Campaign', '达人', '平台', '合作方式', '内容类型', '状态', ''].map((h, i) => (
                  <th key={i} className={`px-3 py-2 font-medium whitespace-nowrap ${i === 0 ? 'sticky left-0 z-10 bg-surface-hover' : ''} ${i === 8 ? 'sticky right-0 z-10 bg-surface-hover text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => {
                const open = expandedRow === r.linkId;
                return (
                  <Fragment key={r.linkId}>
                    <tr className="border-t border-border-subtle hover:bg-surface-hover/50">
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-surface-primary px-3 py-2 font-mono text-xs tabular-nums text-foreground-muted hover:bg-surface-hover/50">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-foreground-primary">{r.campaign.name}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <CreatorAvatar name={r.creator.name} avatar={undefined} size={24} />
                          <div>
                            <div className="font-medium text-foreground-primary">{r.creator.name}</div>
                            <div className="text-xs text-foreground-muted">{r.creator.handle}</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{r.creator.platform}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{r.collabType ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{r.contentType ?? '—'}</td>
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
                        <td colSpan={9} className="bg-surface-primary px-4 py-3">
                          <CollabDetail row={r} onUpdate={() => setExpandedRow(null)} />
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

/** 展开行：合作详情 + 可编辑字段 */
function CollabDetail({ row, onUpdate }: { row: CollabRow; onUpdate: () => void }) {
  const [collabType, setCollabType] = useState(row.collabType ?? '');
  const [status, setStatus] = useState(row.status ?? '');
  const [contentType, setContentType] = useState(row.contentType ?? '');
  const [busy, setBusy] = useState(false);

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
    <div className="grid grid-cols-3 gap-4 text-xs">
      <div>
        <div className="mb-1 text-foreground-muted">Campaign</div>
        <div className="font-medium text-foreground-primary">{row.campaign.name}</div>
        <div className="text-foreground-secondary">{row.campaign.businessLine} · {row.campaign.platform}</div>
      </div>
      <div>
        <div className="mb-1 text-foreground-muted">达人</div>
        <div className="font-medium text-foreground-primary">{row.creator.name}</div>
        <div className="text-foreground-secondary">{row.creator.handle} · {row.creator.tier} · {row.creator.followers}</div>
      </div>
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-1 text-foreground-secondary">
          合作方式
          <input value={collabType} onChange={(e) => setCollabType(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-0.5 text-foreground-primary" />
        </label>
        <label className="flex items-center gap-1 text-foreground-secondary">
          内容类型
          <input value={contentType} onChange={(e) => setContentType(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-0.5 text-foreground-primary" />
        </label>
        <label className="flex items-center gap-1 text-foreground-secondary">
          状态
          <input value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-0.5 text-foreground-primary" />
        </label>
        <button disabled={busy} onClick={() => void save()} className="mt-1 self-start rounded bg-accent-primary px-3 py-1 text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50">
          保存
        </button>
      </div>
    </div>
  );
}
