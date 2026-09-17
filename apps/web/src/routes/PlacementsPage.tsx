/**
 * 业务线广告位截图管理 —— /data/placements
 * 按业务线聚合各 campaign 的 analytics.mediaPlacements，集中查看/编辑截图。
 * 0917 打平: 不再按 Campaign 分块,单表格平铺(新增 Campaign 列),分块需求由筛选器解决
 *          (业务线按钮组 + Campaign 下拉)。编辑走读-改-写: GET analytics → 改数组 → PUT(保住其余键)。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { lookupApi } from '@/api/lookup';
import { api } from '@/api/client';
import { MultiImageInput } from '@/components/MultiImageInput';
import { toast } from '../components/Toast';

/** axios 单例: 响应体在 .data */
const http = {
  get: async <T,>(url: string): Promise<T> => (await api.get<T>(url)).data,
  put: async (url: string, body: unknown): Promise<void> => { await api.put(url, body); },
};

interface Placement {
  name?: string;
  screenshotUrl?: string;
  /** 多张截图（0916）；screenshotUrl 始终=首图，双写兼容旧渲染。 */
  screenshotUrls?: string[];
  /** 曝光时间点（0916 旧字段，0917 起改区间，读取时并入区间起点）。 */
  exposureAt?: string;
  /** 曝光区间（0917）：起止日期，任一缺省视为开区间。 */
  exposureStartAt?: string;
  exposureEndAt?: string;
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

/** 打平后的行: campaign 信息 + placement(带 _idx 供读-改-写定位)。 */
interface FlatRow extends Placement {
  campaignId: string;
  campaignName: string;
  campaignPeriod: string;
  blTitle: string;
}

export function PlacementsPage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [businessLines, setBusinessLines] = useState<{ id: string; code: string; title: string }[]>([]);
  const [blFilter, setBlFilter] = useState('');
  /** 0917 打平: Campaign 筛选(分块需求的替代) */
  const [campaignFilter, setCampaignFilter] = useState('');
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

  /** 打平: campaigns → 行数组,再过 Campaign 筛选。 */
  const flatRows = useMemo<FlatRow[]>(() => {
    const out: FlatRow[] = [];
    for (const c of campaigns) {
      if (campaignFilter && c.id !== campaignFilter) continue;
      for (const p of c.placements) {
        out.push({
          ...p,
          campaignId: c.id,
          campaignName: c.name,
          campaignPeriod: `${c.startDate ? String(c.startDate).slice(0, 10) : '—'} ~ ${c.endDate ? String(c.endDate).slice(0, 10) : '—'}`,
          blTitle: c.businessLine ? (c.businessLine.title || c.businessLine.code) : '—',
        });
      }
    }
    return out;
  }, [campaigns, campaignFilter]);

