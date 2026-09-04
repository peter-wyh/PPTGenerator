/**
 * 业务线报告指南管理 —— /data/guides。
 * 指南 = 拼进 AI 系统提示词的业务线差异配置(品牌视觉/章节结构/展示形式/语调术语)。
 * 0827 ID 方案:结构指南在生成表单直接按 id 选中,scenario 匹配已消灭;isDefault=视觉规范兜底;停用不删除。
 */
import { useCallback, useEffect, useState } from 'react';
import { guidesApi, type GuideDTO, type GuideRevisionDTO, type CheckDTO, type DryRunResultDTO } from '@/api/guides';
import { lookupApi, type BusinessLineDTO } from '@/api/lookup';
import { toast } from '../components/Toast';


export function GuidePage() {
  const [list, setList] = useState<GuideDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [businessLines, setBusinessLines] = useState<BusinessLineDTO[]>([]);
  const [filterBl, setFilterBl] = useState('');

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
                  <button onClick={() => setEditingId(g.id)} className="text-xs text-accent-primary hover:underline">编辑</button>
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
      {editingId && <GuideFormModal businessLines={businessLines} guideId={editingId} onSaved={async () => { setEditingId(null); await reload(); }} onCancel={() => setEditingId(null)} />}
    </div>
  );
}

/* ========================= Form Modal ========================= */

