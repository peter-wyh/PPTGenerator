/**
 * 业务线广告位截图管理 —— /data/placements
 * 按业务线聚合各 campaign 的 analytics.mediaPlacements，集中查看/编辑截图。
 * 编辑走读-改-写: GET analytics → 改 mediaPlacements 数组 → PUT analytics(保住其余键)。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { lookupApi } from '@/api/lookup';
import { api } from '@/api/client';
import { ImageInput } from '@/components/ImageInput';
import { toast } from '../components/Toast';

/** axios 单例: 响应体在 .data */
const http = {
  get: async <T,>(url: string): Promise<T> => (await api.get<T>(url)).data,
  put: async (url: string, body: unknown): Promise<void> => { await api.put(url, body); },
};

interface Placement {
  name?: string;
  screenshotUrl?: string;
  description?: string;
  platform?: string;
  postUrl?: string;
  _idx?: number;
}

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  businessLine: { id: string; code: string; title: string; color: string } | null;
  placements: Placement[];
}

export function PlacementsPage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [businessLines, setBusinessLines] = useState<{ id: string; code: string; title: string }[]>([]);
  const [blFilter, setBlFilter] = useState('');
  const [loading, setLoading] = useState(true);
  /** 编辑态: `${campaignId}:${_idx}` → 本地草稿 */
  const [editing, setEditing] = useState<Record<string, Placement>>({});
  /** 新增态: campaignId → 新行草稿 */
  const [newDraft, setNewDraft] = useState<Record<string, Placement>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const qs = blFilter ? `?businessLineId=${encodeURIComponent(blFilter)}` : '';
      const r = await http.get<{ campaigns: CampaignRow[] }>(`/campaigns/placements/overview${qs}`);
      setCampaigns(r.campaigns);
    } catch {
      setCampaigns([]);
      toast.error('加载广告位数据失败');
    } finally {
      setLoading(false);
    }
  }, [blFilter]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    lookupApi.listBusinessLines().then(setBusinessLines).catch(() => setBusinessLines([]));
  }, []);

  const key = (cid: string, idx: number) => `${cid}:${idx}`;

  /** 读-改-写回写: 仅替换 mediaPlacements 数组, analytics 其余键原样保留。 */
  async function save(cid: string, idx: number) {
    const k = key(cid, idx);
    const draft = editing[k];
    if (!draft) return;
    setSavingKey(k);
    try {
      const cur = await http.get<{ analytics: Record<string, unknown> }>(`/campaigns/${cid}/analytics`);
      const analytics = cur.analytics;
      const list = Array.isArray(analytics.mediaPlacements) ? [...analytics.mediaPlacements as Placement[]] : [];
      const { _idx, ...entry } = draft;
      list[idx] = entry;
      await http.put(`/campaigns/${cid}/analytics`, { analytics: { ...analytics, mediaPlacements: list } });
      toast.success('已保存');
      setEditing((prev) => { const n = { ...prev }; delete n[k]; return n; });
      void reload();
    } catch {
      toast.error('保存失败');
    } finally {
      setSavingKey(null);
    }
  }

  /** 新增: 追加到 mediaPlacements 末尾 (读-改-写, 其余键保留)。 */
  async function saveNew(cid: string) {
    const draft = newDraft[cid];
    if (!draft) return;
    setSavingKey(`new:${cid}`);
    try {
      const cur = await http.get<{ analytics: Record<string, unknown> }>(`/campaigns/${cid}/analytics`);
      const analytics = cur.analytics;
      const list = Array.isArray(analytics.mediaPlacements) ? [...analytics.mediaPlacements as Placement[]] : [];
      const { _idx, ...entry } = draft;
      list.push(entry);
      await http.put(`/campaigns/${cid}/analytics`, { analytics: { ...analytics, mediaPlacements: list } });
      toast.success('已新增');
      setNewDraft((prev) => { const n = { ...prev }; delete n[cid]; return n; });
      void reload();
    } catch {
      toast.error('新增失败');
    } finally {
      setSavingKey(null);
    }
  }

  async function remove(cid: string, idx: number) {
    if (!window.confirm('确认删除该广告位条目?')) return;
    setSavingKey(key(cid, idx));
    try {
      const cur = await http.get<{ analytics: Record<string, unknown> }>(`/campaigns/${cid}/analytics`);
      const analytics = cur.analytics;
      const list = Array.isArray(analytics.mediaPlacements) ? [...analytics.mediaPlacements as Placement[]] : [];
      list.splice(idx, 1);
      await http.put(`/campaigns/${cid}/analytics`, { analytics: { ...analytics, mediaPlacements: list } });
      toast.success('已删除');
      void reload();
    } catch {
      toast.error('删除失败');
    } finally {
      setSavingKey(null);
    }
  }

  const totalPlacements = useMemo(() => campaigns.reduce((s, c) => s + c.placements.length, 0), [campaigns]);

  if (loading) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">Loading…</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setBlFilter('')}
          className={`rounded px-3 py-1 text-xs ${!blFilter ? 'bg-accent-primary text-foreground-inverse' : 'border border-border-default text-foreground-secondary hover:bg-surface-hover'}`}
        >
          全部业务线
        </button>
        {businessLines.map((bl) => (
          <button
            key={bl.id}
            onClick={() => setBlFilter(bl.id)}
            className={`rounded px-3 py-1 text-xs ${blFilter === bl.id ? 'bg-accent-primary text-foreground-inverse' : 'border border-border-default text-foreground-secondary hover:bg-surface-hover'}`}
          >
            {bl.title || bl.code}
          </button>
        ))}
        <span className="ml-auto text-xs text-foreground-muted">{campaigns.length} 个 Campaign · {totalPlacements} 条广告位</span>
      </div>

      {campaigns.length === 0 && (
        <p className="px-1 py-8 text-center text-sm text-foreground-muted">该业务线下暂无 Campaign</p>
      )}

      {campaigns.map((c) => (
        <section key={c.id} className="mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground-primary">{c.name}</h2>
            {!newDraft[c.id] && (
              <button
                onClick={() => setNewDraft((prev) => ({ ...prev, [c.id]: {} }))}
                className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
              >
                新增广告位
              </button>
            )}
          </div>
          <p className="mb-2 text-xs text-foreground-muted">
            {c.businessLine ? `${c.businessLine.title || c.businessLine.code} · ` : ''}
            {c.startDate ? String(c.startDate).slice(0, 10) : '—'} ~ {c.endDate ? String(c.endDate).slice(0, 10) : '—'}
            {c.placements.length === 0 && ' · 无广告位数据'}
          </p>
          {(c.placements.length > 0 || newDraft[c.id]) && (
            <div className="overflow-auto rounded-lg border border-border-default">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-hover text-left text-xs text-foreground-muted">
                    {['#', '名称', '截图', '平台', '描述', '帖子链接', '操作'].map((h, i) => (
                      <th key={i} className={`px-3 py-2 font-medium whitespace-nowrap ${i === 6 ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {c.placements.map((p) => {
                    const k = key(c.id, p._idx ?? 0);
                    const draft = editing[k];
                    const isEditing = !!draft;
                    return (
                      <tr key={k} className="border-t border-border-subtle hover:bg-surface-hover/50">
                        <td className="px-3 py-2 font-mono text-xs tabular-nums text-foreground-muted">{(p._idx ?? 0) + 1}</td>
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <input
                              value={draft.name ?? ''}
                              onChange={(e) => setEditing((prev) => ({ ...prev, [k]: { ...draft, name: e.target.value } }))}
                              className="w-36 rounded border border-border-default px-2 py-1 text-xs"
                            />
                          ) : (
                            <span className="font-medium text-foreground-primary">{p.name || '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <div className="w-44"><ImageInput
                              value={draft.screenshotUrl ?? ''}
                              onChange={(url) => setEditing((prev) => ({ ...prev, [k]: { ...draft, screenshotUrl: url } }))}
                            /></div>
                          ) : p.screenshotUrl ? (
                            <img src={p.screenshotUrl} alt={p.name ?? ''} className="max-h-12 rounded border border-border-subtle object-contain" />
                          ) : (
                            <span className="text-foreground-muted">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-foreground-secondary">{p.platform || '—'}</td>
                        <td className="px-3 py-2 text-xs text-foreground-secondary">
                          {isEditing ? (
                            <input
                              value={draft.description ?? ''}
                              onChange={(e) => setEditing((prev) => ({ ...prev, [k]: { ...draft, description: e.target.value } }))}
                              className="w-44 rounded border border-border-default px-2 py-1 text-xs"
                            />
                          ) : (
                            <span className="block max-w-[220px] truncate" title={p.description ?? ''}>{p.description || '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {p.postUrl ? (
                            <a href={p.postUrl} target="_blank" rel="noreferrer" className="text-accent-primary hover:underline">查看</a>
                          ) : '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-xs">
                          {isEditing ? (
                            <>
                              <button disabled={savingKey === k} onClick={() => void save(c.id, p._idx ?? 0)} className="text-accent-primary hover:underline disabled:opacity-40">保存</button>
                              <button onClick={() => setEditing((prev) => { const n = { ...prev }; delete n[k]; return n; })} className="ml-[18px] text-foreground-secondary hover:underline">取消</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => setEditing((prev) => ({ ...prev, [k]: { ...p } }))} className="text-accent-primary hover:underline">编辑</button>
                              <button disabled={savingKey === k} onClick={() => void remove(c.id, p._idx ?? 0)} className="ml-[18px] text-red hover:underline disabled:opacity-40">删除</button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {newDraft[c.id] && (() => {
                  const d = newDraft[c.id];
                  const sk = `new:${c.id}`;
                  return (
                    <tfoot>
                      <tr className="border-t border-border-subtle bg-surface-hover/30">
                        <td className="px-3 py-2 font-mono text-xs text-foreground-muted">{c.placements.length + 1}</td>
                        <td className="px-3 py-2">
                          <input
                            value={d.name ?? ''}
                            placeholder="名称"
                            onChange={(e) => setNewDraft((prev) => ({ ...prev, [c.id]: { ...d, name: e.target.value } }))}
                            className="w-36 rounded border border-border-default px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="w-44"><ImageInput
                            value={d.screenshotUrl ?? ''}
                            onChange={(url) => setNewDraft((prev) => ({ ...prev, [c.id]: { ...d, screenshotUrl: url } }))}
                          /></div>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={d.platform ?? ''}
                            placeholder="平台"
                            onChange={(e) => setNewDraft((prev) => ({ ...prev, [c.id]: { ...d, platform: e.target.value } }))}
                            className="w-24 rounded border border-border-default px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={d.description ?? ''}
                            placeholder="描述"
                            onChange={(e) => setNewDraft((prev) => ({ ...prev, [c.id]: { ...d, description: e.target.value } }))}
                            className="w-44 rounded border border-border-default px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={d.postUrl ?? ''}
                            placeholder="https://…"
                            onChange={(e) => setNewDraft((prev) => ({ ...prev, [c.id]: { ...d, postUrl: e.target.value } }))}
                            className="w-36 rounded border border-border-default px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-xs">
                          <button disabled={savingKey === sk} onClick={() => void saveNew(c.id)} className="text-accent-primary hover:underline disabled:opacity-40">保存</button>
                          <button onClick={() => setNewDraft((prev) => { const n = { ...prev }; delete n[c.id]; return n; })} className="ml-[18px] text-foreground-secondary hover:underline">取消</button>
                        </td>
                      </tr>
                    </tfoot>
                  );
                })()}
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
