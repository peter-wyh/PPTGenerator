import { useState, useEffect, useMemo } from 'react';
import { htmlTemplatesApi } from '@/api/htmlTemplates';
import { Button } from '@/components/Button';
import { MarkdownPreview } from '@/components/MarkdownEditor';
import { getPresetsForBL } from '@/report-presets';

type Mode = 'ai' | 'recipe';

interface Props {
  campaignId?: string;
  onGenerate: (vals: { mode: Mode; prompt: string; designMd: string }) => void;
  generating?: boolean;
  generateLabel?: string;
  error?: string;
}

export function AiGenerateForm({ campaignId, onGenerate, generating, generateLabel, error }: Props) {
  const [mode, setMode] = useState<Mode>('ai');
  const [prompt, setPrompt] = useState('');
  const [selectedPresetIdx, setSelectedPresetIdx] = useState(0);

  const [designMd, setDesignMd] = useState('');
  const [designMdLoading, setDesignMdLoading] = useState(false);
  const [designMdSource, setDesignMdSource] = useState('');
  const [blCode, setBlCode] = useState('');
  const [designMdExpanded, setDesignMdExpanded] = useState(false);

  const [systemPrompt, setSystemPrompt] = useState('');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [promptFullscreen, setPromptFullscreen] = useState(false);
  const [systemPromptFullscreen, setSystemPromptFullscreen] = useState(false);

  const presets = useMemo(() => getPresetsForBL(blCode || undefined), [blCode]);

  useEffect(() => {
    if (presets.length > 0) {
      setPrompt(presets[0].requirement);
      setSelectedPresetIdx(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blCode]);

  useEffect(() => {
    if (!campaignId) return;
    setDesignMdLoading(true);
    htmlTemplatesApi
      .getDesignGuide(campaignId)
      .then((data) => {
        setDesignMd(data.designMd || '');
        setDesignMdSource(data.businessLineName || '');
        setBlCode(data.businessLineCode || '');
      })
      .catch(() => {})
      .finally(() => setDesignMdLoading(false));
  }, [campaignId]);

  useEffect(() => {
    if (!promptFullscreen && !systemPromptFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPromptFullscreen(false);
        setSystemPromptFullscreen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [promptFullscreen, systemPromptFullscreen]);

  const handleGenerate = () => {
    onGenerate({
      mode,
      prompt: mode === 'ai' ? prompt : '',
      designMd: mode === 'ai' ? designMd.trim() : '',
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

      {/* Mode-specific config */}
      {mode === 'ai' ? (
        <div className="space-y-4">
          {/* 提示词模板 — 下拉选择 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground-muted">
              提示词模板
            </label>
            <select
              value={selectedPresetIdx}
              onChange={(e) => {
                const idx = Number(e.target.value);
                setSelectedPresetIdx(idx);
                setPrompt(presets[idx].requirement);
              }}
              className="w-full rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-foreground-primary outline-none focus:border-accent-primary"
            >
              {presets.map((p, idx) => (
                <option key={p.label} value={idx}>
                  {p.label}
                  {idx === 0 ? '（默认）' : ''}
                </option>
              ))}
            </select>
            {presets[selectedPresetIdx]?.description && (
              <p className="mt-1 text-[10px] leading-relaxed text-foreground-muted">
                {presets[selectedPresetIdx].description}
              </p>
            )}
          </div>

          {/* 提示词编辑器 */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-foreground-muted">提示词</label>
              <div className="flex items-center gap-2">
                {designMd.trim() && (
                  <span
                    className="flex items-center gap-1 rounded bg-accent-primary/10 px-1.5 py-0.5 text-[10px] text-accent-primary"
                    title="业务线设计规范会自动注入到 AI 生成请求中"
                  >
                    📎 {'{{design.md}}'} 已注入
                  </span>
                )}
                <button
                  onClick={() => setPromptFullscreen(true)}
                  className="text-[10px] text-foreground-muted hover:text-foreground-primary"
                  title="全屏编辑"
                >
                  ⛶ 全屏
                </button>
              </div>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={10}
              spellCheck={false}
              placeholder="留空 = AI 完全自主决策（推荐）&#10;&#10;或输入差异化指令，如：&#10;• 突出 ROI 和达人排名&#10;• 用深色主题 / 隐藏 Footer&#10;• 增加 Publisher 截图列"
              className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[13px] leading-relaxed text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500"
            />
            {/* 系统提示词回显 — header 与提示词 section 保持一致 */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <button
                  onClick={triggerSystemPrompt}
                  className="text-xs font-medium text-foreground-muted hover:text-foreground-primary"
                >
                  {showSystemPrompt ? '▾' : '▸'} <span>系统提示词</span>
                  <span className="ml-1 rounded bg-surface-hover px-1 py-0.5 text-[10px] text-foreground-muted">SYSTEM_PROMPT</span>
                </button>
                {showSystemPrompt && systemPrompt && (
                  <button
                    onClick={() => setSystemPromptFullscreen(true)}
                    className="text-[10px] text-foreground-muted hover:text-foreground-primary"
                    title="全屏查看"
                  >
                    ⛶ 全屏
                  </button>
                )}
              </div>
              {showSystemPrompt && systemPrompt && (
                <div className="max-h-[400px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-4">
                  <MarkdownPreview content={systemPrompt} />
                  {designMd.trim() && (
                    <>
                      <hr className="my-4 border-slate-200" />
                      <div className="mb-2 text-[12px] font-semibold text-slate-800">
                        📎 业务线设计规范 (design.md)
                      </div>
                      <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-[11px] leading-relaxed font-mono text-slate-600 whitespace-pre-wrap">{designMd}</pre>
                    </>
                  )}
                </div>
              )}
            </div>
            {!campaignId && (
              <p className="mt-1.5 text-[10px] text-amber-500">
                ⚠️ 未绑定 Campaign，AI 将生成通用模板（无真实数据）
              </p>
            )}
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

      {/* design.md section */}
      {mode === 'ai' && campaignId && (
        <div className="mt-4 rounded-lg border border-border-default">
          <button
            onClick={() => setDesignMdExpanded(!designMdExpanded)}
            className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-foreground-secondary hover:bg-surface-hover"
          >
            <span className="flex items-center gap-1.5">
              🎨 业务线设计规范
              {designMdSource && (
                <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-muted">
                  {designMdSource}
                </span>
              )}
              {designMd.trim() && (
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" title="已加载" />
              )}
            </span>
            <span className="text-foreground-muted">{designMdExpanded ? '▾' : '▸'}</span>
          </button>
          {designMdExpanded && (
            <div className="border-t border-border-default p-3">
              {designMdLoading ? (
                <p className="text-center text-[11px] text-foreground-muted">加载中…</p>
              ) : (
                <>
                  <p className="mb-1.5 text-[10px] text-foreground-muted">
                    编辑后点击「生成报告」时自动注入。留空则不附加。
                  </p>
                  <textarea
                    value={designMd}
                    onChange={(e) => setDesignMd(e.target.value)}
                    rows={6}
                    placeholder="业务线 design.md 内容（品牌色、字体、报告结构要求等）…"
                    className="w-full resize-y rounded border border-border-default bg-surface-secondary px-2 py-1.5 font-mono text-[11px] text-foreground-primary placeholder:text-foreground-muted focus:border-accent-primary focus:outline-none"
                  />
                </>
              )}
            </div>
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