function GuideFormModal({ guideId, businessLines, onSaved, onCancel }: {
  guideId?: string; businessLines: BusinessLineDTO[]; onSaved: () => void; onCancel: () => void;
}) {
  const isEdit = !!guideId;
  const [businessLineId, setBusinessLineId] = useState('');
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [overridesVisual, setOverridesVisual] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // 0827：指南内容支持全屏编辑（Esc 关闭，与 AiGenerateForm 同交互）
  const [fullscreen, setFullscreen] = useState(false);
  // S1/S2：版本侧栏 + checks 编辑 + 干跑（编辑态专属）
  const [tab, setTab] = useState<'content' | 'checks'>('content');
  const [revisions, setRevisions] = useState<GuideRevisionDTO[]>([]);
  const [revBusy, setRevBusy] = useState(false);
  const [viewRev, setViewRev] = useState<{ version: number; content: string } | null>(null);
  const [checks, setChecks] = useState<CheckDTO[]>([]);
  const [dryRun, setDryRun] = useState<DryRunResultDTO | null>(null);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  useEffect(() => {
    if (!guideId) return;
    guidesApi.list().then((all) => {
      const g = all.find((x) => x.id === guideId);
      if (!g) { setError('加载失败'); return; }
      setBusinessLineId(g.businessLineId);
      setName(g.name);
      setContent(g.content ?? '');
      setIsDefault(!!g.isDefault);
      setOverridesVisual(!!g.overridesVisual);
      setIsActive(g.isActive !== false);
    }).catch(() => setError('加载失败'));
    // S1:版本侧栏数据(activeRevisionId 匹配的版本在侧栏标"生效中")；同时载入当前生效版的 checks 进编辑器
    guidesApi.listRevisions(guideId).then((revs) => {
      setRevisions(revs);
      // 生效版=activeRevisionId 匹配项;无标记时回退最新版(侧栏一致:isActiveRev = i === revisions.length - 1)
      const active = revs.find((r) => r.isActive) ?? revs[revs.length - 1];
      if (active?.checks) setChecks(active.checks);
    }).catch(() => {});
  }, [guideId]);

  /** S1:保存 = 产生新版本(内容/检查同快照);成功后刷新侧栏。 */
  async function save() {
    if (!businessLineId) { setError('请选择业务线'); return; }
    if (!name.trim()) { setError('名称不能为空'); return; }
    if (!content.trim()) { setError('指南内容不能为空'); return; }
    setBusy(true); setError('');
    try {
      const payload = {
        businessLineId,
        name: name.trim(),
        content,
        isDefault,
        overridesVisual: !isDefault && overridesVisual,
        isActive,
      };
      let firstVersion = false;
      if (isEdit) {
        // 元数据走 PATCH;正文变化才建新版本(后端幂等:与最新版一致时返回旧版不重复建)
        await guidesApi.update(guideId!, payload);
        try {
          await guidesApi.saveRevision(guideId!, {
            content,
            checks: checks.length ? checks : undefined,
            changelog: `编辑:${name.trim()}`,
          });
        } catch { /* 与最新版一致等幂等情况不阻断保存 */ }
      } else {
        await guidesApi.create(payload);
        firstVersion = true;
      }
      toast.success(firstVersion ? '创建成功' : '已保存为新版本');
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  /** S1:回滚 = 激活历史版本。 */
  async function activate(version: number) {
    if (!guideId) return;
    if (!window.confirm(`回滚到 v${version} 将立即生效(下次生成即用该版本),确定?`)) return;
    setRevBusy(true);
    try {
      await guidesApi.activateRevision(guideId, version);
      toast.success(`已激活 v${version}`);
      // 正文区同步切到该版本内容,所见即所得
      const rev = await guidesApi.getRevision(guideId, version);
      setContent(rev.content);
      if (rev.checks) setChecks(rev.checks);
      const fresh = await guidesApi.listRevisions(guideId);
      setRevisions(fresh);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '回滚失败');
    } finally {
      setRevBusy(false);
    }
  }

  /** S1:查看历史版本全文(只读)。 */
  async function viewVersion(version: number) {
    if (!guideId) return;
    try {
      const rev = await guidesApi.getRevision(guideId, version);
      setViewRev({ version, content: rev.content });
    } catch {
      toast.error('版本内容加载失败');
    }
  }

  /** S2:干跑校验——对当前 checks 跑 lint + 断言(靶子=该业务线最近一次生成)。 */
  async function runDryRun() {
    if (!guideId) return;
    if (!checks.length) { toast.error('请先添加至少一条断言'); return; }
    setRevBusy(true); setDryRun(null);
    try {
      setDryRun(await guidesApi.dryRun(guideId, checks));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '干跑失败');
    } finally {
      setRevBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="flex max-h-[90vh] w-[880px] flex-col gap-3 overflow-auto rounded-xl bg-surface-primary p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="font-headings text-sm font-semibold text-foreground-primary">{isEdit ? '编辑指南' : '新增指南'}</div>
          {/* S1/S2:编辑态标签页——正文 / 合格校验 */}
          {isEdit && (
            <div className="flex gap-1 text-xs">
              <button onClick={() => setTab('content')} className={`rounded px-2 py-0.5 ${tab === 'content' ? 'bg-accent-primary text-foreground-inverse' : 'text-foreground-secondary hover:bg-surface-hover'}`}>正文</button>
              <button onClick={() => setTab('checks')} className={`rounded px-2 py-0.5 ${tab === 'checks' ? 'bg-accent-primary text-foreground-inverse' : 'text-foreground-secondary hover:bg-surface-hover'}`}>合格校验</button>
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red">{error}</p>}

        {tab === 'content' && (
          <>
        {/* 双层模型说明:解释「这份指南怎么生效」——配置页最大的理解成本 */}
        <div className="rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-[11px] leading-relaxed text-foreground-muted">
          保存后如何生效：<b className="text-foreground-secondary">品牌样式</b>（业务线默认）→ 该业务线每次生成报告都自动带上，管「长什么样」（配色、字体、组件、动效）；<b className="text-foreground-secondary">成套模板</b> → 生成报告时在「选用整套模板」下拉中手动选用才生效，管「分几章怎么讲」（页面结构、展示形式、语气），可附参考文件（原版 PPT/PDF 等样张），不与品牌样式冲突时同时生效。
        </div>

        <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
          <span>业务线 <span className="text-red">*</span></span>
          <select value={businessLineId} onChange={(e) => setBusinessLineId(e.target.value)} disabled={isEdit} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary">
            <option value="">请选择业务线…</option>
            {businessLines.map((b) => <option key={b.id} value={b.id}>{b.title || b.code}（{b.code}）</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
          <span>指南名称 <span className="text-red">*</span></span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 DG 月报指南" className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary" />
        </label>

        <div className="flex items-start gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-foreground-secondary">
            <span className="flex items-center justify-between">
              <span>指南内容（Markdown，约定分节：品牌视觉 / 章节结构 / 展示形式偏好 / 语调与术语） <span className="text-red">*</span></span>
              <button onClick={() => setFullscreen(true)} title="全屏编辑" className="text-[10px] text-foreground-muted hover:text-foreground-primary">⛶ 全屏</button>
            </span>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12} spellCheck={false}
              placeholder={'# {业务线名} 报告指南\n\n## 品牌视觉\n主色 #xxxxxx / 字体 …\n\n## 章节结构\n必须包含 …；不提 …\n\n## 展示形式偏好\n达人列表 ≤6 人卡片，>6 人表格\n\n## 语调与术语\n自称「团队」；用「推广」不用「投放」'}
              className="resize-y rounded border border-border-default bg-surface-primary px-2 py-1.5 font-mono text-xs text-foreground-primary" />
          </label>

          {/* S1 版本侧栏:旧→新,当前生效高亮;查看=只读全文,激活=回滚 */}
          {isEdit && (
            <div className="flex w-44 shrink-0 flex-col gap-1">
              <div className="text-[10px] font-medium uppercase tracking-wide text-foreground-muted">版本（旧→新）</div>
              <div className="max-h-72 overflow-auto rounded border border-border-default">
                {revisions.length === 0 && <p className="px-2 py-3 text-[11px] text-foreground-muted">暂无版本——保存后生成 v1</p>}
                {revisions.map((r, i) => {
                  const isActiveRev = i === revisions.length - 1;
                  return (
                    <div key={r.id} className={`flex items-center justify-between gap-1 border-b border-border-subtle px-2 py-1.5 last:border-0 ${isActiveRev ? 'bg-surface-hover' : ''}`}>
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-foreground-primary">v{r.version}{isActiveRev && <span className="ml-1 rounded bg-green/15 px-1 text-[9px] text-green">生效中</span>}</div>
                        <div className="truncate text-[10px] text-foreground-muted">{r.changelog || (r.createdAt ? String(r.createdAt).slice(0, 10) : '')}</div>
                        {r.assets && r.assets.length > 0 && (
                          <div className="truncate text-[10px] text-accent-primary" title={r.assets.map((a) => `${a.kind === 'sample' ? '样张' : a.kind === 'tokens' ? '色彩字体' : a.kind === 'checklist' ? '清单' : a.kind}: ${a.name || a.ref}${a.hash ? ` (指纹 ${a.hash.slice(0, 8)})` : ''}`).join('\n')}>
                            📎 {r.assets.length} 个参考文件：{r.assets.map((a) => a.name || a.ref).join('、')}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button onClick={() => void viewVersion(r.version)} className="text-[10px] text-accent-primary hover:underline">查看</button>
                        {!isActiveRev && (
                          <button disabled={revBusy} onClick={() => void activate(r.version)} className="text-[10px] text-foreground-secondary hover:text-red disabled:opacity-40">回滚</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] leading-snug text-foreground-muted">保存即产生新版本;回滚立即生效,可再滚回。</p>
            </div>
          )}
        </div>

        {/* 0827：指南内容全屏编辑器（Esc 关闭） */}
        {tab === 'content' && fullscreen && (
          <div className="fixed inset-0 z-[70] flex flex-col bg-surface-primary">
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-border-default px-4">
              <span className="text-sm font-medium text-foreground-primary">指南内容编辑器</span>
              <button onClick={() => setFullscreen(false)} className="rounded-md px-2 py-1 text-xs text-foreground-muted hover:bg-surface-hover">
                ✕ 关闭 (Esc)
              </button>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              autoFocus
              placeholder={'# {业务线名} 报告指南\n\n## 品牌视觉\n主色 #xxxxxx / 字体 …\n\n## 章节结构\n必须包含 …；不提 …\n\n## 展示形式偏好\n达人列表 ≤6 人卡片，>6 人表格\n\n## 语调与术语\n自称「团队」；用「推广」不用「投放」'}
              className="flex-1 resize-none bg-surface-primary p-6 font-mono text-sm leading-relaxed text-foreground-primary focus:outline-none"
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex gap-4 text-xs text-foreground-secondary">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={isDefault} onChange={(e) => { setIsDefault(e.target.checked); if (e.target.checked) setOverridesVisual(false); }} />
              品牌样式（业务线默认，每次生成自动使用；同业务线唯一，勾选后自动取消其他默认）
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              启用（停用后不参与匹配，不删除）
            </label>
          </div>
          {/* overridesVisual:结构指南声明自带全套视觉 → 生成时跳过视觉规范层。仅非默认指南可勾 */}
          {!isDefault && (
            <label className="flex items-start gap-1.5 rounded border border-border-default bg-surface-secondary px-2 py-1.5 text-[11px] leading-relaxed text-foreground-muted">
              <input type="checkbox" checked={overridesVisual} onChange={(e) => setOverridesVisual(e.target.checked)} className="mt-0.5" />
              <span>
                <b className="text-foreground-secondary">样式独立</b>——本 Skill 自带全套配色与字体（如完整 PPT/PDF 模板复刻）。勾选后生成时<b className="text-foreground-secondary">不再叠加业务线品牌样式</b>，颜色字体完全以本模板为准。仅在内容含完整色板+字体规范时勾选。
              </span>
            </label>
          )}
        </div>
          </>
        )}

        {/* S2:合格校验标签——4 类断言模板下拉 + 干跑 */}
        {isEdit && tab === 'checks' && (
          <ChecksEditor checks={checks} onChange={setChecks} dryRun={dryRun} onDryRun={() => void runDryRun()} busy={revBusy} />
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover">取消</button>
          <button disabled={busy} onClick={() => void save()} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50">{isEdit ? '保存为新版本' : '创建'}</button>
        </div>
      </div>
      {/* S1:历史版本只读全文 */}
      {viewRev && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40" onClick={() => setViewRev(null)}>
          <div className="flex max-h-[85vh] w-[720px] flex-col gap-2 rounded-xl bg-surface-primary p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground-primary">v{viewRev.version} 内容（只读）</span>
              <button onClick={() => setViewRev(null)} className="text-xs text-foreground-muted hover:text-foreground-primary">✕ 关闭</button>
            </div>
            <pre className="flex-1 overflow-auto whitespace-pre-wrap rounded border border-border-default bg-surface-primary p-3 font-mono text-xs text-foreground-primary">{viewRev.content}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================= S2 Checks Editor ========================= */

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
  checks: CheckDTO[];
  onChange: (c: CheckDTO[]) => void;
  dryRun: DryRunResultDTO | null;
  onDryRun: () => void;
  busy: boolean;
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

      {/* 干跑结果 */}
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
