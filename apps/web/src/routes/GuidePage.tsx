/**
 * 业务线报告指南管理 —— /data/guides。
 * 指南 = 拼进 AI 系统提示词的业务线差异配置(品牌视觉/章节结构/展示形式/语调术语)。
 * 一个业务线可多份(scenario 切分),isDefault 唯一兜底;停用不删除。
 */
import { useCallback, useEffect, useState } from 'react';
import { guidesApi, type GuideDTO } from '@/api/guides';
import { lookupApi, type BusinessLineDTO } from '@/api/lookup';
import { toast } from '../components/Toast';

const SCENARIO_OPTIONS = ['', '月报', '结案', '复盘'];

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

  const heads = ['#', '指南名称', '业务线', '场景', '默认', '状态', '更新时间', ''];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setAdding(true)} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary">新增指南</button>
        <select value={filterBl} onChange={(e) => setFilterBl(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-primary">
          <option value="">全部业务线</option>
          {businessLines.map((b) => <option key={b.id} value={b.id}>{b.title || b.code}</option>)}
        </select>
      </div>
      <div className="overflow-auto rounded-lg border border-border-default">
        <table className="w-full min-w-[900px] border-collapse text-sm">
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
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{g.scenario || '通用'}</td>
                <td className="px-3 py-2 text-foreground-secondary">{g.isDefault ? '⭐ 默认' : '—'}</td>
                <td className="px-3 py-2 text-foreground-secondary">{g.isActive ? '启用' : '已停用'}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-foreground-muted">{g.updatedAt ? String(g.updatedAt).slice(0, 10) : '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <button onClick={() => setEditingId(g.id)} className="text-xs text-accent-primary hover:underline">编辑</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={heads.length} className="px-3 py-6 text-center text-sm text-foreground-muted">暂无指南——生成时该业务线将只用通用系统提示词</td></tr>
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
  const [scenario, setScenario] = useState('');
  const [customScenario, setCustomScenario] = useState('');
  const [content, setContent] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!guideId) return;
    guidesApi.list().then((all) => {
      const g = all.find((x) => x.id === guideId);
      if (!g) { setError('加载失败'); return; }
      setBusinessLineId(g.businessLineId);
      setName(g.name);
      if (g.scenario && !SCENARIO_OPTIONS.includes(g.scenario)) { setScenario('自定义'); setCustomScenario(g.scenario); }
      else setScenario(g.scenario ?? '');
      setContent(g.content ?? '');
      setIsDefault(!!g.isDefault);
      setIsActive(g.isActive !== false);
    }).catch(() => setError('加载失败'));
  }, [guideId]);

  const finalScenario = scenario === '自定义' ? customScenario.trim() : scenario;

  async function save() {
    if (!businessLineId) { setError('请选择业务线'); return; }
    if (!name.trim()) { setError('名称不能为空'); return; }
    if (!content.trim()) { setError('指南内容不能为空'); return; }
    setBusy(true); setError('');
    try {
      const payload = {
        businessLineId,
        name: name.trim(),
        scenario: finalScenario || undefined,
        content,
        isDefault,
        isActive,
      };
      if (isEdit) await guidesApi.update(guideId!, payload);
      else await guidesApi.create(payload);
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
      <div className="flex max-h-[90vh] w-[640px] flex-col gap-3 overflow-auto rounded-xl bg-surface-primary p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="font-headings text-sm font-semibold text-foreground-primary">{isEdit ? '编辑指南' : '新增指南'}</div>
        {error && <p className="text-xs text-red">{error}</p>}

        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1 text-xs text-foreground-secondary">
            业务线
            <select value={businessLineId} onChange={(e) => setBusinessLineId(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary">
              <option value="">请选择业务线…</option>
              {businessLines.map((b) => <option key={b.id} value={b.id}>{b.title || b.code}（{b.code}）</option>)}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-foreground-secondary">
            报告场景（空=通用，仅可作默认兜底）
            <select value={scenario} onChange={(e) => setScenario(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary">
              {SCENARIO_OPTIONS.map((s) => <option key={s} value={s}>{s || '通用'}</option>)}
              <option value="自定义">自定义…</option>
            </select>
          </label>
        </div>
        {scenario === '自定义' && (
          <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
            自定义场景名
            <input value={customScenario} onChange={(e) => setCustomScenario(e.target.value)} className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary" />
          </label>
        )}

        <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
          指南名称
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 DG 月报指南" className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary" />
        </label>

        <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
          指南内容（Markdown，约定分节：品牌视觉 / 章节结构 / 展示形式偏好 / 语调与术语）
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12} spellCheck={false}
            placeholder={'# {业务线名} 报告指南\n\n## 品牌视觉\n主色 #xxxxxx / 字体 …\n\n## 章节结构\n必须包含 …；不提 …\n\n## 展示形式偏好\n达人列表 ≤6 人卡片，>6 人表格\n\n## 语调与术语\n自称「团队」；用「推广」不用「投放」'}
            className="resize-y rounded border border-border-default bg-surface-primary px-2 py-1.5 font-mono text-xs text-foreground-primary" />
        </label>

        <div className="flex gap-4 text-xs text-foreground-secondary">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            业务线默认（同业务线唯一，设为默认会自动取消其他默认）
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            启用（停用后不参与匹配）
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
