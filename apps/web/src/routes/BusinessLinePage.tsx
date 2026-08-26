/**
 * 业务线数据管理页面 —— 基于 lookup API 的 CRUD 列表。
 * 独立路由页面（/data/business-lines）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { lookupApi, type BusinessLineDTO } from '@/api/lookup';
import { ImageInput } from '@/components/ImageInput';
import { toast } from '../components/Toast';

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

  async function removeBusinessLine(id: string, name: string) {
    if (!window.confirm(`确认删除业务线「${name}」?`)) return;
    try {
      await lookupApi.removeBusinessLine(id);
      setList((prev) => prev.filter((bl) => bl.id !== id));
      toast.success('删除成功');
    } catch {
      toast.error('删除失败');
    }
  }

  if (loading) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">Loading…</p>;
  }

  const heads = ['#', 'Logo', '编码', '名称', '状态', '商户', '配色', '负责人 ID', '成员 IDs', '主体 IDs', '部门 IDs', '指定成员', '关联项目', 'CPT 提现', '作品提及', '作品标签', '备注', 'design.md', '创建人 ID', '更新人 ID', '创建时间', '更新时间', '删除时间', '广告主数', '营销活动数', '操作'];

  /** JSON 数组字段显示元素个数，title 悬浮看全量。 */
  const jsonCount = (v: unknown): string => (Array.isArray(v) ? String(v.length) : '—');
  const jsonText = (v: unknown): string => (Array.isArray(v) ? v.join('、') : '');
  const fmtTime = (v?: string | Date | null): string => {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('zh-CN', { hour12: false });
  };
  const idList = (v?: string | null) =>
    v ? <span className="block max-w-[160px] truncate" title={v}>{v}</span> : <span className="text-foreground-muted">—</span>;

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
                    <img src={bl.logo} alt={bl.title || bl.code} className="max-h-8 max-w-24 rounded-md border border-border-subtle object-contain" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle bg-surface-hover text-[10px] font-bold text-foreground-muted">
                      {bl.code.toUpperCase()}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-foreground-muted">{bl.code}</td>
                <td className="px-3 py-2 font-medium text-foreground-primary">{bl.title || bl.code}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {bl.status === 1 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">启用</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">停用</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{bl.merchant?.name ?? '—'}</td>
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
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-foreground-muted">{idList(bl.directorId)}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-foreground-muted">{idList(bl.members)}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-foreground-muted">{idList(bl.companyIds)}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-foreground-muted">{idList(bl.departmentIds)}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-foreground-muted">{idList(bl.specifyMembers)}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-foreground-muted">{bl.relatedProject || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{bl.cptWithdraw ? '是' : '否'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary" title={jsonText(bl.expertWorkMention)}>{jsonCount(bl.expertWorkMention)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary" title={jsonText(bl.expertWorkLabel)}>{jsonCount(bl.expertWorkLabel)}</td>
                <td className="max-w-[160px] truncate px-3 py-2 text-foreground-secondary" title={bl.extra ?? undefined}>{bl.extra || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary" title={bl.designMdUrl ?? undefined}>{bl.designMd ? (bl.designMdUrl || '有内容') : '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-foreground-muted">{bl.creatorId || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-foreground-muted">{bl.updatorId || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-foreground-muted">{fmtTime(bl.createTime)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-foreground-muted">{fmtTime(bl.updateTime)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-foreground-muted">{bl.deleteTime ? fmtTime(bl.deleteTime) : '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{bl._count?.advertisers ?? 0}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{bl._count?.marketingEvents ?? 0}</td>
                <td className="sticky right-0 z-10 whitespace-nowrap bg-surface-primary px-3 py-2 text-right hover:bg-surface-hover/50">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingId(bl.id)} className="text-xs text-accent-primary hover:underline">编辑</button>
                    <Link to={`/data/guides?businessLine=${bl.code}`} className="text-xs text-accent-secondary hover:underline">指南管理</Link>
                    <button onClick={() => void removeBusinessLine(bl.id, bl.title || bl.code)} className="text-xs text-red hover:underline">删除</button>
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
  const [title, setTitle] = useState('');
  const [logo, setLogo] = useState('');
  const [color, setColor] = useState('');
  const [designMd, setDesignMd] = useState('');
  const [designMdUrl, setDesignMdUrl] = useState('');
  // 源侧字段（dm_union_business_lines）
  const [directorId, setDirectorId] = useState('');
  const [members, setMembers] = useState('');
  const [extra, setExtra] = useState('');
  const [status, setStatus] = useState(1);
  const [companyIds, setCompanyIds] = useState('');
  const [departmentIds, setDepartmentIds] = useState('');
  const [relatedProject, setRelatedProject] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mdFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!businessLineId) return;
    lookupApi.getBusinessLine(businessLineId).then((bl) => {
      setCode(bl.code);
      setTitle(bl.title ?? '');
      setLogo(bl.logo ?? '');
      setColor(bl.color ?? '');
      setDesignMd(bl.designMd ?? '');
      setDesignMdUrl(bl.designMdUrl ?? '');
      setDirectorId(bl.directorId ?? '');
      setMembers(bl.members ?? '');
      setExtra(bl.extra ?? '');
      setStatus(bl.status ?? 1);
      setCompanyIds(bl.companyIds ?? '');
      setDepartmentIds(bl.departmentIds ?? '');
      setRelatedProject(bl.relatedProject ?? '');
    }).catch(() => setError('加载失败'));
  }, [businessLineId]);

  function onMdFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setDesignMd(String(reader.result ?? ''));
    reader.readAsText(f);
    setDesignMdUrl(f.name);
    e.target.value = '';
  }

  async function save() {
    if (!code.trim() || !title.trim()) { setError('编码和名称不能为空'); return; }
    // ★ 前端预检:base64 logo 是上传失败的残留(旧版静默回退),存库必被 zod max(2048) 拒——提前拦下并给可行动文案
    if (logo.trim().startsWith('data:')) {
      setError('logo 未上传成功（当前是本地临时数据），请删除后重新点「上传」');
      return;
    }
    if (logo.trim().length > 2048) {
      setError(`logo URL 超长（${logo.trim().length} 字符 > 2048），请改用「上传」按钮生成的 /uploads/ 短链接`);
      return;
    }
    setBusy(true); setError('');
    try {
      const payload = {
        code: code.trim(),
        title: title.trim(),
        logo: logo.trim() || undefined,
        color: color.trim() || undefined,
        designMd: designMd.trim() || undefined,
        designMdUrl: designMdUrl.trim() || undefined,
        // 源侧字段
        directorId: directorId.trim() || undefined,
        members: members.trim() || undefined,
        extra: extra.trim() || undefined,
        status,
        companyIds: companyIds.trim() || undefined,
        departmentIds: departmentIds.trim() || undefined,
        relatedProject: relatedProject.trim() || undefined,
      };
      if (isEdit) {
        await lookupApi.updateBusinessLine(businessLineId!, payload);
      } else {
        await lookupApi.createBusinessLine(payload);
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
        <div className="font-headings text-sm font-semibold text-foreground-primary">{isEdit ? '编辑业务线' : '新增业务线'}</div>
        {error && <p className="text-xs text-red">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
            <span>编码 <span className="text-red">*</span></span>
            <input value={code} onChange={(e) => setCode(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
            <span>名称（title） <span className="text-red">*</span></span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary" />
          </label>
        </div>

        {/* 源侧字段（dm_union_business_lines） */}
        <div className="rounded border border-border-subtle bg-surface-hover/30 p-2">
          <div className="mb-1.5 text-[11px] font-medium text-foreground-muted">源系统字段（营销系统 dm_union_business_lines，同步时以源为准）</div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
              负责人 ID（director_id）
              <input value={directorId} onChange={(e) => setDirectorId(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary font-mono" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
              成员 IDs（members，逗号分隔）
              <input value={members} onChange={(e) => setMembers(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary font-mono" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
              主体 IDs（company_ids，逗号分隔）
              <input value={companyIds} onChange={(e) => setCompanyIds(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary font-mono" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
              部门 IDs（department_ids，逗号分隔）
              <input value={departmentIds} onChange={(e) => setDepartmentIds(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary font-mono" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
              状态（status）
              <select value={status} onChange={(e) => setStatus(Number(e.target.value))} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary">
                <option value={1}>1 · 启用</option>
                <option value={2}>2 · 停用</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
              关联项目（related_project）
              <input value={relatedProject} onChange={(e) => setRelatedProject(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary font-mono" />
            </label>
          </div>
          <label className="mt-3 flex flex-col gap-1 text-xs text-foreground-secondary">
            备注（extra）
            <input value={extra} onChange={(e) => setExtra(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
            Logo
            <ImageInput value={logo} onChange={setLogo} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
            配色（hex）
            <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#2563eb" className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary font-mono" />
          </label>
        </div>

        {/* design.md 文档 */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-foreground-secondary">design.md 文档</span>
            <div className="flex items-center gap-2">
              {designMdUrl && (
                <span className="text-[11px] text-foreground-muted">{designMdUrl}</span>
              )}
              <button
                type="button"
                onClick={() => mdFileRef.current?.click()}
                className="rounded border border-border-default px-2 py-0.5 text-xs text-foreground-secondary hover:bg-surface-hover"
              >
                上传 .md
              </button>
              <input ref={mdFileRef} type="file" accept=".md,.markdown,.txt" onChange={onMdFile} className="hidden" />
            </div>
          </div>
          <textarea
            value={designMd}
            onChange={(e) => setDesignMd(e.target.value)}
            placeholder="粘贴或上传 design.md 内容…"
            rows={5}
            className="w-full rounded border border-border-default bg-surface-primary px-2 py-1.5 font-mono text-xs text-foreground-primary"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover">取消</button>
          <button disabled={busy} onClick={() => void save()} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50">{isEdit ? '更新' : '创建'}</button>
        </div>
      </div>
    </div>
  );
}
