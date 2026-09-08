/**
 * 佣金方案管理页面 —— CommissionPlan CRUD（/data/commission-plans）。
 * 0908 补入口：模型早已存在且被 AI 报告生成消费（campaign.commissionPlans），
 * 但此前无任何管理界面，数据只能靠脚本写入。
 */
import { useCallback, useEffect, useState } from 'react';
import { campaignsApi, type CommissionPlanDTO } from '@/api/campaignsApi';
import { toast } from '../components/Toast';

export function CommissionPlanPage() {
  const [list, setList] = useState<CommissionPlanDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [filterCampaign, setFilterCampaign] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setList(await campaignsApi.listCommissionPlans(filterCampaign || undefined));
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [filterCampaign]);
  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    campaignsApi.list().then((r) => setCampaigns(
      (r as unknown as { id: string; name: string }[]).map((c) => ({ id: c.id, name: c.name })),
    )).catch(() => {});
  }, []);

  async function removePlan(id: string, name: string) {
    if (!window.confirm(`确认删除佣金方案「${name || id}」?`)) return;
    try {
      await campaignsApi.removeCommissionPlan(id);
      setList((prev) => prev.filter((p) => p.id !== id));
      toast.success('删除成功');
    } catch {
      toast.error('删除失败');
    }
  }

  if (loading) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">Loading…</p>;
  }

  const heads = ['#', 'Campaign', '方案名', '生效日', '失效日', 'CPA 费率', '固定费用', '周期', '备注', ''];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setAdding(true)} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary">新增佣金方案</button>
        <select
          value={filterCampaign}
          onChange={(e) => setFilterCampaign(e.target.value)}
          className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary"
        >
          <option value="">全部 Campaign</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="overflow-auto rounded-lg border border-border-default">
        <table className="w-full min-w-[1080px] border-collapse text-sm">
          <thead>
            <tr className="bg-surface-hover text-left text-xs text-foreground-muted">
              {heads.map((h, i) => (
                <th key={i} className={`px-3 py-2 font-medium whitespace-nowrap ${i === heads.length - 1 ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((p, idx) => (
              <tr key={p.id} className="border-t border-border-subtle hover:bg-surface-hover/50">
                <td className="px-3 py-2 font-mono text-xs tabular-nums text-foreground-muted">{idx + 1}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-primary">{p.campaign?.name ?? p.campaignId}</td>
                <td className="px-3 py-2 font-medium text-foreground-primary">{p.name ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums text-foreground-secondary">{p.startDate}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums text-foreground-secondary">{p.endDate ?? '开放式'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{p.cpaRate ? `${(Number(p.cpaRate) * 100).toFixed(2)}%` : '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{p.flatFee ? `$${Number(p.flatFee).toFixed(2)}` : '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{p.flatFeeFrequency === 'monthly' ? '按月' : p.flatFeeFrequency === 'one_time' ? '一次性' : '—'}</td>
                <td className="max-w-[240px] truncate px-3 py-2 text-xs text-foreground-secondary" title={p.note ?? ''}>{p.note ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingId(p.id)} className="text-xs text-accent-primary hover:underline">编辑</button>
                    <button onClick={() => void removePlan(p.id, p.name ?? '')} className="text-xs text-red hover:underline">删除</button>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={heads.length} className="px-3 py-6 text-center text-sm text-foreground-muted">暂无佣金方案</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {(adding || editingId) && (
        <CommissionPlanFormModal
          campaigns={campaigns}
          plan={editingId ? list.find((p) => p.id === editingId) : undefined}
          onSaved={async () => { setAdding(false); setEditingId(null); await reload(); }}
          onCancel={() => { setAdding(false); setEditingId(null); }}
        />
      )}
    </div>
  );
}

function CommissionPlanFormModal({
  campaigns, plan, onSaved, onCancel,
}: {
  campaigns: { id: string; name: string }[];
  plan?: CommissionPlanDTO;
  onSaved: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const isEdit = !!plan;
  const [campaignId, setCampaignId] = useState(plan?.campaignId ?? campaigns[0]?.id ?? '');
  const [name, setName] = useState(plan?.name ?? '');
  const [startDate, setStartDate] = useState(plan?.startDate ?? '');
  const [endDate, setEndDate] = useState(plan?.endDate ?? '');
  const [cpaRate, setCpaRate] = useState(plan?.cpaRate ? String(Number(plan.cpaRate) * 100) : '');
  const [flatFee, setFlatFee] = useState(plan?.flatFee ?? '');
  const [flatFeeFrequency, setFlatFeeFrequency] = useState(plan?.flatFeeFrequency ?? '');
  const [note, setNote] = useState(plan?.note ?? '');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!isEdit && !campaignId) { toast.error('请选择 Campaign'); return; }
    if (!startDate) { toast.error('生效日必填'); return; }
    setBusy(true);
    try {
      const data = {
        ...(isEdit ? {} : { campaignId }),
        name: name || undefined,
        startDate,
        endDate: endDate || undefined,
        cpaRate: cpaRate === '' ? undefined : String(Number(cpaRate) / 100),
        flatFee: flatFee === '' ? undefined : flatFee,
        flatFeeFrequency: (flatFeeFrequency || undefined) as 'monthly' | 'one_time' | undefined,
        note: note || undefined,
      };
      if (isEdit && plan) {
        await campaignsApi.updateCommissionPlan(plan.id, data);
      } else {
        await campaignsApi.createCommissionPlan({ ...data, campaignId } as import('@/api/campaignsApi').CommissionPlanInput);
      }
      toast.success(isEdit ? '更新成功' : '创建成功');
      await onSaved();
    } catch {
      toast.error(isEdit ? '更新失败' : '创建失败');
    } finally {
      setBusy(false);
    }
  }

  const inputCls = 'rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => !busy && onCancel()}>
      <div className="w-[520px] rounded-xl bg-surface-primary p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 font-headings text-sm font-semibold text-foreground-primary">{isEdit ? '编辑佣金方案' : '新增佣金方案'}</div>
        <div className="grid grid-cols-2 gap-3">
          {!isEdit && (
            <label className="col-span-2 flex flex-col gap-1 text-xs text-foreground-secondary">
              Campaign *
              <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={inputCls}>
                <option value="">请选择</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
            方案名
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 Q1 冲量方案" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
            周期
            <select value={flatFeeFrequency} onChange={(e) => setFlatFeeFrequency(e.target.value)} className={inputCls}>
              <option value="">无固定费</option>
              <option value="monthly">按月</option>
              <option value="one_time">一次性</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
            生效日 *（YYYY-MM-DD）
            <input value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="2026-01-01" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
            失效日（空=至今有效）
            <input value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder="2026-03-31" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
            CPA 费率（%，10 = 10%）
            <input value={cpaRate} onChange={(e) => setCpaRate(e.target.value)} placeholder="10" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
            固定费用（USD）
            <input value={flatFee} onChange={(e) => setFlatFee(e.target.value)} placeholder="5000" className={inputCls} />
          </label>
          <label className="col-span-2 mt-1 flex flex-col gap-1 text-xs text-foreground-secondary">
            备注（调价原因等，AI 报告叙事素材）
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="如：Q4 冲量期 CPA 上调至 12%，配合黑五档期" className={`resize-none ${inputCls}`} />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover">取消</button>
          <button disabled={busy} onClick={() => void save()} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50">{isEdit ? '更新' : '创建'}</button>
        </div>
      </div>
    </div>
  );
}
