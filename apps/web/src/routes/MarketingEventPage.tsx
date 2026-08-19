/**
 * 营销活动数据管理页面 —— 基于 lookup API 的 CRUD 列表。
 * 独立路由页面（/data/marketing-events）。
 * 记录广告主的营销活动：名称 / 简介 / 时间跨度。
 */
import { useCallback, useEffect, useState } from 'react';
import { lookupApi, type MarketingEventDTO, type AdvertiserDTO } from '@/api/lookup';
import { toast } from '../components/Toast';

export function MarketingEventPage() {
  const [list, setList] = useState<MarketingEventDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // 筛选：按广告主
  const [advertisers, setAdvertisers] = useState<AdvertiserDTO[]>([]);
  const [filterAdvertiser, setFilterAdvertiser] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setList(await lookupApi.listMarketingEvents(filterAdvertiser || undefined));
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [filterAdvertiser]);
  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    lookupApi.listAdvertisers().then(setAdvertisers).catch(() => {});
  }, []);

  async function removeEvent(id: string, name: string) {
    if (!window.confirm(`确认删除营销活动「${name}」?`)) return;
    try {
      await lookupApi.removeMarketingEvent(id);
      setList((prev) => prev.filter((e) => e.id !== id));
      toast.success('删除成功');
    } catch {
      toast.error('删除失败');
    }
  }

  if (loading) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">Loading…</p>;
  }

  const heads = ['#', '活动名称', '广告主', '业务线', '时间跨度', '简介', ''];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setAdding(true)} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary">新增营销活动</button>
        <select
          value={filterAdvertiser}
          onChange={(e) => setFilterAdvertiser(e.target.value)}
          className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary"
        >
          <option value="">全部广告主</option>
          {advertisers.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>
      <div className="overflow-auto rounded-lg border border-border-default">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="bg-surface-hover text-left text-xs text-foreground-muted">
              {heads.map((h, i) => (
                <th key={i} className={`px-3 py-2 font-medium whitespace-nowrap ${i === 0 ? 'sticky left-0 z-10 bg-surface-hover' : ''} ${i === heads.length - 1 ? 'sticky right-0 z-10 bg-surface-hover text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((e, idx) => (
              <tr key={e.id} className="border-t border-border-subtle hover:bg-surface-hover/50">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-surface-primary px-3 py-2 font-mono text-xs tabular-nums text-foreground-muted hover:bg-surface-hover/50">{idx + 1}</td>
                <td className="px-3 py-2 font-medium text-foreground-primary">{e.name}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{e.advertiser?.name ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{e.advertiser?.businessLine?.name ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums text-foreground-secondary">{e.startDate} ~ {e.endDate}</td>
                <td className="max-w-[320px] truncate px-3 py-2 text-xs text-foreground-secondary" title={e.description ?? ''}>{e.description ?? '—'}</td>
                <td className="sticky right-0 z-10 whitespace-nowrap bg-surface-primary px-3 py-2 text-right hover:bg-surface-hover/50">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingId(e.id)} className="text-xs text-accent-primary hover:underline">编辑</button>
                    <button onClick={() => void removeEvent(e.id, e.name)} className="text-xs text-red hover:underline">删除</button>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={heads.length} className="px-3 py-6 text-center text-sm text-foreground-muted">暂无营销活动</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {adding && (
        <MarketingEventFormModal
          onSaved={async () => { setAdding(false); await reload(); }}
          onCancel={() => setAdding(false)}
        />
      )}
      {editingId && (
        <MarketingEventFormModal
          eventId={editingId}
          onSaved={async () => { setEditingId(null); await reload(); }}
          onCancel={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

/* ========================= Form Modal ========================= */

function MarketingEventFormModal({
  eventId,
  onSaved,
  onCancel,
}: {
  eventId?: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!eventId;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [advertiserId, setAdvertiserId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [advertisers, setAdvertisers] = useState<AdvertiserDTO[]>([]);

  useEffect(() => {
    lookupApi.listAdvertisers().then(setAdvertisers).catch(() => {});
  }, []);

  useEffect(() => {
    if (!eventId) return;
    lookupApi.listMarketingEvents().then((all) => {
      const ev = all.find((x) => x.id === eventId);
      if (!ev) { setError('加载失败'); return; }
      setName(ev.name);
      setDescription(ev.description ?? '');
      setStartDate(ev.startDate);
      setEndDate(ev.endDate);
      setAdvertiserId(ev.advertiserId);
    }).catch(() => setError('加载失败'));
  }, [eventId]);

  async function save() {
    if (!name.trim()) { setError('名称不能为空'); return; }
    if (!advertiserId) { setError('请选择广告主'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) { setError('开始日期须为 YYYY-MM-DD'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) { setError('结束日期须为 YYYY-MM-DD'); return; }
    if (endDate < startDate) { setError('结束日期不能早于开始日期'); return; }
    setBusy(true); setError('');
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        startDate,
        endDate,
        advertiserId,
      };
      if (isEdit) {
        await lookupApi.updateMarketingEvent(eventId!, payload);
      } else {
        await lookupApi.createMarketingEvent(payload);
      }
      toast.success(isEdit ? '更新成功' : '创建成功');
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="flex w-[480px] flex-col gap-3 rounded-xl bg-surface-primary p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="font-headings text-sm font-semibold text-foreground-primary">{isEdit ? '编辑营销活动' : '新增营销活动'}</div>
        {error && <p className="text-xs text-red">{error}</p>}

        <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
          活动名称
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 GlowLab Q4 大促" className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary" />
        </label>

        <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
          广告主
          <select
            value={advertiserId}
            onChange={(e) => setAdvertiserId(e.target.value)}
            className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary"
          >
            <option value="">请选择广告主…</option>
            {advertisers.map((a) => (
              <option key={a.id} value={a.id}>{a.name}{a.businessLine ? `（${a.businessLine.name}）` : ''}</option>
            ))}
          </select>
        </label>

        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1 text-xs text-foreground-secondary">
            开始日期
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary" />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-foreground-secondary">
            结束日期
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary" />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
          简介
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="活动目标 / 覆盖渠道 / 主题等" className="resize-none rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary" />
        </label>

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover">取消</button>
          <button disabled={busy} onClick={() => void save()} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50">{isEdit ? '更新' : '创建'}</button>
        </div>
      </div>
    </div>
  );
}
