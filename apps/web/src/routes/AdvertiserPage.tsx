/**
 * 广告主数据管理页面 —— 基于 lookup API 的 CRUD 列表。
 * 独立路由页面（/data/advertisers）。
 */
import { useCallback, useEffect, useState } from 'react';
import { lookupApi, type AdvertiserDTO, type BusinessLineDTO, type MerchantDTO } from '@/api/lookup';
import { ImageInput } from '@/components/ImageInput';
import { toast } from '../components/Toast';

export function AdvertiserPage() {
  const [list, setList] = useState<AdvertiserDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setList(await lookupApi.listAdvertisers());
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  async function removeAdvertiser(id: string, name: string) {
    if (!window.confirm(`确认删除广告主「${name}」?`)) return;
    try {
      await lookupApi.removeAdvertiser(id);
      setList((prev) => prev.filter((a) => a.id !== id));
      toast.success('删除成功');
    } catch {
      toast.error('删除失败');
    }
  }

  if (loading) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">Loading…</p>;
  }

  const heads = ['#', 'Logo', '广告主', '业务线', '品牌(Merchant)', ''];

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button onClick={() => setAdding(true)} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary">新增广告主</button>
      </div>
      <div className="overflow-auto rounded-lg border border-border-default">
        <table className="w-full min-w-[700px] border-collapse text-sm">
          <thead>
            <tr className="bg-surface-hover text-left text-xs text-foreground-muted">
              {heads.map((h, i) => (
                <th key={i} className={`px-3 py-2 font-medium whitespace-nowrap ${i === 0 ? 'sticky left-0 z-10 bg-surface-hover' : ''} ${i === heads.length - 1 ? 'sticky right-0 z-10 bg-surface-hover text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((a, idx) => (
              <tr key={a.id} className="border-t border-border-subtle hover:bg-surface-hover/50">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-surface-primary px-3 py-2 font-mono text-xs tabular-nums text-foreground-muted hover:bg-surface-hover/50">{idx + 1}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {a.logo ? (
                    <img src={a.logo} alt={a.name} className="max-h-8 rounded-md border border-border-subtle object-contain" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle bg-surface-hover text-[10px] font-bold text-foreground-muted">
                      {a.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 font-medium text-foreground-primary">{a.name}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{a.businessLine?.title || a.businessLine?.code || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{a.merchant?.name ?? '—'}</td>
                <td className="sticky right-0 z-10 whitespace-nowrap bg-surface-primary px-3 py-2 text-right hover:bg-surface-hover/50">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingId(a.id)} className="text-xs text-accent-primary hover:underline">编辑</button>
                    <button onClick={() => void removeAdvertiser(a.id, a.name)} className="text-xs text-red hover:underline">删除</button>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={heads.length} className="px-3 py-6 text-center text-sm text-foreground-muted">暂无广告主</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {adding && (
        <AdvertiserFormModal
          onSaved={async () => { setAdding(false); await reload(); }}
          onCancel={() => setAdding(false)}
        />
      )}
      {editingId && (
        <AdvertiserFormModal
          advertiserId={editingId}
          onSaved={async () => { setEditingId(null); await reload(); }}
          onCancel={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

/* ========================= Form Modal ========================= */

function AdvertiserFormModal({
  advertiserId,
  onSaved,
  onCancel,
}: {
  advertiserId?: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!advertiserId;
  const [name, setName] = useState('');
  const [logo, setLogo] = useState('');
  const [businessLineId, setBusinessLineId] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // 加载业务线和商家列表（供下拉选择）
  const [businessLines, setBusinessLines] = useState<BusinessLineDTO[]>([]);
  const [merchants, setMerchants] = useState<MerchantDTO[]>([]);

  useEffect(() => {
    lookupApi.listBusinessLines().then(setBusinessLines).catch(() => {});
    lookupApi.listMerchants().then(setMerchants).catch(() => {});
  }, []);

  useEffect(() => {
    if (!advertiserId) return;
    lookupApi.getAdvertiser(advertiserId).then((a) => {
      setName(a.name);
      setLogo(a.logo ?? '');
      setBusinessLineId(a.businessLineId ?? '');
      setMerchantId(a.merchant?.id ?? '');
    }).catch(() => setError('加载失败'));
  }, [advertiserId]);

  async function save() {
    if (!name.trim()) { setError('名称不能为空'); return; }
    if (!businessLineId) { setError('请选择业务线'); return; }
    setBusy(true); setError('');
    try {
      const payload = {
        name: name.trim(),
        logo: logo.trim() || undefined,
        businessLineId,
        merchantId: merchantId || undefined,
      };
      if (isEdit) {
        await lookupApi.updateAdvertiser(advertiserId!, payload);
      } else {
        await lookupApi.createAdvertiser(payload);
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
      <div className="flex w-[440px] flex-col gap-3 rounded-xl bg-surface-primary p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="font-headings text-sm font-semibold text-foreground-primary">{isEdit ? '编辑广告主' : '新增广告主'}</div>
        {error && <p className="text-xs text-red">{error}</p>}

        <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
          <span>名称 <span className="text-red">*</span></span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary" />
        </label>

        <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
          Logo
          <ImageInput value={logo} onChange={setLogo} />
        </label>

        <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
          <span>业务线 <span className="text-red">*</span></span>
          <select
            value={businessLineId}
            onChange={(e) => setBusinessLineId(e.target.value)}
            className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary"
          >
            <option value="">请选择业务线…</option>
            {businessLines.map((bl) => (
              <option key={bl.id} value={bl.id}>{bl.title || bl.code}（{bl.code}）</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
          品牌 (Merchant)
          <select
            value={merchantId}
            onChange={(e) => setMerchantId(e.target.value)}
            className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary"
          >
            <option value="">请选择品牌…</option>
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover">取消</button>
          <button disabled={busy} onClick={() => void save()} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50">{isEdit ? '更新' : '创建'}</button>
        </div>
      </div>
    </div>
  );
}
