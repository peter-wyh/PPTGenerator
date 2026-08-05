/**
 * HtmlStudio — Report Agent 混合模式工作台。
 * 独立全屏路由 /projects/:id/html-studio。
 *
 * 混合模式：首次生成用配置面板（保证质量），生成完成后自动保存并切换到 Chat 面板（自然语言迭代编辑）。
 *
 * 左侧：phase=config → 配置面板；phase=chat → AgentChatPanel
 * 右侧：预览区（iframe）+ 可选源码面板
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  htmlTemplatesApi,
  type HtmlTemplateSummary,
  type AgentChatMessage,
} from '@/api/htmlTemplates';
import { projectsApi } from '@/api/projects';
import { Button } from '@/components/Button';
import { MarkdownEditor, MarkdownPreview } from '@/components/MarkdownEditor';
import type { ProjectDetail, ProjectMeta } from '@mediakit/shared';
import { getPresetsForBL } from '@/report-presets';
import { AgentChatPanel } from './AgentChatPanel';

type Mode = 'template' | 'ai';

export function HtmlStudio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loadingProject, setLoadingProject] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);

  // ★ 混合模式阶段：config = 首次生成配置；chat = 生成后迭代编辑
  const [phase, setPhase] = useState<'config' | 'chat'>('config');
  // ★ Agent 对话历史
  const [agentHistory, setAgentHistory] = useState<AgentChatMessage[]>([]);

  // 配置面板状态
  const [mode, setMode] = useState<Mode>('ai');
  const [templates, setTemplates] = useState<HtmlTemplateSummary[]>([]);
  const [selectedTpl, setSelectedTpl] = useState<string>('');

  // ★ 根据 project 关联的业务线动态获取预设
  const blCode = project?.meta?.businessLine as string | undefined;
  const presets = useMemo(() => getPresetsForBL(blCode), [blCode]);

  const [prompt, setPrompt] = useState('');
  const [selectedPresetIdx, setSelectedPresetIdx] = useState(0);

  // ★ BL 确定后自动填充该 BL 的第一个预设
  // 用 blCode 作为依赖（而非 presets）——避免 prompt 变化触发循环
  useEffect(() => {
    if (presets.length > 0) {
      setPrompt(presets[0].requirement);
      setSelectedPresetIdx(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blCode]);

  // 生成状态
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // design.md 回显/编辑
  const [designMd, setDesignMd] = useState('');
  const [designMdLoading, setDesignMdLoading] = useState(false);
  const [designMdExpanded, setDesignMdExpanded] = useState(false);
  const [designMdSource, setDesignMdSource] = useState('');

  // 系统提示词回显
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);

  // 左侧面板折叠（沉浸模式）
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  // ★ 源码面板（右侧可折叠）
  const [showSource, setShowSource] = useState(false);

  // 加载项目信息
  useEffect(() => {
    if (!id) return;
    setLoadingProject(true);
    projectsApi
      .get(id)
      .then((p) => {
        setProject(p);
        // ★ 检测是否有 htmlContent → 直接进入 chat 阶段
        projectsApi
          .getHtml(id)
          .then((data) => {
            if (data.html) {
              setGeneratedHtml(data.html);
              setSaved(true);
              setPhase('chat');
              // 从 meta 加载历史对话
              const history = (p.meta as Record<string, unknown>)?.agentHistory as
                | AgentChatMessage[]
                | undefined;
              if (history && Array.isArray(history) && history.length > 0) {
                setAgentHistory(history);
              } else {
                setAgentHistory([
                  {
                    role: 'assistant',
                    content: '报告已加载。你可以用自然语言继续编辑。',
                    action: 'generate',
                    ts: new Date().toISOString(),
                  },
                ]);
              }
            }
          })
          .catch(() => {});
      })
      .catch(() => setProjectError('报告加载失败或不存在'))
      .finally(() => setLoadingProject(false));
  }, [id]);

  // 加载 templates
  useEffect(() => {
    htmlTemplatesApi.list({ status: 'PUBLISHED' }).then(setTemplates).catch(() => {});
  }, []);

  // 加载 design.md
  const campaignId = project?.meta?.campaignId;
  // ★ reportPeriod：报告实际时间范围，优先于 campaign 全局起止日期
  const reportPeriod = project?.meta?.reportPeriod as
    | { startDate?: string; endDate?: string }
    | undefined;
  useEffect(() => {
    if (!campaignId) return;
    setDesignMdLoading(true);
    htmlTemplatesApi
      .getDesignGuide(campaignId)
      .then((data) => {
        setDesignMd(data.designMd || '');
        setDesignMdSource(data.businessLineName || '');
      })
      .catch(() => {})
      .finally(() => setDesignMdLoading(false));
  }, [campaignId]);

  // 更新 meta.aiHtmlStatus
  const updateAiHtmlStatus = useCallback(
    async (status: 'generated' | 'generating' | 'pending') => {
      if (!id || !project) return;
      const mergedMeta: ProjectMeta = { ...project.meta, aiHtmlStatus: status };
      try {
        await projectsApi.update(id, { meta: mergedMeta });
        setProject((prev) => (prev ? { ...prev, meta: mergedMeta } : prev));
      } catch {
        // 静默失败 — 状态更新不影响核心流程
      }
    },
    [id, project],
  );

  // ★ handleGenerate — 生成成功后自动保存 + 切换到 chat 阶段
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError('');
    setGeneratedHtml('');
    setSaved(false);
    void updateAiHtmlStatus('generating');
    try {
      const html = await htmlTemplatesApi.generate({
        mode,
        templateId: mode === 'template' ? selectedTpl : undefined,
        prompt: mode === 'ai' ? prompt : undefined,
        campaignId,
        designMd: mode === 'ai' && designMd.trim() ? designMd.trim() : undefined,
        reportPeriod,
      });
      setGeneratedHtml(html);

      // ★ 即生即存：生成成功后自动保存到 project.htmlContent
      if (id) {
        try {
          await htmlTemplatesApi.autoSave(id, html);
          setSaved(true);
        } catch {
          // 自动保存失败不阻塞流程
        }
      }

      void updateAiHtmlStatus('generated');

      // ★ 切换到 Chat 阶段
      setPhase('chat');
      const genMsg: AgentChatMessage = {
        role: 'assistant',
        content:
          '✨ 报告已生成并自动保存！你可以用自然语言修改，比如：「把标题改成 XXX」「KPI 卡片用品牌色渐变」',
        action: 'generate',
        ts: new Date().toISOString(),
      };
      setAgentHistory([genMsg]);
    } catch (e: unknown) {
      const err = e as {
        response?: { data?: { error?: { message?: string }; message?: string } };
        message?: string;
      };
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          err.message ||
          '生成失败，请重试',
      );
      void updateAiHtmlStatus('pending');
    } finally {
      setGenerating(false);
    }
  }, [mode, selectedTpl, prompt, campaignId, designMd, reportPeriod, updateAiHtmlStatus, id]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(generatedHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generatedHtml]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([generatedHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project?.name || 'report'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [generatedHtml, project]);

  const campaignName = project?.meta?.campaignInfo?.campaignName;
  void campaignName;

  if (loadingProject) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-sm text-gray-400">加载中…</div>
      </div>
    );
  }
  if (projectError || !project) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-red">{projectError || '报告不存在'}</p>
          <Button variant="secondary" className="mt-4" onClick={() => navigate('/projects')}>
            返回报告列表
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface-subtle">
      {/* ────── Top Bar ────── */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border-default bg-surface-primary px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/projects')}
            className="text-sm text-foreground-muted transition hover:text-foreground-primary"
            title="返回报告列表"
          >
            ← 返回
          </button>
          <span className="h-4 w-px bg-border-default" />
          <h1 className="text-sm font-medium text-foreground-primary">
            ⚡ Report Agent
          </h1>
          <span className="text-xs text-foreground-muted">· {project.name}</span>
          {phase === 'chat' && (
            <span className="rounded bg-accent-primary/10 px-1.5 py-0.5 text-[10px] text-accent-primary">
              Chat 模式
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saved && !generating && (
            <span className="flex items-center gap-1 text-xs text-green">
              <span className="h-1.5 w-1.5 rounded-full bg-green" /> 已保存
            </span>
          )}
          {/* 源码面板切换（仅 chat 阶段） */}
          {phase === 'chat' && (
            <button
              onClick={() => setShowSource(!showSource)}
              className={`rounded-md px-2 py-1 text-xs transition ${
                showSource
                  ? 'bg-accent-primary text-foreground-inverse'
                  : 'text-foreground-secondary hover:bg-surface-hover'
              }`}
              title="查看/编辑 HTML 源码"
            >
              {'</>'} 源码
            </button>
          )}
          {/* 返回配置（仅 chat 阶段，允许重新生成） */}
          {phase === 'chat' && (
            <button
              onClick={() => {
                if (confirm('返回配置面板将重新生成报告，当前内容会被覆盖。确定？')) {
                  setPhase('config');
                  setGeneratedHtml('');
                  setSaved(false);
                  setShowSource(false);
                }
              }}
              className="rounded-md px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
              title="重新配置并生成"
            >
              🔄 重新生成
            </button>
          )}
          <button
            onClick={() => setPanelCollapsed(!panelCollapsed)}
            className="rounded-md px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            {panelCollapsed ? '☰ 展开' : '⬅ 收起'}
          </button>
        </div>
      </header>

      {/* ────── Main Area ────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Panel: Config (phase=config) or Chat (phase=chat) ── */}
        {!panelCollapsed && (
          <aside className="flex w-[380px] shrink-0 flex-col overflow-hidden border-r border-border-default bg-surface-primary">
            {phase === 'config' ? (
              <div className="flex flex-1 flex-col overflow-y-auto p-5">
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
                      onClick={() => setMode('template')}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm transition ${
                        mode === 'template'
                          ? 'bg-accent-primary text-foreground-inverse'
                          : 'bg-surface-hover text-foreground-secondary'
                      }`}
                    >
                      📋 模板填充
                    </button>
                  </div>
                </div>

                {/* Mode-specific config */}
                {mode === 'ai' ? (
                  <div className="space-y-4">
                    {/* 提示词模板 */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-foreground-muted">
                        提示词模板
                      </label>
                      <div className="flex flex-col gap-1.5">
                        {presets.map((p, idx) => (
                          <button
                            key={p.label}
                            onClick={() => {
                              setSelectedPresetIdx(idx);
                              setPrompt(p.requirement);
                            }}
                            className={`rounded-lg border px-3 py-2 text-left transition ${
                              selectedPresetIdx === idx
                                ? 'border-accent-primary bg-accent-primary/5'
                                : 'border-border-default hover:border-border-strong hover:bg-surface-hover'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-foreground-primary">{p.label}</span>
                              {idx === 0 && (
                                <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[9px] text-foreground-muted">
                                  默认
                                </span>
                              )}
                            </div>
                            {p.description && (
                              <p className="mt-0.5 text-[10px] leading-relaxed text-foreground-muted">
                                {p.description}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 提示词编辑器（合并了设计规范 + 内容要求） */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className="text-xs font-medium text-foreground-muted">提示词</label>
                        {designMd.trim() && (
                          <span
                            className="flex items-center gap-1 rounded bg-accent-primary/10 px-1.5 py-0.5 text-[10px] text-accent-primary"
                            title="业务线设计规范会自动注入到 AI 生成请求中"
                          >
                            📎 {'{{design.md}}'} 已注入
                          </span>
                        )}
                      </div>
                      <MarkdownEditor
                        value={prompt}
                        onChange={setPrompt}
                        rows={10}
                        placeholder="输入提示词，描述你想要的报告结构、重点指标、视觉风格…&#10;&#10;💡 选择上方模板可快速填充，design.md 会作为变量自动注入。"
                      />
                      {/* design.md 变量展开/编辑 */}
                      {campaignId && designMd.trim() && (
                        <button
                          onClick={() => setDesignMdExpanded(!designMdExpanded)}
                          className="mt-1.5 flex items-center gap-1 text-[10px] text-foreground-muted hover:text-foreground-primary"
                        >
                          {designMdExpanded ? '▾' : '▸'} 查看/编辑 design.md
                          {designMdSource && (
                            <span className="rounded bg-surface-hover px-1 py-0.5">{designMdSource}</span>
                          )}
                        </button>
                      )}
                      {designMdExpanded && designMd.trim() && (
                        <MarkdownEditor
                          value={designMd}
                          onChange={setDesignMd}
                          rows={8}
                        />
                      )}
                      {/* 系统提示词回显 */}
                      <button
                        onClick={() => {
                          if (!systemPrompt) {
                            htmlTemplatesApi.getSystemPrompt().then(setSystemPrompt);
                          }
                          setShowSystemPrompt(!showSystemPrompt);
                        }}
                        className="mt-2 flex items-center gap-1 text-[10px] text-foreground-muted hover:text-foreground-primary"
                      >
                        {showSystemPrompt ? '▾' : '▸'} 查看系统提示词
                        <span className="rounded bg-surface-hover px-1 py-0.5">SYSTEM_PROMPT</span>
                      </button>
                      {showSystemPrompt && systemPrompt && (
                        <div className="mt-1.5 max-h-[400px] overflow-y-auto rounded-lg border border-border-default bg-surface-secondary p-3">
                          <MarkdownPreview content={systemPrompt} />
                        </div>
                      )}
                      {!campaignId && (
                        <p className="mt-1.5 text-[10px] text-amber-500">
                          ⚠️ 未绑定 Campaign，AI 将生成通用模板（无真实数据）
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="mb-2 block text-xs font-medium text-foreground-muted">选择模板</label>
                    {templates.length === 0 ? (
                      <p className="rounded-lg bg-surface-hover px-3 py-4 text-center text-xs text-foreground-muted">
                        暂无已发布的 HTML 模板
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {templates.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setSelectedTpl(t.id)}
                            className={`rounded-lg border px-3 py-2 text-left transition ${
                              selectedTpl === t.id
                                ? 'border-accent-primary bg-accent-primary/10'
                                : 'border-border-default hover:border-border-strong'
                            }`}
                          >
                            <div className="text-sm font-medium text-foreground-primary">{t.name}</div>
                            {t.description && (
                              <div className="mt-0.5 text-[11px] text-foreground-muted">{t.description}</div>
                            )}
                          </button>
                        ))}
                      </div>
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
                    disabled={mode === 'template' ? !selectedTpl : generating}
                    className="w-full"
                  >
                    {generating ? '生成中… (~2-3min)' : '✨ 生成报告'}
                  </Button>
                  {error && (
                    <p className="mt-2 rounded-lg bg-red/10 px-3 py-2 text-xs text-red">{error}</p>
                  )}
                </div>
              </div>
            ) : (
              <AgentChatPanel
                projectId={id || ''}
                currentHtml={generatedHtml}
                agentHistory={agentHistory}
                onHtmlChange={(html) => setGeneratedHtml(html)}
                onHistoryChange={setAgentHistory}
              />
            )}
          </aside>
        )}

        {/* ── Right: Preview + Source Panel ── */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface-subtle">
          {generatedHtml ? (
            <>
              {/* Toolbar */}
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-border-default bg-surface-primary px-4">
                <div className="flex items-center gap-2">
                  {/* Device toggle */}
                  <div className="flex rounded-md border border-border-default">
                    <button
                      onClick={() => setPreviewDevice('desktop')}
                      className={`rounded-l-md px-2.5 py-1 text-xs transition ${
                        previewDevice === 'desktop'
                          ? 'bg-accent-primary text-foreground-inverse'
                          : 'text-foreground-secondary hover:bg-surface-hover'
                      }`}
                    >
                      🖥️ 桌面
                    </button>
                    <button
                      onClick={() => setPreviewDevice('mobile')}
                      className={`rounded-r-md px-2.5 py-1 text-xs transition ${
                        previewDevice === 'mobile'
                          ? 'bg-accent-primary text-foreground-inverse'
                          : 'text-foreground-secondary hover:bg-surface-hover'
                      }`}
                    >
                      📱 移动
                    </button>
                  </div>
                  <span className="text-[11px] text-foreground-muted">
                    {previewDevice === 'desktop' ? '1280px' : '375px'} 预览
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={handleCopy} className="px-2 py-1 text-xs">
                    {copied ? '✓ 已复制' : '📋 复制源码'}
                  </Button>
                  <Button variant="ghost" onClick={handleDownload} className="px-2 py-1 text-xs">
                    💾 下载
                  </Button>
                </div>
              </div>

              {/* Preview + Source side-by-side */}
              <div className="flex flex-1 overflow-hidden">
                {/* iframe preview */}
                <div className="flex flex-1 items-start justify-center overflow-auto p-4">
                  <iframe
                    ref={iframeRef}
                    srcDoc={generatedHtml}
                    title="HTML Report Preview"
                    className={`h-full bg-white shadow-lg transition-all ${
                      previewDevice === 'desktop' ? 'w-full' : 'w-[375px]'
                    }`}
                    style={{
                      borderRadius: 8,
                      border: '1px solid var(--border-default, #e5e7eb)',
                      height: previewDevice === 'mobile' ? '812px' : '100%',
                    }}
                    sandbox="allow-same-origin allow-scripts"
                  />
                </div>

                {/* Source code panel (right, collapsible) */}
                {showSource && phase === 'chat' && (
                  <div className="flex h-full w-[420px] shrink-0 flex-col border-l border-border-default bg-surface-primary">
                    <div className="flex h-10 shrink-0 items-center justify-between border-b border-border-default px-3">
                      <span className="text-xs font-medium text-foreground-secondary">HTML 源码</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            // 手动编辑后保存
                            if (id && generatedHtml) {
                              htmlTemplatesApi
                                .autoSave(id, generatedHtml, agentHistory)
                                .then(() => {
                                  setSaved(true);
                                  const manualMsg: AgentChatMessage = {
                                    role: 'assistant',
                                    content: '📝 源码已手动编辑并保存',
                                    action: 'manual',
                                    ts: new Date().toISOString(),
                                  };
                                  setAgentHistory([...agentHistory, manualMsg]);
                                })
                                .catch(() => {});
                            }
                          }}
                          className="rounded bg-accent-primary px-2 py-1 text-[11px] text-foreground-inverse hover:bg-accent-secondary"
                        >
                          💾 保存
                        </button>
                        <button
                          onClick={() => setShowSource(false)}
                          className="rounded px-1.5 py-1 text-xs text-foreground-muted hover:bg-surface-hover"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={generatedHtml}
                      onChange={(e) => setGeneratedHtml(e.target.value)}
                      className="flex-1 resize-none bg-surface-secondary p-3 font-mono text-[11px] leading-relaxed text-foreground-primary focus:outline-none"
                      spellCheck={false}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              {generating ? (
                <div className="text-center">
                  <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-accent-primary/20 border-t-accent-primary" />
                  <p className="text-sm font-medium text-foreground-secondary">AI 正在生成报告…</p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    DeepSeek V4 Pro 推理模型，通常需要 2-3 分钟
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <div className="mb-3 text-6xl opacity-20">📄</div>
                  <p className="text-sm text-foreground-muted">
                    配置左侧参数，点击「✨ 生成报告」开始
                  </p>
                  {!campaignId && (
                    <p className="mt-2 text-xs text-amber-500">
                      ⚠️ 此报告未绑定 Campaign，AI 将生成通用模板
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
