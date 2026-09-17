/**
 * 业务线报告指南管理 —— /data/guides。
 * 指南 = 拼进 AI 系统提示词的业务线差异配置(品牌视觉/章节结构/展示形式/语调术语)。
 * 0827 ID 方案:结构指南在生成表单直接按 id 选中,scenario 匹配已消灭;isDefault=视觉规范兜底;停用不删除。
 * 0916 g5：合格校验独立弹窗（列表行直接进入）。
 * 0916 #3：编辑指南独立页面（/data/guides/:id/edit），新增仍用弹窗。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { guidesApi, type GuideDTO, type CheckDTO, type DryRunResultDTO } from '@/api/guides';
import { lookupApi, type BusinessLineDTO } from '@/api/lookup';
import { toast } from '../components/Toast';
import { MarkdownPreview } from '../components/MarkdownEditor';

export function GuidePage() {
  const [list, setList] = useState<GuideDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [checksGuide, setChecksGuide] = useState<GuideDTO | null>(null);
  const [businessLines, setBusinessLines] = useState<BusinessLineDTO[]>([]);
  const [filterBl, setFilterBl] = useState('');
  const navigate = useNavigate();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setList(await guidesApi.list(filterBl || undefined));
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [filterBl]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { lookupApi.listBusinessLines().then(setBusinessLines).catch(() => {}); }, []);

  if (loading) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">Loading…</p>;
  }

  const heads = ['#', '指南名称', '业务线', '类型', '状态', '更新时间', ''];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setAdding(true)} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary">新增指南</button>
        <select value={filterBl} onChange={(e) => setFilterBl(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary">
          <option value="">全部业务线</option>
          {businessLines.map((b) => <option key={b.id} value={b.id}>{b.title || b.code}</option>)}
        </select>
        <span className="text-[10px] leading-snug text-foreground-muted">
          指南 = 报告生成时自动带上的该业务线规范（AI Agent 四维中的 Skills + 文件）。类型两档：<b className="text-foreground-secondary">品牌样式</b>（Skill：每次生成自动使用的样式做法）/ <b className="text-foreground-secondary">成套模板</b>（Skill：含配色字体+页面结构的完整做法，可附参考文件，生成报告时按需选用）。
        </span>
      </div>
      <div className="overflow-auto rounded-lg border border-border-default">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="bg-surface-hover text-left text-xs text-foreground-muted">
              {heads.map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {list.map((g, idx) => (
              <tr key={g.id} className="border-t border-border-subtle hover:bg-surface-hover/50">
                <td className="px-3 py-2 font-mono text-xs tabular-nums text-foreground-muted">{idx + 1}</td>
                <td className="px-3 py-2 font-medium text-foreground-primary">{g.name}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{g.businessLine?.title || g.businessLine?.code || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  {g.isDefault ? (
                    <span className="rounded bg-accent-primary/10 px-1.5 py-0.5 text-[11px] text-accent-primary" title="Skill：该业务线每次生成报告都自动使用的样式（配色、字体、组件、动效）">🎨 品牌样式 · 自动使用</span>
                  ) : (
                    <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[11px] text-foreground-secondary" title="Skill：生成报告时在「选用整套模板」下拉中手动选用的成套做法（含页面结构与讲法，可附参考文件）">
                      📐 成套模板 · 按需选用{g.overridesVisual ? ' · 样式独立' : ''}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-foreground-secondary">{g.isActive ? '启用' : '已停用'}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums text-foreground-muted">{g.updatedAt ? String(g.updatedAt).slice(0, 10) : '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <button onClick={() => navigate(`/data/guides/${g.id}/edit`)} className="text-xs text-accent-primary hover:underline">编辑</button>
                  <button onClick={() => setChecksGuide(g)} className="ml-3 text-xs text-accent-primary hover:underline">合格校验</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={heads.length} className="px-3 py-6 text-center text-sm text-foreground-muted">暂无指南——生成报告时该业务线将只用平台通用规则（可先建一份品牌样式统一观感）</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {adding && <GuideFormModal businessLines={businessLines} onSaved={async () => { setAdding(false); await reload(); }} onCancel={() => setAdding(false)} />}
      {checksGuide && <ChecksModal guide={checksGuide} onClose={() => setChecksGuide(null)} />}
    </div>
  );
}

/* ========================= 新增弹窗（创建用；编辑走独立页面） ========================= */

