/**
 * 业务线数据管理页面 —— 基于 lookup API 的 CRUD 列表。
 * 独立路由页面（/data/business-lines）。
 */
import { useCallback, useEffect, useState } from 'react';
import { lookupApi, type BusinessLineDTO } from '@/api/lookup';
import { ImageInput } from '@/components/ImageInput';

export function BusinessLinePage() {
  const [list, setList] = useState<BusinessLineDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setList(await lookupApi.listBusinessLines());
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  if (loading) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">Loading…</p>;
  }

  const heads = ['#', 'Logo', '编码', '名称', '配色', '广告主数', ''];

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button onClick={() => setAdding(true)} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary">新增业务线</button>
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
            {list.map((bl, idx) => (
              <tr key={bl.id} className="border-t border-border-subtle hover:bg-surface-hover/50">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-surface-primary px-3 py-2 font-mono text-xs tabular-nums text-foreground-muted hover:bg-surface-hover/50">{idx + 1}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {bl.logo ? (
                    <img src={bl.logo} alt={bl.name} className="h-8 w-8 rounded-md border border-border-subtle object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle bg-surface-hover text-[10px] font-bold text-foreground-muted">
                      {bl.code.toUpperCase()}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-foreground-muted">{bl.code}</td>
                <td className="px-3 py-2 font-medium text-foreground-primary">{bl.name}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {bl.color ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-3 w-3 rounded-full border border-border-subtle" style={{ backgroundColor: bl.color }} />
                      <span className="font-mono text-xs text-foreground-muted">{bl.color}</span>
                    </span>
                  ) : (
                    <span className="text-foreground-muted">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{bl._count?.advertisers ?? 0}</td>
                <td className="sticky right-0 z-10 whitespace-nowrap bg-surface-primary px-3 py-2 text-right hover:bg-surface-hover/50">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingId(bl.id)} className="text-xs text-accent-primary hover:underline">编辑</button>
                    <button onClick={() => void removeBusinessLine(bl.id, bl.name)} className="text-xs text-red hover:underline">删除</button>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={heads.length} className="px-3 py-6 text-center text-sm text-foreground-muted">暂无业务线</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {adding && (
        <BusinessLineFormModal
          onSaved={async () => { setAdding(false); await reload(); }}
          onCancel={() => setAdding(false)}
        />
      )}
      {editingId && (
        <BusinessLineFormModal
          businessLineId={editingId}
          onSaved={async () => { setEditingId(null); await reload(); }}
          onCancel={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

/* ========================= Form Modal ========================= */

function BusinessLineFormModal({
  businessLineId,
  onSaved,
  onCancel,
}: {
  businessLineId?: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!businessLineId;
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [logo, setLogo] = useState('');
  const [color, setColor] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!businessLineId) return;
    lookupApi.getBusinessLine(businessLineId).then((bl) => {
      setCode(bl.code);
      setName(bl.name);
      setLogo(bl.logo ?? '');
      setColor(bl.color ?? '');
    }).catch(() => setError('加载失败'));
  }, [businessLineId]);

  async function save() {
    if (!code.trim() || !name.trim()) { setError('编码和名称不能为空'); return; }
    setBusy(true); setError('');
    try {
      const payload = { code: code.trim(), name: name.trim(), logo: logo.trim() || undefined, color: color.trim() || undefined };
      if (isEdit) {
        await lookupApi.updateBusinessLine(businessLineId!, payload);
      } else {
        await lookupApi.createBusinessLine(payload);
      }
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="flex w-[440px] flex-col gap-3 rounded-xl bg-surface-primary p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="font-headings text-sm font-semibold text-foreground-primary">{isEdit ? '编辑业务线' : '新增业务线'}</div>
        {error && <p className="text-xs text-red">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
            编码
            <input value={code} onChange={(e) => setCode(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
            名称
            <input value={name} onChange={(e) => setName(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
            Logo
            <ImageInput value={logo} onChange={setLogo} aspect={1} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
            配色（hex）
            <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#2563eb" className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary font-mono" />
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

async function removeBusinessLine(id: string, name: string) {
  if (!window.confirm(`确认删除业务线「${name}」?`)) return;
  await lookupApi.removeBusinessLine(id);
  window.location.reload();
}
