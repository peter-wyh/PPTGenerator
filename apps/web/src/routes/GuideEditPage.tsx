/**
 * 编辑指南（独立页面）—— /data/guides/:id/edit。
 * 0916 #3：从 880px 弹窗改为独立页面，编辑区有充分宽度。
 * 0916 #4：版本下拉默认选中当前生效版，支持切换历史版（只读）与回滚激活。
 * 布局：顶部指南元信息 + 版本下拉；左侧编辑区（编辑/预览/提炼/全屏）；右侧参考文件与版本信息。
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { guidesApi, type GuideDTO, type GuideRevisionDTO } from '@/api/guides';
import { lookupApi } from '@/api/lookup';
import { toast } from '../components/Toast';
import { MarkdownPreview } from '../components/MarkdownEditor';

/** antd 式表单行：label 定宽右对齐 + 全角冒号（空 label 仅占位不带冒号），控件列同一起点。 */
function FormRow({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <div className={`w-24 shrink-0 pt-1.5 text-right text-xs leading-5 text-foreground-secondary${label ? " after:content-['：']" : ''}`}>{label ?? ''}</div>
      <div className="min-w-0 flex-1 text-xs leading-5 text-foreground-primary">{children}</div>
    </div>
  );
}

export function GuideEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [guide, setGuide] = useState<GuideDTO | null>(null);
  const [businessLineName, setBusinessLineName] = useState('');
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [overridesVisual, setOverridesVisual] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState<'edit' | 'preview'>('edit');
  const [distilling, setDistilling] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  // #4 版本状态：revisions 全量、selVer 当前下拉选中版、dirty 编辑器相对选中版有改动
  const [revisions, setRevisions] = useState<GuideRevisionDTO[]>([]);
  const [selVer, setSelVer] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [assetView, setAssetView] = useState<{ name: string; ref: string; content: string; truncated: boolean } | null>(null);
  const [assetLoading, setAssetLoading] = useState(false);
  // 样式选择联动：展示业务线设计规范（designMd）
  const [designMd, setDesignMd] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    guidesApi.list().then((all) => {
      const g = all.find((x) => x.id === id);
      if (!g) { setError('指南不存在'); return; }
      setGuide(g);
      setBusinessLineName(g.businessLine?.title || g.businessLine?.code || '');
      setName(g.name);
      setContent(g.content ?? '');
      setIsDefault(!!g.isDefault);
      setOverridesVisual(!!g.overridesVisual);
      setIsActive(g.isActive !== false);
      // #联动：拉业务线设计规范（选「业务线样式/样式叠加」时展示）
      lookupApi.listBusinessLines().then((bls) => {
        const bl = bls.find((x) => x.id === g.businessLineId);
        setDesignMd(bl?.designMd ?? '');
      }).catch(() => setDesignMd(''));
    }).catch(() => setError('加载失败'));
    guidesApi.listRevisions(id).then((revs) => {
      setRevisions(revs);
      const active = revs.find((r) => r.isActive) ?? revs[revs.length - 1];
      if (active) setSelVer(active.version);
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  /** #4：下拉切换历史版本（只读载入编辑区，不自动激活）。 */
  async function pickVersion(version: number) {
    if (dirty && !window.confirm('编辑区有未保存改动，切换版本将丢弃，确定?')) return;
    try {
      const rev = await guidesApi.getRevision(id!, version);
      setContent(rev.content);
      setSelVer(version);
      setDirty(false);
      setEditMode('edit');
    } catch {
      toast.error('版本内容加载失败');
    }
  }

  /** 保存 = 新版本 + 即生效（后端 saveRevision 同步置 activeRevisionId）。 */
  async function save() {
    if (!name.trim()) { setError('名称不能为空'); return; }
    if (!content.trim()) { setError('指南内容不能为空'); return; }
    setBusy(true); setError('');
    try {
      await guidesApi.update(id!, {
        name: name.trim(),
        content,
        isDefault,
        overridesVisual: !isDefault && overridesVisual,
        isActive,
      });
      const rev = await guidesApi.saveRevision(id!, { content, changelog: `编辑:${name.trim()}` });
      toast.success(`已保存为 v${rev.version} 并生效`);
      setDirty(false);
      const fresh = await guidesApi.listRevisions(id!);
      setRevisions(fresh);
      setSelVer(fresh.find((r) => r.isActive)?.version ?? rev.version);
      const all = await guidesApi.list();
      const g = all.find((x) => x.id === id);
      if (g) setGuide(g);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  /** 回滚 = 激活历史版本（后端同步 Guide.content）。 */
  async function activate(version: number) {
    if (!id) return;
    if (!window.confirm(`回滚到 v${version} 将立即生效(下次生成即用该版本),确定?`)) return;
    setBusy(true);
    try {
      await guidesApi.activateRevision(id, version);
      toast.success(`已激活 v${version}`);
      const rev = await guidesApi.getRevision(id, version);
      setContent(rev.content);
      setSelVer(version);
      setDirty(false);
      const fresh = await guidesApi.listRevisions(id);
      setRevisions(fresh);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '回滚失败');
    } finally {
      setBusy(false);
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
      setDirty(true);
      setEditMode('edit');
      toast.success('提炼完成（来源:上传样例），请修订后保存');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '提炼失败');
    } finally {
      setDistilling(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  /** g6:查看参考文件内容。sample=外链样张直接新窗开;其余文本资产走 asset-content 端点。 */
  async function openAsset(version: number, a: { kind: string; ref: string; hash?: string; name?: string }) {
    if (a.kind === 'sample' && /^https?:/.test(a.ref)) { window.open(a.ref, '_blank'); return; }
    if (!id) return;
    setAssetLoading(true);
    try {
      const d = await guidesApi.getRevisionAssetContent(id, version, a.ref);
      setAssetView({ name: a.name || a.ref, ref: a.ref, content: d.content, truncated: d.truncated });
    } catch {
      toast.error('参考文件加载失败');
    } finally {
      setAssetLoading(false);
    }
  }

  if (error && !guide) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">{error}</p>;
  }
  if (!guide) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">加载中…</p>;
  }

  const activeRev = revisions.find((r) => r.isActive);
  const selRev = revisions.find((r) => r.version === selVer);
  const activeIsSel = activeRev?.version === selVer;
  const descRev = activeRev; // 参考文件随生效版

  return (
    <div className="flex flex-col gap-4">
      {/* 顶部：返回 */}
      <div>
        <button onClick={() => navigate('/data/guides')} className="text-xs text-foreground-muted hover:text-foreground-primary">← 指南列表</button>
      </div>

      <div className="flex flex-col gap-3">
        <FormRow label="指南名称">
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setDirty(true); }}
            className="w-full max-w-xl rounded border border-border-default bg-surface-primary px-2 py-1.5 text-xs text-foreground-primary"
          />
        </FormRow>
        <FormRow label="业务线">{businessLineName || '—'}</FormRow>
        <FormRow label="状态">{isActive ? '启用' : '已停用'}</FormRow>
        <FormRow label="版本">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selVer ?? ''}
              onChange={(e) => void pickVersion(Number(e.target.value))}
              className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary"
            >
              {revisions.length === 0 && <option value="">暂无版本</option>}
              {[...revisions].reverse().map((r) => (
                <option key={r.id ?? r.version} value={r.version}>
                  v{r.version}{r.isActive ? '（生效中）' : ''} · {r.changelog || (r.createdAt ? String(r.createdAt).slice(0, 10) : '')}
                </option>
              ))}
            </select>
            {selVer != null && !activeIsSel && (
              <button disabled={busy} onClick={() => void activate(selVer)} className="rounded border border-border-default px-2.5 py-1 text-xs text-foreground-secondary hover:bg-surface-hover disabled:opacity-40">
                回滚到 v{selVer}
              </button>
            )}
            <span className="text-foreground-muted">编辑区载入 v{selVer ?? '–'}{activeIsSel ? '' : '（非生效版）'}</span>
            {dirty && <span className="text-yellow-600">有未保存改动</span>}
          </div>
          {selRev && (
            <div className="mt-1 flex flex-col gap-0.5 text-[11px] text-foreground-muted">
              <div>变更：{selRev.changelog || '—'}</div>
              <div>时间：{selRev.createdAt ? String(selRev.createdAt).slice(0, 16).replace('T', ' ') : '—'}　断言：{selRev.checks?.length ?? 0} 条</div>
              {!activeIsSel && <div className="text-yellow-600">此为历史版本，编辑后保存将产生新版本</div>}
            </div>
          )}
        </FormRow>
      </div>

      {/* 主区：编辑器（全宽）+ 参考文件随其后 */}
      <div className="flex flex-col gap-3">
        <FormRow label="指南内容">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-foreground-secondary">
                <span>Markdown，约定分节：品牌视觉 / 章节结构 / 展示形式偏好 / 语调与术语 <span className="text-red">*</span></span>
                <span className="flex items-center gap-3">
                  {editMode === 'edit' ? (
                    <button onClick={() => setEditMode('preview')} title="渲染预览 Markdown" className="text-[10px] text-foreground-muted hover:text-foreground-primary">👁 预览</button>
                  ) : (
                    <button onClick={() => setEditMode('edit')} title="回到源码编辑" className="text-[10px] text-accent-primary hover:underline">✏️ 编辑源码</button>
                  )}
                  <button onClick={() => fileRef.current?.click()} disabled={distilling} title="上传本地 HTML 文件提炼指南草稿" className="text-[10px] text-foreground-muted hover:text-foreground-primary disabled:opacity-40">📂 上传提炼</button>
                  <input ref={fileRef} type="file" accept=".html,.htm,text/html" className="hidden" onChange={(e) => void distillFromUpload(e.target.files?.[0])} />
                  <button onClick={() => setFullscreen(true)} title="全屏编辑（Esc 关闭）" className="text-[10px] text-foreground-muted hover:text-foreground-primary">⛶ 全屏</button>
                </span>
              </div>
              {editMode === 'edit' ? (
                <textarea
                  value={content}
                  onChange={(e) => { setContent(e.target.value); setDirty(true); }}
                  rows={22}
                  spellCheck={false}
                  placeholder={'# {业务线名} 报告指南\n\n## 品牌视觉\n主色 #xxxxxx / 字体 …\n\n## 章节结构\n必须包含 …；不提 …\n\n## 展示形式偏好\n达人列表 ≤6 人卡片，>6 人表格\n\n## 语调与术语\n自称「团队」；用「推广」不用「投放」'}
                  className="resize-y rounded border border-border-default bg-surface-primary px-3 py-2 font-mono text-xs leading-relaxed text-foreground-primary"
                />
              ) : (
                <div className="h-[34rem] overflow-auto rounded border border-border-default bg-surface-primary px-3 py-2">
                  {content.trim() ? <MarkdownPreview content={content} /> : <p className="text-xs text-foreground-muted">暂无内容——切回编辑源码填写。</p>}
                </div>
              )}
            </div>
          </FormRow>

        {/* 参考文件（随生效版）——指南内容下方 */}
        <FormRow label="参考文件">
          <div className="flex flex-col gap-1.5">
            {(descRev?.assets ?? []).length === 0 && <p className="text-[11px] text-foreground-muted">本指南暂无参考文件</p>}
            {(descRev?.assets ?? []).length > 0 && (
              <p className="text-[11px] text-foreground-muted">生成报告时随指南一起生效：CSS/色彩字体自动注入页面，样张与清单供对照参考。点击文件名可查看内容。</p>
            )}
            {(descRev?.assets ?? []).map((a, i) => {
              const kindLabel = (k: string) => (k === 'sample' ? '样张' : k === 'tokens' ? '色彩字体' : k === 'checklist' ? '清单' : k);
              return (
                <div key={a.ref + i} className="flex items-center gap-2 rounded border border-border-default bg-surface-secondary px-2.5 py-1.5">
                  <span className="shrink-0 rounded bg-accent-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-primary">{kindLabel(a.kind)}</span>
                  <button onClick={() => void openAsset(descRev!.version, a)} disabled={assetLoading} className="min-w-0 truncate text-left text-xs font-medium text-foreground-primary hover:underline disabled:opacity-40" title={a.ref}>{a.name || a.ref}</button>
                  {a.hash && <span className="ml-auto shrink-0 text-[10px] text-foreground-muted" title={`内容指纹 ${a.hash}`}>{a.hash.slice(0, 8)}</span>}
                </div>
              );
            })}
          </div>
        </FormRow>
      </div>

      {/* 样式选择 + 启用（antd 表单行式）+ 选项联动预览 */}
      <div className="flex flex-col gap-3">
        <FormRow label="样式选择">
          <div className="flex flex-col gap-2">
            <label className="flex items-start gap-2 text-foreground-secondary">
              <input type="radio" name="style-choice-edit" checked={isDefault} onChange={() => { setIsDefault(true); setOverridesVisual(false); }} className="mt-0.5" />
              <span><b className="text-foreground-primary">业务线样式</b>——随该业务线每次生成自动使用的品牌样式。同业务线唯一，选此项后原默认指南自动取消默认。</span>
            </label>
            <label className="flex items-start gap-2 text-foreground-secondary">
              <input type="radio" name="style-choice-edit" checked={!isDefault && overridesVisual} onChange={() => { setIsDefault(false); setOverridesVisual(true); }} className="mt-0.5" />
              <span><b className="text-foreground-primary">样式独立</b>——本指南自带全套配色与字体，生成时<b className="text-foreground-secondary">不再叠加业务线品牌样式</b>。仅在内容含完整色板+字体规范时选此项。</span>
            </label>
            <label className="flex items-start gap-2 text-foreground-secondary">
              <input type="radio" name="style-choice-edit" checked={!isDefault && !overridesVisual} onChange={() => { setIsDefault(false); setOverridesVisual(false); }} className="mt-0.5" />
              <span><b className="text-foreground-primary">样式叠加</b>——成套模板但不带独立视觉，生成选用时与业务线品牌样式同时生效。</span>
            </label>
            <span className="text-foreground-muted">决定生成报告时颜色字体怎么来</span>
          </div>
        </FormRow>
        {/* #联动：按当前选项展示生成时实际生效的样式来源 */}
        <FormRow label="生效样式">
            <div className="rounded border border-border-default bg-surface-secondary px-3 py-2 text-[11px] leading-5 text-foreground-secondary">
              {isDefault ? (
                <div>
                  <div className="font-medium text-foreground-primary">业务线设计规范（design.md）</div>
                  {designMd == null ? <div className="text-foreground-muted">加载中…</div>
                    : designMd.trim() ? (
                      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-foreground-secondary">{designMd}</pre>
                    ) : <div className="text-yellow-600">该业务线未配置设计规范——生成将没有品牌样式可叠加</div>}
                </div>
              ) : overridesVisual ? (
                <div>
                  <div className="font-medium text-foreground-primary">本指南内容自带全套视觉（下方指南内容 + 参考文件）</div>
                  <div className="text-foreground-muted">生成时不叠加业务线 design.md，视觉以指南与参考资产为准</div>
                </div>
              ) : (
                <div>
                  <div className="font-medium text-foreground-primary">业务线设计规范 + 本指南叠加</div>
                  {designMd == null ? <div className="text-foreground-muted">加载中…</div>
                    : designMd.trim() ? (
                      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-foreground-secondary">{designMd}</pre>
                    ) : <div className="text-yellow-600">该业务线未配置设计规范——仅本指南的版式约定生效</div>}
                </div>
              )}
            </div>
          </FormRow>
        <FormRow label="启用">
          <label className="flex items-center gap-1.5 text-foreground-secondary">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            启用（停用后不参与匹配，不删除）
          </label>
        </FormRow>
      </div>

      {/* 保存（表单底部，冒号列对齐） */}
      <FormRow label="">
        <button disabled={busy} onClick={() => void save()} className="rounded bg-accent-primary px-4 py-1.5 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50">
          {busy ? '保存中…' : dirty ? '保存为新版本' : '保存'}
        </button>
      </FormRow>

      {/* 全屏编辑器 */}
      {fullscreen && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-surface-primary">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-border-default px-4">
            <span className="text-sm font-medium text-foreground-primary">指南内容编辑器 — {name}</span>
            <button onClick={() => setFullscreen(false)} className="rounded-md px-2 py-1 text-xs text-foreground-muted hover:bg-surface-hover">
              ✕ 关闭 (Esc)
            </button>
          </div>
          <textarea
            value={content}
            onChange={(e) => { setContent(e.target.value); setDirty(true); }}
            spellCheck={false}
            autoFocus
            className="flex-1 resize-none bg-surface-primary p-6 font-mono text-sm leading-relaxed text-foreground-primary focus:outline-none"
          />
        </div>
      )}

      {/* 参考文件查看器 */}
      {assetView && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/40" onClick={() => setAssetView(null)}>
          <div className="flex max-h-[85vh] w-[760px] flex-col gap-2 rounded-xl bg-surface-primary p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground-primary">参考文件：{assetView.name}</span>
              <button onClick={() => setAssetView(null)} className="text-xs text-foreground-muted hover:text-foreground-primary">✕ 关闭</button>
            </div>
            <p className="text-[10px] text-foreground-muted">{assetView.ref}{assetView.truncated ? ' · 文件超过 512KB,已截断显示' : ''}</p>
            <pre className="flex-1 overflow-auto whitespace-pre-wrap rounded border border-border-default bg-surface-primary p-3 font-mono text-xs text-foreground-primary">{assetView.content}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