function GuideFormModal({ businessLines, onSaved, onCancel }: {
  businessLines: BusinessLineDTO[]; onSaved: () => void; onCancel: () => void;
}) {
  const [businessLineId, setBusinessLineId] = useState('');
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [overridesVisual, setOverridesVisual] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [distilling, setDistilling] = useState(false);
  const [editMode, setEditMode] = useState<'edit' | 'preview'>('edit');
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function distillFromRecent() {
    if (!businessLineId) { setError('请先选择业务线'); return; }
    if (content.trim() && !window.confirm('当前已有内容,提炼将整体替换,确定?')) return;
    setDistilling(true); setError('');
    try {
      const d = await guidesApi.distill({ businessLineId, guideName: name.trim() || undefined });
      setContent(d.draft);
      toast.success(`提炼完成(来源:${d.sourceFrom === 'recentHtml' ? '该业务线最近生成' : '上传样例'},请修订后保存)`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '提炼失败');
    } finally {
      setDistilling(false);
    }
  }

  async function distillFromUpload(file: File | undefined) {
    if (!file) return;
    if (!/\.html?$/i.test(file.name) && file.type !== 'text/html') { toast.error('请上传 .html 文件'); return; }
    if (file.size > 4.5 * 1024 * 1024) { toast.error('文件超过 4.5MB 上限，请精简后重试'); return; }
    if (content.trim() && !window.confirm('当前已有内容，提炼将整体替换，确定?')) return;
    setDistilling(true); setError('');
    try {
      const html = await file.text();
      const d = await guidesApi.distill({ html, guideName: name.trim() || undefined });
      setContent(d.draft);
      setEditMode('edit');
      toast.success('提炼完成（来源:上传样例），请修订后保存');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '提炼失败');
    } finally {
      setDistilling(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function save() {
    if (!businessLineId) { setError('请选择业务线'); return; }
    if (!name.trim()) { setError('名称不能为空'); return; }
    if (!content.trim()) { setError('指南内容不能为空'); return; }
    setBusy(true); setError('');
    try {
      await guidesApi.create({
        businessLineId,
        name: name.trim(),
        content,
        isDefault,
        overridesVisual: !isDefault && overridesVisual,
        isActive,
      });
      toast.success('创建成功');
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="flex max-h-[90vh] w-[880px] flex-col gap-3 overflow-auto rounded-xl bg-surface-primary p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="font-headings text-sm font-semibold text-foreground-primary">新增指南</div>
        </div>
        {error && <p className="text-xs text-red">{error}</p>}

        <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
          <span>业务线 <span className="text-red">*</span></span>
          <select value={businessLineId} onChange={(e) => setBusinessLineId(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary">
            <option value="">请选择业务线…</option>
            {businessLines.map((b) => <option key={b.id} value={b.id}>{b.title || b.code}（{b.code}）</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
          <span>指南名称 <span className="text-red">*</span></span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 DG 月报指南" className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary" />
        </label>

        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-foreground-secondary">
          <span className="flex items-center justify-between">
            <span>指南内容（Markdown，约定分节：品牌视觉 / 章节结构 / 展示形式偏好 / 语调与术语） <span className="text-red">*</span></span>
            <span className="flex items-center gap-3">
              {editMode === 'edit' ? (
                <button onClick={() => setEditMode('preview')} title="渲染预览 Markdown" className="text-[10px] text-foreground-muted hover:text-foreground-primary">👁 预览</button>
              ) : (
                <button onClick={() => setEditMode('edit')} title="回到源码编辑" className="text-[10px] text-accent-primary hover:underline">✏️ 编辑源码</button>
              )}
              <button onClick={() => void distillFromRecent()} disabled={distilling} title="用该业务线最近生成的报告提炼指南草稿" className="text-[10px] text-accent-primary hover:underline disabled:opacity-40">{distilling ? '⏳ 提炼中(约 1-2 分钟)…' : '✨ 从 HTML 提炼'}</button>
              <button onClick={() => fileRef.current?.click()} disabled={distilling} title="上传本地 HTML 文件提炼指南草稿" className="text-[10px] text-foreground-muted hover:text-foreground-primary disabled:opacity-40">📂 上传提炼</button>
              <input ref={fileRef} type="file" accept=".html,.htm,text/html" className="hidden" onChange={(e) => void distillFromUpload(e.target.files?.[0])} />
            </span>
          </span>
          {editMode === 'edit' ? (
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12} spellCheck={false}
              placeholder={'# {业务线名} 报告指南\n\n## 品牌视觉\n主色 #xxxxxx / 字体 …\n\n## 章节结构\n必须包含 …；不提 …\n\n## 展示形式偏好\n达人列表 ≤6 人卡片，>6 人表格\n\n## 语调与术语\n自称「团队」；用「推广」不用「投放」'}
              className="resize-y rounded border border-border-default bg-surface-primary px-2 py-1.5 font-mono text-xs text-foreground-primary" />
          ) : (
            <div className="h-[19rem] overflow-auto rounded border border-border-default bg-surface-primary px-3 py-2">
              {content.trim() ? <MarkdownPreview content={content} /> : <p className="text-xs text-foreground-muted">暂无内容——切回编辑源码填写。</p>}
            </div>
          )}
        </label>

        {/* 0916 g1：样式选择——两档单选 */}
        <div className="flex flex-col gap-2 rounded-lg border border-border-default bg-surface-secondary px-3 py-2.5">
          <div className="text-xs font-medium text-foreground-secondary">样式选择 <span className="text-foreground-muted">（决定生成报告时颜色字体怎么来）</span></div>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-start gap-2 text-xs text-foreground-secondary">
              <input type="radio" name="style-choice-new" checked={isDefault} onChange={() => { setIsDefault(true); setOverridesVisual(false); }} className="mt-0.5" />
              <span>
                <b className="text-foreground-primary">业务线样式</b>——随该业务线每次生成自动使用的品牌样式（配色、字体、组件、动效）。同业务线唯一，选此项后原默认指南自动取消默认。
              </span>
            </label>
            <label className="flex items-start gap-2 text-xs text-foreground-secondary">
              <input type="radio" name="style-choice-new" checked={!isDefault && overridesVisual} onChange={() => { setIsDefault(false); setOverridesVisual(true); }} className="mt-0.5" />
              <span>
                <b className="text-foreground-primary">样式独立</b>——本指南自带全套配色与字体（如完整 PPT/PDF 模板复刻），生成时<b className="text-foreground-secondary">不再叠加业务线品牌样式</b>，在「选用整套模板」下拉中按需选用。仅在内容含完整色板+字体规范时选此项。
              </span>
            </label>
            <label className="flex items-start gap-2 text-xs text-foreground-secondary">
              <input type="radio" name="style-choice-new" checked={!isDefault && !overridesVisual} onChange={() => { setIsDefault(false); setOverridesVisual(false); }} className="mt-0.5" />
              <span>
                <b className="text-foreground-primary">样式叠加</b>——成套模板但不带独立视觉，生成选用时与业务线品牌样式同时生效。仅在内容不含完整视觉规范时选此项。
              </span>
            </label>
          </div>
        </div>

        <label className="flex items-center gap-1.5 text-xs text-foreground-secondary">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          启用（停用后不参与匹配，不删除）
        </label>

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover">取消</button>
          <button disabled={busy} onClick={() => void save()} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50">创建</button>
        </div>
      </div>
    </div>
  );
}

/* ========================= S2 Checks Modal（合格校验，沿用） ========================= */

/** 0916 g5：合格校验独立弹窗——载入当前生效版 checks → 模板化编辑 + 干跑 → 保存为新版本（正文不变）。 */
function ChecksModal({ guide, onClose }: { guide: GuideDTO; onClose: () => void }) {
  const [checks, setChecks] = useState<CheckDTO[]>([]);
  const [dryRun, setDryRun] = useState<DryRunResultDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    guidesApi.listRevisions(guide.id).then((revs) => {
      const active = revs.find((r) => r.isActive) ?? revs[revs.length - 1];
      if (active?.checks) setChecks(active.checks);
      setLoaded(true);
    }).catch(() => { toast.error('断言加载失败'); setLoaded(true); });
  }, [guide.id]);

  async function runDryRun() {
    if (!checks.length) { toast.error('请先添加至少一条断言'); return; }
    setBusy(true); setDryRun(null);
    try {
      setDryRun(await guidesApi.dryRun(guide.id, checks));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '干跑失败');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const all = await guidesApi.list();
      const g = all.find((x) => x.id === guide.id);
      const content = g?.content ?? '';
      await guidesApi.saveRevision(guide.id, { content, checks, changelog: '合格校验更新' });
      toast.success('合格校验已保存为新版本');
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="flex max-h-[90vh] w-[720px] flex-col gap-3 overflow-auto rounded-xl bg-surface-primary p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="font-headings text-sm font-semibold text-foreground-primary">合格校验 <span className="font-normal text-foreground-muted">— {guide.name}</span></div>
          <button onClick={onClose} className="text-xs text-foreground-muted hover:text-foreground-primary">✕ 关闭</button>
        </div>
        <p className="text-[11px] leading-snug text-foreground-muted">生成后自动核对（先只报告不拦截）。保存即产生新版本（指南正文不变），版本切换在编辑页顶部下拉。</p>
        {!loaded ? <p className="text-xs text-foreground-muted">加载断言中…</p> : (
          <ChecksEditor checks={checks} onChange={setChecks} dryRun={dryRun} onDryRun={() => void runDryRun()} busy={busy} />
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover">取消</button>
          <button disabled={saving || !loaded} onClick={() => void save()} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50">{saving ? '保存中…' : '保存'}</button>
        </div>
      </div>
    </div>
  );
}

/** 断言模板:业务"选规则填参数",不手写 DSL */
const CHECK_TEMPLATES = [
  { value: 'slide_count', label: '页数 = N', build: (n: string) => `slide_count==${n || '1'}`, parse: (a: string) => a.replace(/^slide_count==/, '') },
  { value: 'has_class', label: '必含 CSS 类', build: (x: string) => `has_class ${x}`, parse: (a: string) => a.replace(/^has_class /, '') },
  { value: 'no_element', label: '禁含元素', build: (x: string) => `no_element ${x}`, parse: (a: string) => a.replace(/^no_element /, '') },
  { value: 'contains_text', label: '必含文案', build: (x: string) => `contains_text ${x}`, parse: (a: string) => a.replace(/^contains_text /, '') },
] as const;

function parseTemplate(assert: string): { tpl: string; param: string } {
  if (/^slide_count==/.test(assert)) return { tpl: 'slide_count', param: assert.replace(/^slide_count==/, '') };
  if (/^has_class /.test(assert)) return { tpl: 'has_class', param: assert.replace(/^has_class /, '') };
  if (/^no_element /.test(assert)) return { tpl: 'no_element', param: assert.replace(/^no_element /, '') };
  if (/^contains_text /.test(assert)) return { tpl: 'contains_text', param: assert.replace(/^contains_text /, '') };
  return { tpl: 'contains_text', param: assert };
}

function ChecksEditor({ checks, onChange, dryRun, onDryRun, busy }: {
  checks: CheckDTO[]; onChange: (c: CheckDTO[]) => void; dryRun: DryRunResultDTO | null; onDryRun: () => void; busy: boolean;
}) {
  const update = (i: number, patch: Partial<CheckDTO>) => onChange(checks.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] leading-snug text-foreground-muted">生成后自动核对（先只报告不拦截）。当前仅 lint 报告保存问题。</p>
      {checks.length === 0 && <p className="text-xs text-foreground-muted">暂无断言——点「添加断言」选模板。</p>}
      {checks.map((c, i) => {
        const { tpl, param } = parseTemplate(c.assert);
        return (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select
              value={tpl}
              onChange={(e) => {
                const t = CHECK_TEMPLATES.find((x) => x.value === e.target.value)!;
                update(i, { assert: t.build(param) });
              }}
              className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary"
            >
              {CHECK_TEMPLATES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input
              value={param}
              onChange={(e) => {
                const t = CHECK_TEMPLATES.find((x) => x.value === tpl)!;
                update(i, { assert: t.build(e.target.value) });
              }}
              placeholder={tpl === 'slide_count' ? '如 4' : tpl === 'has_class' ? '如 pub-hero' : tpl === 'no_element' ? '如 nav' : '如 Confidential'}
              className="w-44 rounded border border-border-default bg-surface-primary px-2 py-1 font-mono text-xs text-foreground-primary"
            />
            <select value={c.severity} onChange={(e) => update(i, { severity: e.target.value as CheckDTO['severity'] })} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary">
              <option value="report">报告（不拦截）</option>
              <option value="block">拦截（失败转人工）</option>
            </select>
            <button onClick={() => onChange(checks.filter((_, j) => j !== i))} className="text-xs text-foreground-muted hover:text-red">删除</button>
          </div>
        );
      })}
      <div className="flex items-center gap-2">
        <button onClick={() => onChange([...checks, { assert: 'slide_count==1', severity: 'report' }])} className="rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover">添加断言</button>
        <button disabled={busy || !checks.length} onClick={onDryRun} className="rounded bg-accent-primary px-2 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50">干跑校验</button>
      </div>

      {dryRun && (
        <div className="flex flex-col gap-1 rounded border border-border-default p-2">
          {dryRun.lintErrors.length > 0 && (
            <div className="text-xs text-red">
              {dryRun.lintErrors.map((l, i) => <p key={i}>断言 {l.index + 1}:{l.error}</p>)}
            </div>
          )}
          {!dryRun.hasTarget && <p className="text-[11px] text-foreground-muted">该业务线暂无已生成报告——仅做了语法检查。</p>}
          {dryRun.report && (
            <>
              <div className="text-xs">
                共 {dryRun.report.total} 条 · 通过 {dryRun.report.total - dryRun.report.failed} · 失败 <span className={dryRun.report.failed ? 'text-red font-medium' : ''}>{dryRun.report.failed}</span>
                {dryRun.report.blocked > 0 && <span className="ml-1 text-red">(其中拦截级 {dryRun.report.blocked})</span>}
              </div>
              <table className="w-full border-collapse text-xs">
                <tbody>
                  {dryRun.report.results.map((r, i) => (
                    <tr key={i} className="border-t border-border-subtle">
                      <td className="px-2 py-1 font-mono">{r.passed ? <span className="text-green">✓</span> : <span className={r.severity === 'block' ? 'text-red font-bold' : 'text-yellow-600'}>✗</span>}</td>
                      <td className="px-2 py-1 font-mono text-foreground-primary">{r.assert}</td>
                      <td className="px-2 py-1 text-foreground-muted">{r.passed ? '通过' : (r.actual || r.message || '未通过')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
