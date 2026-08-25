import { useState, useEffect, useMemo } from 'react';
import { htmlTemplatesApi, type ModuleCoverageResult } from '@/api/htmlTemplates';
import { Button } from '@/components/Button';
import { MarkdownPreview } from '@/components/MarkdownEditor';
import { getPresetsForBL } from '@/report-presets';

type Mode = 'ai' | 'recipe';

interface Props {
  campaignId?: string;
  /** ★ 报告周期(project.meta.reportPeriod)——模块覆盖预检的判定口径 */
  reportPeriod?: { startDate?: string; endDate?: string };
  onGenerate: (vals: { mode: Mode; prompt: string; designMd: string; scenario: string }) => void;
  generating?: boolean;
  generateLabel?: string;
  error?: string;
}

export function AiGenerateForm({ campaignId, reportPeriod, onGenerate, generating, generateLabel, error }: Props) {
  const [mode, setMode] = useState<Mode>('ai');
  const [prompt, setPrompt] = useState('');
  const [selectedPresetIdx, setSelectedPresetIdx] = useState(0);
  const [scenario, setScenario] = useState('');

  const [designMd, setDesignMd] = useState('');
  const [designMdLoading, setDesignMdLoading] = useState(false);
  const [designMdSource, setDesignMdSource] = useState('');
  const [guides, setGuides] = useState<{ id: string; name: string; layer: 'visual' | 'structural' }[]>([]);
  const [blCode, setBlCode] = useState('');
  const [designMdExpanded, setDesignMdExpanded] = useState(false);
  // ★ 场景下拉动态化:业务线实际存在的 scenario 值(拉不到=空数组隐藏字段)
  const [scenarioOptions, setScenarioOptions] = useState<string[]>([]);
  const [scenarioTouched, setScenarioTouched] = useState(false); // 用户手动选过→不再自动推导

  const [systemPrompt, setSystemPrompt] = useState('');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [promptFullscreen, setPromptFullscreen] = useState(false);
  const [systemPromptFullscreen, setSystemPromptFullscreen] = useState(false);
  const [guideFullscreen, setGuideFullscreen] = useState(false);

  // ★ 模块覆盖预检（生成前）——campaignId/reportPeriod 变化时拉取
  const [moduleCoverage, setModuleCoverage] = useState<ModuleCoverageResult | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(false);

  const presets = useMemo(() => getPresetsForBL(blCode || undefined), [blCode]);

  useEffect(() => {
    if (presets.length > 0) {
      setPrompt(presets[0].requirement);
      setSelectedPresetIdx(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blCode]);

  // ★ 回显=实际注入:同 resolveForCampaign(campaignId, scenario) 口径。
  //   scenario 变化(场景下拉切换)即重查——用户看到哪份,生成时就注入哪份。
  useEffect(() => {
    if (!campaignId) {
      setScenarioOptions([]);
      return;
    }
    htmlTemplatesApi
      .getGuideScenarios(campaignId)
      .then(setScenarioOptions)
      .catch(() => setScenarioOptions([]));
  }, [campaignId]);

  // ★ 模板自动推导场景:用户没手动选过时,preset 的 reportType=campaign → 场景自动对齐
  //   业务线存在的 campaign-report 指南(如「DM Campaign Report 报告指南」立即复活);
  //   AI 智能排版(requirement 空)不强制,保持用户上一次选择或空。
  useEffect(() => {
    if (scenarioTouched || !scenarioOptions.length) return;
    const preset = presets[selectedPresetIdx];
    const want = preset?.reportType === 'campaign' && scenarioOptions.includes('campaign-report')
      ? 'campaign-report'
      : preset?.requirement === '' ? scenario : // 智能排版:不动
        scenarioOptions.includes('campaign-report') ? 'campaign-report' : '';
    if (want !== scenario) setScenario(want);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPresetIdx, scenarioOptions]);

  useEffect(() => {
    if (!campaignId) return;
    setDesignMdLoading(true);
    htmlTemplatesApi
      .getDesignGuide(campaignId, scenario || undefined)
      .then((data) => {
        setDesignMd(data.designMd || '');
        setDesignMdSource(data.businessLineName || '');
        setGuides(data.guides ?? []);
        setBlCode(data.businessLineCode || '');
      })
      .catch(() => {})
      .finally(() => setDesignMdLoading(false));
  }, [campaignId, scenario]);

  useEffect(() => {
    if (!campaignId) {
      setModuleCoverage(null);
      return;
    }
    setCoverageLoading(true);
    htmlTemplatesApi
      .getModuleCoverage(campaignId, reportPeriod)
      .then(setModuleCoverage)
      .catch(() => setModuleCoverage(null))
      .finally(() => setCoverageLoading(false));
  }, [campaignId, reportPeriod?.startDate, reportPeriod?.endDate]);

  useEffect(() => {
    if (!promptFullscreen && !systemPromptFullscreen && !guideFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPromptFullscreen(false);
        setSystemPromptFullscreen(false);
        setGuideFullscreen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [promptFullscreen, systemPromptFullscreen, guideFullscreen]);

  const handleGenerate = () => {
    onGenerate({
      mode,
      prompt: mode === 'ai' ? prompt : '',
      designMd: mode === 'ai' ? designMd.trim() : '',
      scenario,
    });
  };

  const triggerSystemPrompt = () => {
    if (!systemPrompt) {
      htmlTemplatesApi.getSystemPrompt().then(setSystemPrompt);
    }
    setShowSystemPrompt(!showSystemPrompt);
  };

  return (
    <>
      {/* Mode tabs */}
      <div className="mb-4">
        <label className="mb-2 block text-xs font-medium text-foreground-muted">生成方式</label>
        <div className="flex gap-2">
          <button
            onClick={() => setMode('ai')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm transition ${
              mode === 'ai'
                ? 'bg-accent-primary text-foreground-inverse'
                : 'bg-surface-hover text-foreground-secondary'
            }`}
          >
            🤖 AI 生成
          </button>
          <button
            onClick={() => setMode('recipe')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm transition ${
              mode === 'recipe'
                ? 'bg-accent-primary text-foreground-inverse'
                : 'bg-surface-hover text-foreground-secondary'
            }`}
          >
            📋 Recipe 模板
          </button>
        </div>
      </div>

      {/* ★ 数据覆盖预检——生成前展示哪些模块有数据/缺数据 */}
      {campaignId && (coverageLoading || moduleCoverage) && (
        <div className="mb-4 rounded-lg border border-border-default">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-medium text-foreground-secondary">📊 数据覆盖预检</span>
            {moduleCoverage && (
              <span className="text-[10px] text-foreground-muted">
                {moduleCoverage.modules.filter((m) => m.status === 'ok').length}/{moduleCoverage.modules.length} 模块有数据
              </span>
            )}
          </div>
          {coverageLoading ? (
            <p className="px-3 pb-2 text-center text-[11px] text-foreground-muted">检测中…</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border-default px-3 py-2">
              {moduleCoverage!.modules.map((m) => (
                <div
                  key={m.key}
                  className="flex items-center gap-1.5 text-[11px]"
                  title={m.detail || m.label}
                >
                  <span
                    className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                      m.status === 'ok' ? 'bg-green' : 'bg-red'
                    }`}
                  />
                  <span className={m.status === 'ok' ? 'text-foreground-secondary' : 'font-medium text-red'}>
                    {m.label}
                  </span>
                  {m.status === 'missing' && (
                    <span className="shrink-0 text-[10px] text-red" title={m.detail}>✕</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {moduleCoverage && moduleCoverage.modules.some((m) => m.status === 'missing') && (
            <p className="border-t border-border-default px-3 py-1.5 text-[10px] leading-relaxed text-amber-500">
              ⚠️ 红点模块无数据：生成时将渲染 Data Unavailable 占位（不编造）。可在数据管理导入对应数据后重新检测。
            </p>
          )}
        </div>
      )}

      {/* Mode-specific config */}
      {mode === 'ai' ? (
        <div className="space-y-4">
          {/* ══ 提示词构成:①系统 ②指南 ③用户 —— 三层同框,顺序=实际拼装顺序 ══ */}
          <div>
            <div className="mb-2 px-0.5">
              <span className="text-sm font-bold text-foreground-primary">🧱 提示词</span>
            </div>

            {/* ① 系统提示词 — 平台规则,自动注入,只读 */}
            <div className="border-b border-border-default">
              <div className="flex items-center justify-between px-3 py-2 hover:bg-surface-hover">
                <button onClick={triggerSystemPrompt} className="flex min-w-0 items-center gap-1.5 text-xs text-foreground-secondary">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-surface-hover text-[10px] font-semibold text-foreground-muted">①</span>
                  <span className="shrink-0">系统提示词</span>
                  <span className="shrink-0 rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-muted">平台规则 · 自动注入 · 只读</span>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  {showSystemPrompt && systemPrompt && (
                    <button
                      onClick={() => setSystemPromptFullscreen(true)}
                      className="text-[10px] text-foreground-muted hover:text-foreground-primary"
                      title="全屏查看"
                    >
                      ⛶
                    </button>
                  )}
                  <button onClick={triggerSystemPrompt} className="text-foreground-muted">
                    {showSystemPrompt ? '▾' : '▸'}
                  </button>
                </div>
              </div>
              {showSystemPrompt && (
                <div className="max-h-[400px] overflow-y-auto border-t border-border-default bg-white p-4">
                  {systemPrompt ? (
                    <MarkdownPreview content={systemPrompt} />
                  ) : (
                    <p className="text-center text-[11px] text-foreground-muted">加载中…</p>
                  )}
                </div>
              )}
            </div>

            {/* ② 业务线指南 — 双层(视觉+结构)自动注入,只读;报告场景在此选择 */}
            <div className="border-b border-border-default">
              <button
                onClick={() => setDesignMdExpanded(!designMdExpanded)}
                className="flex w-full items-center justify-between px-3 py-2 hover:bg-surface-hover"
              >
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-foreground-secondary">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-surface-hover text-[10px] font-semibold text-foreground-muted">②</span>
                  <span className="shrink-0">业务线指南</span>
                  {guides.length > 0 ? (
                    <span
                      className="max-w-[220px] truncate rounded bg-accent-primary/10 px-1.5 py-0.5 text-[10px] text-accent-primary"
                      title={guides.map((g) => g.name).join(' + ')}
                    >
                      📎 {guides.map((g) => g.name).join(' + ')}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-muted">
                      {campaignId ? '本业务线未配置' : '未绑定 Campaign'}
                    </span>
                  )}
                  <span className="shrink-0 rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-muted">自动注入 · 只读</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {scenario !== '' && (
                    <span className="text-[10px] text-foreground-muted">场景: {scenario}</span>
                  )}
                  <span className="text-foreground-muted">{designMdExpanded ? '▾' : '▸'}</span>
                </span>
              </button>
              {designMdExpanded && (
                <div className="space-y-2 border-t border-border-default p-3">
                  {/* 报告场景 — 结构层指南匹配(scenario 精确);视觉层规范恒注入 */}
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-foreground-muted">
                      报告场景（决定叠加哪份结构指南；视觉规范恒注入）
                    </label>
                    {campaignId && scenarioOptions.length > 0 ? (
                      <select
                        value={scenario}
                        onChange={(e) => {
                          setScenarioTouched(true);
                          setScenario(e.target.value);
                        }}
                        className="w-full rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-foreground-primary outline-none focus:border-accent-primary"
                      >
                        <option value="">通用（仅视觉规范，不叠加结构指南）</option>
                        {scenarioOptions.map((sc) => (
                          <option key={sc} value={sc}>{sc}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-[11px] text-foreground-muted">
                        {campaignId
                          ? '当前业务线未配置场景指南——生成仅注入默认设计规范。'
                          : '未绑定 Campaign，无业务线指南。'}
                      </p>
                    )}
                  </div>
                  {designMdLoading ? (
                    <p className="text-center text-[11px] text-foreground-muted">指南加载中…</p>
                  ) : designMd.trim() ? (
                    <>
                      <p className="text-[10px] leading-relaxed text-foreground-muted">
                        ★ 生成时双层注入（只读）：
                        {guides.map((g) => (
                          <span key={g.id}>
                            {' '}· {g.layer === 'visual' ? '视觉规范' : '结构指南'}：
                            <b className="text-foreground-secondary">{g.name}</b>
                          </span>
                        ))}
                        {designMdSource && <>　|　维护入口：数据管理 → 指南（{designMdSource}）</>}
                      </p>
                      <div className="mb-1 flex justify-end">
                        <button
                          onClick={() => setGuideFullscreen(true)}
                          className="text-[10px] text-foreground-muted hover:text-foreground-primary"
                          title="全屏查看"
                        >
                          ⛶ 全屏
                        </button>
                      </div>
                      <textarea
                        value={designMd}
                        readOnly
                        rows={6}
                        placeholder="业务线指南内容（品牌色、字体、报告结构要求等）…"
                        className="w-full resize-y rounded border border-border-default bg-surface-secondary px-2 py-1.5 font-mono text-[11px] text-foreground-secondary placeholder:text-foreground-muted focus:border-accent-primary focus:outline-none"
                      />
                    </>
                  ) : (
                    <p className="text-[11px] text-foreground-muted">无匹配指南内容。</p>
                  )}
                </div>
              )}
            </div>

            {/* ③ 用户提示词 — 唯一可编辑层;模板=快速填充 */}
            <div className="p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-foreground-secondary">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-accent-primary/10 text-[10px] font-semibold text-accent-primary">③</span>
                  <span className="shrink-0">用户提示词</span>
                  <span className="shrink-0 rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-muted">
                    {prompt.trim() === ''
                      ? 'AI 自主决策'
                      : prompt.trim() === (presets[selectedPresetIdx]?.requirement ?? '').trim()
                        ? `模板填充：${presets[selectedPresetIdx].label}`
                        : '自定义'}
                  </span>
                </span>
                <button
                  onClick={() => setPromptFullscreen(true)}
                  className="text-[10px] text-foreground-muted hover:text-foreground-primary"
                  title="全屏编辑"
                >
                  ⛶ 全屏
                </button>
              </div>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="shrink-0 text-[10px] text-foreground-muted">快速填充</span>
                <select
                  value={selectedPresetIdx}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    setSelectedPresetIdx(idx);
                    setPrompt(presets[idx].requirement);
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-border-default bg-surface-primary px-2.5 py-1.5 text-xs text-foreground-primary outline-none focus:border-accent-primary"
                >
                  {presets.map((p, idx) => (
                    <option key={p.label} value={idx}>
                      {p.label}
                      {idx === 0 ? '（默认）' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                spellCheck={false}
                placeholder="留空 = AI 完全自主决策（推荐）&#10;&#10;或输入差异化指令，如：&#10;• 突出 ROI 和达人排名&#10;• 用深色主题 / 隐藏 Footer&#10;• 增加 Publisher 截图列"
                className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[13px] leading-relaxed text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500"
              />
              {presets[selectedPresetIdx]?.description && (
                <p className="mt-1 text-[10px] leading-relaxed text-foreground-muted">
                  {presets[selectedPresetIdx].description}
                </p>
              )}
              {!campaignId && (
                <p className="mt-1.5 text-[10px] text-amber-500">
                  ⚠️ 未绑定 Campaign，AI 将生成通用模板（无真实数据）
                </p>
              )}
            </div>
          </div>

          {/* 合成指示 — 三层如何变成最终提示词 */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] text-foreground-muted">
            <span className="rounded bg-surface-hover px-1.5 py-0.5">① 系统</span>+
            <span className="rounded bg-surface-hover px-1.5 py-0.5">② 指南</span>+
            <span className="rounded bg-surface-hover px-1.5 py-0.5">③ 指令</span>
            <span className="text-accent-primary">→ 自动合成 → 生成报告</span>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-surface-hover px-3 py-4 text-center">
          <p className="text-xs text-foreground-secondary">
            📋 Recipe 模板模式
          </p>
          <p className="mt-1 text-[11px] text-foreground-muted">
            用本地结构化模板渲染报告(快速、稳定、可四层编辑)。
          </p>
          {!campaignId && (
            <p className="mt-1.5 text-[10px] text-amber-500">
              ⚠️ 未绑定 Campaign,需填 Campaign ID 才能渲染真实数据
            </p>
          )}
        </div>
      )}

      {/* Generate button */}
      <div className="mt-5">
        <Button
          onClick={handleGenerate}
          loading={generating}
          disabled={mode === 'recipe' ? !campaignId : generating}
          className="w-full"
        >
          {generating ? '生成中…' : (generateLabel ?? '✨ 生成报告')}
        </Button>
        {error && (
          <p className="mt-2 rounded-lg bg-red/10 px-3 py-2 text-xs text-red">{error}</p>
        )}
      </div>

      {/* ── Fullscreen Modal: Prompt Editor ── */}
      {promptFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 px-4">
            <span className="text-sm font-medium text-slate-800">提示词编辑器</span>
            <button
              onClick={() => setPromptFullscreen(false)}
              className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
            >
              ✕ 关闭 (Esc)
            </button>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            spellCheck={false}
            autoFocus
            className="flex-1 resize-none bg-white p-6 text-[14px] leading-relaxed text-slate-800 focus:outline-none"
            placeholder="输入提示词…"
          />
        </div>
      )}

      {/* ── Fullscreen Modal: Guide (双层合并全文,只读) ── */}
      {guideFullscreen && designMd.trim() && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 px-4">
            <span className="text-sm font-medium text-slate-800">
              📎 业务线指南（只读）{guides.length > 0 && <span className="ml-1 text-slate-400">— {guides.map((g) => g.name).join(' + ')}</span>}
            </span>
            <button
              onClick={() => setGuideFullscreen(false)}
              className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
            >
              ✕ 关闭 (Esc)
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <pre className="mx-auto max-w-4xl overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-[12px] leading-relaxed font-mono text-slate-600 whitespace-pre-wrap">{designMd}</pre>
          </div>
        </div>
      )}

      {/* ── Fullscreen Modal: System Prompt ── */}
      {systemPromptFullscreen && systemPrompt && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 px-4">
            <span className="text-sm font-medium text-slate-800">📋 系统提示词 (SYSTEM_PROMPT)</span>
            <button
              onClick={() => setSystemPromptFullscreen(false)}
              className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
            >
              ✕ 关闭 (Esc)
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="mx-auto max-w-4xl">
              <MarkdownPreview content={systemPrompt} />
              {designMd.trim() && (
                <>
                  <hr className="my-6 border-slate-200" />
                  <div className="mb-3 text-sm font-semibold text-slate-800">
                    📎 业务线设计规范 (design.md) {designMdSource && <span className="ml-1 text-slate-400">— {designMdSource}</span>}
                  </div>
                  <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-[12px] leading-relaxed font-mono text-slate-600 whitespace-pre-wrap">{designMd}</pre>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
