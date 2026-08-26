/**
 * 营销活动数据管理页面 —— 基于 lookup API 的 CRUD 列表。
 * 独立路由页面（/data/marketing-events）。
 * 对齐营销系统 sales_activity：业务线归属 / start_time / end_time / 类型 / 适用地区 / 评级。
 */
import { useCallback, useEffect, useState } from 'react';
import { lookupApi, type MarketingEventDTO, type BusinessLineDTO } from '@/api/lookup';
import { toast } from '../components/Toast';

/** 类型：0未设置 1节日 2活动日 3特别促销（源 type tinyint）。 */
const TYPE_LABEL: Record<number, string> = { 0: '—', 1: '节日', 2: '活动日', 3: '特别促销' };
/** 平台评级：0未设置 3高 2中 1低（源 level tinyint）。 */
const LEVEL_LABEL: Record<number, string> = { 0: '—', 1: '低', 2: '中', 3: '高' };
/** 展示给流量主（源 is_show_member）。 */
const SHOW_LABEL: Record<number, string> = { 0: '未设置', 1: '是', 2: '否' };

/** Date/ISO 字符串 → 本地输入框值 YYYY-MM-DDTHH:mm。 */
function toLocalInput(dt: string | Date | undefined): string {
  if (!dt) return '';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Date/ISO 字符串 → 展示 YYYY-MM-DD HH:mm；1970 哨兵显示 —。 */
function fmt(dt: string | Date | undefined): string {
  if (!dt) return '—';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 2000) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MarketingEventPage() {
  const [list, setList] = useState<MarketingEventDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // 筛选：按业务线
  const [businessLines, setBusinessLines] = useState<BusinessLineDTO[]>([]);
  const [filterBL, setFilterBL] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setList(await lookupApi.listMarketingEvents(filterBL || undefined));
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [filterBL]);
  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    lookupApi.listBusinessLines().then(setBusinessLines).catch(() => {});
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

  const heads = ['#', '活动名称', '业务线', '开始时间', '结束时间', '类型', '适用地区', '评级', '流量主可见', '简介', ''];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setAdding(true)} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary">新增营销活动</button>
        <select
          value={filterBL}
          onChange={(e) => setFilterBL(e.target.value)}
          className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary"
        >
          <option value="">全部业务线</option>
          {businessLines.map((b) => (
            <option key={b.id} value={b.id}>{b.title || b.code}</option>
          ))}
        </select>
      </div>
      <div className="overflow-auto rounded-lg border border-border-default">
        <table className="w-full min-w-[1080px] border-collapse text-sm">
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
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{e.businessLine ? (e.businessLine.title || e.businessLine.code) : '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums text-foreground-secondary">{fmt(e.startTime)}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums text-foreground-secondary">{fmt(e.endTime)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{TYPE_LABEL[e.type ?? 0] ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{[e.continent, e.region].filter(Boolean).join(' / ') || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{LEVEL_LABEL[e.level ?? 0] ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{SHOW_LABEL[e.isShowMember ?? 0] ?? '—'}</td>
                <td className="max-w-[280px] truncate px-3 py-2 text-xs text-foreground-secondary" title={e.info ?? ''}>{e.info ?? '—'}</td>
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
          businessLines={businessLines}
          onSaved={async () => { setAdding(false); await reload(); }}
          onCancel={() => setAdding(false)}
        />
      )}
      {editingId && (
        <MarketingEventFormModal
          businessLines={businessLines}
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
  businessLines,
  onSaved,
  onCancel,
}: {
  eventId?: string;
  businessLines: BusinessLineDTO[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!eventId;
  const [name, setName] = useState('');
  const [businessLineId, setBusinessLineId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  // 源侧字段（sales_activity）
  const [label, setLabel] = useState('');
  const [type, setType] = useState(0);
  const [info, setInfo] = useState('');
  const [continent, setContinent] = useState('');
  const [region, setRegion] = useState('');
  const [level, setLevel] = useState(0);
  const [isShowMember, setIsShowMember] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!eventId) return;
    lookupApi.listMarketingEvents().then((all) => {
      const ev = all.find((x) => x.id === eventId);
      if (!ev) { setError('加载失败'); return; }
      setName(ev.name);
      setBusinessLineId(ev.businessLineId ?? '');
      setStartTime(toLocalInput(ev.startTime));
      setEndTime(toLocalInput(ev.endTime));
      setLabel(ev.label ?? '');
      setType(ev.type ?? 0);
      setInfo(ev.info ?? '');
      setContinent(ev.continent ?? '');
      setRegion(ev.region ?? '');
      setLevel(ev.level ?? 0);
      setIsShowMember(ev.isShowMember ?? 0);
    }).catch(() => setError('加载失败'));
  }, [eventId]);

  async function save() {
    if (!name.trim()) { setError('名称不能为空'); return; }
    if (!businessLineId) { setError('请选择业务线'); return; }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(startTime)) { setError('开始时间不能为空且须含时分'); return; }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(endTime)) { setError('结束时间不能为空且须含时分'); return; }
    if (endTime < startTime) { setError('结束时间不能早于开始时间'); return; }
    setBusy(true); setError('');
    try {
      const payload = {
        name: name.trim(),
        businessLineId,
        startTime,
        endTime,
        label: label.trim() || undefined,
        type,
        info: info.trim() || undefined,
        continent: continent.trim() || undefined,
        region: region.trim() || undefined,
        level,
        isShowMember,
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
      <div className="flex max-h-[92vh] w-[520px] flex-col gap-3 overflow-auto rounded-xl bg-surface-primary p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="font-headings text-sm font-semibold text-foreground-primary">{isEdit ? '编辑营销活动' : '新增营销活动'}</div>
        {error && <p className="text-xs text-red">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
            <span>活动名称 <span className="text-red">*</span></span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 GlowLab Q4 大促" className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
            <span>所属业务线 <span className="text-red">*</span></span>
            <select
              value={businessLineId}
              onChange={(e) => setBusinessLineId(e.target.value)}
              className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary"
            >
              <option value="">请选择业务线…</option>
              {businessLines.map((b) => (
                <option key={b.id} value={b.id}>{b.title || b.code}（{b.code}）</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1 text-xs text-foreground-secondary">
            <span>开始时间（start_time） <span className="text-red">*</span></span>
            <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary" />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-foreground-secondary">
            <span>结束时间（end_time） <span className="text-red">*</span></span>
            <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary" />
          </label>
        </div>

        {/* 源侧字段（sales_activity） */}
        <div className="rounded border border-border-subtle bg-surface-hover/30 p-2">
          <div className="mb-1.5 text-[11px] font-medium text-foreground-muted">源系统字段（营销系统 sales_activity，同步时以源为准）</div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
              类型（type）
              <select value={type} onChange={(e) => setType(Number(e.target.value))} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary">
                <option value={0}>未设置</option>
                <option value={1}>节日</option>
                <option value={2}>活动日</option>
                <option value={3}>特别促销</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
              标识（label）
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="源注释：1=废弃" className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
              适用洲（continent）
              <input value={continent} onChange={(e) => setContinent(e.target.value)} placeholder="如 Europe" className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
              适用地区（region）
              <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="如 DE / UK" className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
              平台评级（level）
              <select value={level} onChange={(e) => setLevel(Number(e.target.value))} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary">
                <option value={0}>未设置</option>
                <option value={3}>高</option>
                <option value={2}>中</option>
                <option value={1}>低</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
              展示给流量主（is_show_member）
              <select value={isShowMember} onChange={(e) => setIsShowMember(Number(e.target.value))} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary">
                <option value={0}>未设置</option>
                <option value={1}>是</option>
                <option value={2}>否</option>
              </select>
            </label>
          </div>
          <label className="mt-3 flex flex-col gap-1 text-xs text-foreground-secondary">
            简介（info）
            <textarea value={info} onChange={(e) => setInfo(e.target.value)} rows={3} placeholder="活动目标 / 覆盖渠道 / 主题等" className="resize-none rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary" />
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover">取消</button>
          <button disabled={busy} onClick={() => void save()} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50">{isEdit ? '更新' : '创建'}</button>
        </div>
      </div>
    </div>
  );
}