  /** 筛选后的 campaign 下拉选项(只列有广告位的)。 */
  const campaignOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of campaigns) {
      if (c.placements.length > 0) seen.set(c.id, c.name);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [campaigns]);

  const newDraftCampaigns = useMemo(() => Object.keys(newDraft), [newDraft]);

  /** 多图统一出口：更新 screenshotUrls 并双写首图到 screenshotUrl。 */
  function withShots(draft: Placement, urls: string[]): Placement {
    return { ...draft, screenshotUrls: urls, screenshotUrl: urls[0] ?? '' };
  }

  /** 图片数组归一：优先 screenshotUrls，回落单图 screenshotUrl。 */
  function shotsOf(p: Placement): string[] {
    if (p.screenshotUrls?.length) return p.screenshotUrls;
    return p.screenshotUrl ? [p.screenshotUrl] : [];
  }

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
        {/* 0917 打平: Campaign 下拉替代原分块 */}
        <select
          value={campaignFilter}
          onChange={(e) => setCampaignFilter(e.target.value)}
          className="ml-2 rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary"
        >
          <option value="">全部 Campaign</option>
          {campaignOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {/* 0917 打平: 新增须选 Campaign(原分块头的新增按钮移到工具行) */}
        {!newDraftCampaigns.length && (
          <select
            value=""
            onChange={(e) => { if (e.target.value) setNewDraft((prev) => ({ ...prev, [e.target.value]: {} })); }}
            className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            <option value="">+ 新增广告位…</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        <span className="ml-auto text-xs text-foreground-muted">{flatRows.length} 条广告位</span>
      </div>

      {flatRows.length === 0 && !newDraftCampaigns.length && (
        <p className="px-1 py-8 text-center text-sm text-foreground-muted">暂无广告位数据</p>
      )}

      {(flatRows.length > 0 || newDraftCampaigns.length > 0) && (
        <div className="overflow-auto rounded-lg border border-border-default">
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <thead>
              <tr className="bg-surface-hover text-left text-xs text-foreground-muted">
                {['#', 'Campaign', '业务线', '名称', '截图', '曝光时间', '平台', '描述', '帖子链接', '操作'].map((h, i) => (
                  <th key={i} className={`px-3 py-2 font-medium whitespace-nowrap ${i === 9 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flatRows.map((p) => {
                const k = key(p.campaignId, p._idx ?? 0);
                const draft = editing[k];
                const isEditing = !!draft;
                return (
                  <tr key={k} className="border-t border-border-subtle hover:bg-surface-hover/50">
                    <td className="px-3 py-2 font-mono text-xs tabular-nums text-foreground-muted">{(p._idx ?? 0) + 1}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-foreground-primary">{p.campaignName}</span>
                      <span className="block text-[10px] text-foreground-muted">{p.campaignPeriod}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-foreground-secondary">{p.blTitle}</td>
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
                        <MultiImageInput
                          value={shotsOf(draft)}
                          onChange={(urls) => setEditing((prev) => ({ ...prev, [k]: withShots(draft, urls) }))}
                        />
                      ) : shotsOf(p).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {shotsOf(p).slice(0, 3).map((u, j) => (
                            <img key={j} src={u} alt={`${p.name ?? ''}-${j + 1}`} className="max-h-12 rounded border border-border-subtle object-contain" />
                          ))}
                          {shotsOf(p).length > 3 && <span className="self-center text-[10px] text-foreground-muted">+{shotsOf(p).length - 3}</span>}
                        </div>
                      ) : (
                        <span className="text-foreground-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {isEditing ? (
                        <span className="inline-flex items-center gap-1">
                          <input
                            type="date"
                            value={draft.exposureStartAt ?? draft.exposureAt?.slice(0, 10) ?? ''}
                            onChange={(e) => setEditing((prev) => ({ ...prev, [k]: { ...draft, exposureStartAt: e.target.value } }))}
                            className="w-32 rounded border border-border-default px-2 py-1 text-xs"
                          />
                          <span className="text-foreground-muted">至</span>
                          <input
                            type="date"
                            value={draft.exposureEndAt ?? draft.exposureAt?.slice(0, 10) ?? ''}
                            onChange={(e) => setEditing((prev) => ({ ...prev, [k]: { ...draft, exposureEndAt: e.target.value } }))}
                            className="w-32 rounded border border-border-default px-2 py-1 text-xs"
                          />
                        </span>
                      ) : (
                        <span className="text-foreground-secondary">
                          {p.exposureStartAt || p.exposureEndAt
                            ? `${p.exposureStartAt || '…'} ~ ${p.exposureEndAt || '…'}`
                            : p.exposureAt
                              ? p.exposureAt.slice(0, 10)
                              : '—'}
                        </span>
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
                          <button disabled={savingKey === k} onClick={() => void save(p.campaignId, p._idx ?? 0)} className="text-accent-primary hover:underline disabled:opacity-40">保存</button>
                          <button onClick={() => setEditing((prev) => { const n = { ...prev }; delete n[k]; return n; })} className="ml-[18px] text-foreground-secondary hover:underline">取消</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEditing((prev) => ({ ...prev, [k]: { ...p } }))} className="text-accent-primary hover:underline">编辑</button>
                          <button disabled={savingKey === k} onClick={() => void remove(p.campaignId, p._idx ?? 0)} className="ml-[18px] text-red hover:underline disabled:opacity-40">删除</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* 新增行: 每个待新增 campaign 一行(选中后在表格底部编辑) */}
            {newDraftCampaigns.map((cid) => {
              const c = campaigns.find((x) => x.id === cid);
              if (!c) return null;
              const d = newDraft[cid];
              const sk = `new:${cid}`;
              return (
                <tfoot key={cid}>
                  <tr className="border-t border-border-subtle bg-surface-hover/30">
                    <td className="px-3 py-2 font-mono text-xs text-foreground-muted">{c.placements.length + 1}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-foreground-primary">{c.name}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-foreground-secondary">{c.businessLine ? (c.businessLine.title || c.businessLine.code) : '—'}</td>
                    <td className="px-3 py-2">
                      <input
                        value={d.name ?? ''}
                        placeholder="名称"
                        onChange={(e) => setNewDraft((prev) => ({ ...prev, [cid]: { ...d, name: e.target.value } }))}
                        className="w-36 rounded border border-border-default px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <MultiImageInput
                        value={shotsOf(d)}
                        onChange={(urls) => setNewDraft((prev) => ({ ...prev, [cid]: withShots(d, urls) }))}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        <input
                          type="date"
                          value={d.exposureStartAt ?? ''}
                          onChange={(e) => setNewDraft((prev) => ({ ...prev, [cid]: { ...d, exposureStartAt: e.target.value } }))}
                          className="w-32 rounded border border-border-default px-2 py-1 text-xs"
                        />
                        <span className="text-foreground-muted">至</span>
                        <input
                          type="date"
                          value={d.exposureEndAt ?? ''}
                          onChange={(e) => setNewDraft((prev) => ({ ...prev, [cid]: { ...d, exposureEndAt: e.target.value } }))}
                          className="w-32 rounded border border-border-default px-2 py-1 text-xs"
                        />
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={d.platform ?? ''}
                        placeholder="平台"
                        onChange={(e) => setNewDraft((prev) => ({ ...prev, [cid]: { ...d, platform: e.target.value } }))}
                        className="w-24 rounded border border-border-default px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={d.description ?? ''}
                        placeholder="描述"
                        onChange={(e) => setNewDraft((prev) => ({ ...prev, [cid]: { ...d, description: e.target.value } }))}
                        className="w-44 rounded border border-border-default px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={d.postUrl ?? ''}
                        placeholder="https://…"
                        onChange={(e) => setNewDraft((prev) => ({ ...prev, [cid]: { ...d, postUrl: e.target.value } }))}
                        className="w-36 rounded border border-border-default px-2 py-1 text-xs"
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-xs">
                      <button disabled={savingKey === sk} onClick={() => void saveNew(cid)} className="text-accent-primary hover:underline disabled:opacity-40">保存</button>
                      <button onClick={() => setNewDraft((prev) => { const n = { ...prev }; delete n[cid]; return n; })} className="ml-[18px] text-foreground-secondary hover:underline">取消</button>
                    </td>
                  </tr>
                </tfoot>
              );
            })}
          </table>
        </div>
      )}
    </div>
  );
}
