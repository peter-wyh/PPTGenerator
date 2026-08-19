/**
 * HtmlStudio — Report Agent 混合模式工作台。
 * 独立全屏路由 /projects/:id/html-studio。
 *
 * 混合模式：首次生成用配置面板（保证质量），生成完成后自动保存并切换到 Chat 面板（自然语言迭代编辑）。
 *
 * 左侧：phase=config → 配置面板；phase=chat → AgentChatPanel
 * 右侧：预览区（iframe）+ 可选源码面板
 *
 * ★ SSE 流式：思考过程实时展示 + HTML 流式预览 + 取消按钮
 * ★ 三栏可拉伸布局：左对话 / 中画布 / 右配置面板
 */
import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  htmlTemplatesApi,
  type HtmlVersionDetail,
  type AgentChatMessage,
} from '@/api/htmlTemplates';
import { projectsApi } from '@/api/projects';
import { toast } from '@/components/Toast';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { Button } from '@/components/Button';
import { type ProjectDetail, type ProjectMeta, formatReportPeriod } from '@mediakit/shared';
import { AgentChatPanel } from './AgentChatPanel';
import { AiGenerateForm } from '@/editor/components/AiGenerateForm';
import { RecipeEditor } from '@/editor/components/recipe-editor/RecipeEditor';
// VisualEditor（GrapesJS ~1.1MB）懒加载：仅在用户切换到「可视化」视图时才下载
const VisualEditor = lazy(() =>
  import('@/components/VisualEditor').then((m) => ({ default: m.VisualEditor })),
);
import { ResizablePanels } from '@/components/ResizablePanels';

// 渐进式阶段提示
const GEN_STAGES = [
  '📊 正在分析 Campaign 数据…',
  '🧠 正在推理报告结构和设计方案…',
  '🎨 正在生成 HTML 布局和样式…',
  '📈 正在渲染图表和数据可视化…',
  '✨ 正在优化细节和收尾…',
];

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

  // 生成状态
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  // ★ 报告基础信息编辑对话框
  const [showEdit, setShowEdit] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // ★ SSE 流式状态
  const [isThinking, setIsThinking] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [genStage, setGenStage] = useState(0);
  const stageTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastGenParams = useRef<{ mode: 'ai' | 'recipe'; prompt: string; designMd: string } | null>(null);

  // ★ Chat 模式编辑繁忙状态（驱动中栏画布遮罩）+ 兜底取消（左栏收起时）
  const [chatBusy, setChatBusy] = useState(false);
  const cancelEditRef = useRef<(() => void) | null>(null);
  const handleBusyChange = useCallback((busy: boolean, cancel?: () => void) => {
    setChatBusy(busy);
    cancelEditRef.current = busy && cancel ? cancel : null;
  }, []);

  // 左侧面板折叠（沉浸模式）
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  // 源码面板（右侧可折叠）
  const [showSource, setShowSource] = useState(false);

  // ★ 可视化编辑模式：preview（只读 iframe，默认）vs visual（GrapesJS 编辑器）
  const [viewMode, setViewMode] = useState<'preview' | 'visual'>('preview');

  // ★ Recipe 模式:当前 HtmlVersion 完整记录
  const [activeVersion, setActiveVersion] = useState<HtmlVersionDetail | null>(null);

  // 加载项目信息
  useEffect(() => {
    if (!id) return;
    setLoadingProject(true);
    projectsApi
      .get(id)
      .then((p) => {
        setProject(p);
        projectsApi
          .getHtml(id)
          .then((data) => {
            if (data.html) {
              setGeneratedHtml(data.html);
              setSaved(true);
              setPhase('chat');
              // ★ 自愈：加载到内容但状态卡在 generating（上次会话崩溃/中断）→ 修正为 generated。
              // 否则项目列表徽标永远显示「生成中」。
              if ((p.meta as Record<string, unknown>)?.aiHtmlStatus === 'generating') {
                const healed: ProjectMeta = { ...p.meta, aiHtmlStatus: 'generated' };
                projectsApi
                  .update(id, { meta: healed })
                  .then(() => setProject((prev) => (prev ? { ...prev, meta: healed } : prev)))
                  .catch(() => {});
              }
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
              htmlTemplatesApi
                .listHtmlVersions(id!)
                .then((vs) => {
                  const activeId = vs.find((v) => v.isActive)?.id ?? vs[0]?.id;
                  if (!activeId) return;
                  return htmlTemplatesApi.getHtmlVersion(activeId);
                })
                .then((v) => {
                  if (v) setActiveVersion(v);
                })
                .catch(() => {});
            }
          })
          .catch(() => {});
      })
      .catch(() => setProjectError('报告加载失败或不存在'))
      .finally(() => setLoadingProject(false));
  }, [id]);

  const campaignId = project?.meta?.campaignId;
  const reportPeriod = project?.meta?.reportPeriod as
    | { startDate?: string; endDate?: string }
    | undefined;

  // ★ 报告基础信息透出标签（业务线/广告主/周期）；空值不进标签。
  const basicInfoTags: string[] = [];
  if (project?.meta?.businessLine?.trim()) basicInfoTags.push(project.meta.businessLine);
  if (project?.meta?.advertiser?.trim()) basicInfoTags.push(project.meta.advertiser);
  const periodText = project?.meta?.reportPeriod
    ? formatReportPeriod(project.meta.reportPeriod, project.meta.scenarioSub)
    : '';
  if (periodText) basicInfoTags.push(periodText);

  const updateAiHtmlStatus = useCallback(
    async (status: 'generated' | 'generating' | 'pending') => {
      if (!id || !project) return;
      const mergedMeta: ProjectMeta = { ...project.meta, aiHtmlStatus: status };
      try {
        await projectsApi.update(id, { meta: mergedMeta });
        setProject((prev) => (prev ? { ...prev, meta: mergedMeta } : prev));
      } catch {
        // 静默失败
      }
    },
    [id, project],
  );

  // ★ 编辑报告基础信息:复用 CreateProjectDialog → PATCH /projects/:id → 刷新 project
  // 仅持久化 + 刷新;不自动重算/重生成(recipe 模式下用户在 DataPanel 手动重新生成)。
  const handleEditBasicInfo = async (values: {
    name: string;
    width: number;
    height: number;
    meta: ProjectMeta;
    templateId?: string;
  }) => {
    if (!id) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      const updated = await projectsApi.update(id, values);
      setProject(updated);
      setShowEdit(false);
      toast.success('报告信息已更新');
    } catch (err: unknown) {
      const e = err as {
        response?: { data?: { message?: string; error?: { message?: string } } };
        message?: string;
      };
      const msg =
        e?.response?.data?.message ??
        e?.response?.data?.error?.message ??
        e?.message ??
        '保存失败，请重试';
      setEditError(typeof msg === 'string' ? msg : '保存失败，请重试');
    } finally {
      setEditSubmitting(false);
    }
  };

  const reloadVersion = useCallback(async () => {
    if (!id || !activeVersion) return;
    try {
      const v = await htmlTemplatesApi.getHtmlVersion(activeVersion.id);
      setActiveVersion(v);
      setGeneratedHtml(v.html);
      setSaved(true);
    } catch {
      // 静默
    }
  }, [id, activeVersion]);

  const isRecipe = !!activeVersion?.recipeId;

  // ★ 启动/停止渐进式阶段轮播
  const startStageTimer = useCallback(() => {
    setGenStage(0);
    if (stageTimerRef.current) clearInterval(stageTimerRef.current);
    stageTimerRef.current = setInterval(() => {
      setGenStage((prev) => (prev + 1) % GEN_STAGES.length);
    }, 8000); // 每8秒轮换
  }, []);

  const stopStageTimer = useCallback(() => {
    if (stageTimerRef.current) {
      clearInterval(stageTimerRef.current);
      stageTimerRef.current = null;
    }
  }, []);

  // ★ 取消生成
  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
    setIsThinking(false);
    stopStageTimer();
  }, [stopStageTimer]);

  // ★ handleGenerate — SSE 流式生成
  const handleGenerate = useCallback(
    async (vals: { mode: 'ai' | 'recipe'; prompt: string; designMd: string }) => {
      lastGenParams.current = vals;
      setGenerating(true);
      setError('');
      setGeneratedHtml('');
      setSaved(false);
      setIsThinking(false);
      setTruncated(false);
      void updateAiHtmlStatus('generating');

      // 启动阶段轮播
      startStageTimer();

      // AI 模式使用流式；recipe 模式直接建 recipe 版本（createRecipeVersion，数据驱动）
      if (vals.mode === 'recipe') {
        try {
          // ★ recipe 模式:直接建 recipe 版本(后端 mapCampaign+render),不走 AI/流式
          const { versionId } = await htmlTemplatesApi.createRecipeVersion(id!, { reportPeriod });
          const vs = await htmlTemplatesApi.listHtmlVersions(id!);
          const activeId = vs.find((v) => v.isActive)?.id ?? versionId;
          const v = await htmlTemplatesApi.getHtmlVersion(activeId);
          setActiveVersion(v);
          setGeneratedHtml(v.html);
          setSaved(true);
          void updateAiHtmlStatus('generated');
          setPhase('chat');
          setAgentHistory([
            {
              role: 'assistant',
              content: '✨ recipe 报告已生成(数据驱动)。改时间段/样式可秒级重算。',
              action: 'generate',
              ts: new Date().toISOString(),
            },
          ]);
        } catch (e: unknown) {
          const err = e as {
            response?: { data?: { error?: { message?: string }; message?: string } };
            message?: string;
          };
          setError(
            err.response?.data?.error?.message ||
              err.response?.data?.message ||
              err.message ||
              '生成失败,请重试',
          );
          void updateAiHtmlStatus('pending');
        } finally {
          setGenerating(false);
          stopStageTimer();
        }
        return;
      }

      // AI 模式 — SSE 流式
      // ★ ③-1/③-3 生成过程纳入对话流程：点击生成立即切 Chat 模式，
      //   用户提示词作为 user 消息入列，思考流在对话气泡中实时展示，
      //   完成后 assistant 消息落历史（与后续迭代编辑同一条时间线）。
      const abortCtrl = new AbortController();
      abortRef.current = abortCtrl;
      let streamingHtml = '';
      let streamingReasoning = ''; // 首次生成的思考过程，完成后存入会话 assistant 消息

      const userMsg: AgentChatMessage = {
        role: 'user',
        content: vals.prompt?.trim() || '🤖 自动生成报告（自主模式，无附加指令）',
        ts: new Date().toISOString(),
      };
      setPhase('chat');
      setAgentHistory([userMsg]);

      try {
        await htmlTemplatesApi.generateStream(
          {
            prompt: vals.prompt,
            campaignId,
            designMd: vals.designMd.trim() || undefined,
            reportPeriod,
          },
          (chunk) => {
            if (chunk.type === 'reasoning') {
              setIsThinking(true);
              streamingReasoning += chunk.text;
            } else if (chunk.type === 'content') {
              setIsThinking(false);
              streamingHtml += chunk.text;
              // 取消渐进式渲染：content 阶段不更新画布，等 done 一次性展示
            } else if (chunk.type === 'done') {
              setGeneratedHtml(chunk.html);
              setTruncated(chunk.truncated);
              streamingHtml = chunk.html;
              if (chunk.dataCoverage && !chunk.dataCoverage.complete) {
                toast.error(
                  chunk.dataCoverage.covered
                    ? `实际数据区间 ${chunk.dataCoverage.covered.start} ~ ${chunk.dataCoverage.covered.end},缺 ${chunk.dataCoverage.missingDays} 天`
                    : '所选周期无数据,报告含 Data Unavailable 区块',
                );
              }
            } else if (chunk.type === 'error') {
              setError(chunk.message);
            }
          },
          abortCtrl.signal,
        );

        // 成功
        if (streamingHtml && streamingHtml.startsWith('<')) {
          void updateAiHtmlStatus('generated');
          const genMsg: AgentChatMessage = {
            role: 'assistant',
            content: truncated
              ? '⚠️ 报告已生成（部分内容被截断）。建议简化需求或重试。你也可以用自然语言继续编辑。'
              : '✨ 报告已生成并自动保存！你可以用自然语言修改，比如：「把标题改成 XXX」「KPI 卡片用品牌色渐变」',
            action: 'generate',
            reasoning: streamingReasoning || undefined,
            ts: new Date().toISOString(),
          };
          setAgentHistory([userMsg, genMsg]);

          // 自动保存
          if (id) {
            try {
              await htmlTemplatesApi.autoSave(id, streamingHtml, [userMsg, genMsg], {
                prompt: vals.prompt,
                designMd: vals.designMd,
              });
              setSaved(true);
            } catch {}
          }
        } else if (error) {
          // SSE error chunk 路径：流正常结束但未产出 HTML。
          // 不走下方 catch（generateStream 不抛错），须在此回退状态，
          // 否则 aiHtmlStatus 永久卡在 generating，列表徽标一直显示「生成中」。
          void updateAiHtmlStatus('pending');
          setAgentHistory([userMsg, {
            role: 'assistant',
            content: `❌ 生成失败：${error}`,
            ts: new Date().toISOString(),
          }]);
        }
      } catch (e: unknown) {
        const err = e as { message?: string; name?: string };
        if (err.name !== 'AbortError') {
          setError(err.message || '生成失败，请重试');
          // ★ 失败/取消回退 config 面板（保留表单值），供用户调整后重试
          setPhase('config');
        } else {
          // 用户主动取消：回退配置面板，清掉对话中的进行时消息
          setPhase('config');
          setAgentHistory([]);
        }
        void updateAiHtmlStatus('pending');
      } finally {
        setGenerating(false);
        setIsThinking(false);
        stopStageTimer();
        abortRef.current = null;
      }
    },
    [campaignId, reportPeriod, updateAiHtmlStatus, id, startStageTimer, stopStageTimer, truncated],
  );

  // ★ 重试上一次生成
  const handleRetry = useCallback(() => {
    if (lastGenParams.current) {
      void handleGenerate(lastGenParams.current);
    }
  }, [handleGenerate]);

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

  // 清理
  useEffect(() => {
    return () => {
      stopStageTimer();
      abortRef.current?.abort();
    };
  }, [stopStageTimer]);

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
          <Button variant="secondary" className="mt-4" onClick={() => navigate('/projects/ppt')}>
            返回报告列表
          </Button>
        </div>
      </div>
    );
  }

  // ── 左栏内容 ──
  const leftPanel = (
    <aside className="flex h-full flex-col overflow-hidden bg-surface-primary">
      {phase === 'config' ? (
        <div className="flex flex-1 flex-col overflow-y-auto p-5">
          {/* ★ 错误 + 重试 */}
          {error && (
            <div className="mb-3 rounded-lg bg-red/10 px-3 py-2 text-xs text-red">
              <p>{error}</p>
              <button
                onClick={handleRetry}
                className="mt-1.5 rounded bg-red/20 px-2 py-1 text-[11px] font-medium text-red hover:bg-red/30"
              >
                🔄 重试
              </button>
            </div>
          )}
          {/* ★ 截断警告 */}
          {truncated && !generating && (
            <div className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
              ⚠️ AI 输出被截断（token 上限），报告可能不完整。建议简化需求后重试。
            </div>
          )}
          <AiGenerateForm
            campaignId={campaignId}
            onGenerate={handleGenerate}
            generating={generating}
            error=""
          />
          {/* ★ 取消按钮 */}
          {generating && (
            <Button
              variant="ghost"
              onClick={handleCancel}
              className="mt-3 w-full border border-red/30 text-red hover:bg-red/5"
            >
              ⏹ 取消生成
            </Button>
          )}
        </div>
      ) : (
        <AgentChatPanel
          projectId={id || ''}
          currentHtml={generatedHtml}
          agentHistory={agentHistory}
          onHtmlChange={(html) => setGeneratedHtml(html)}
          onHistoryChange={setAgentHistory}
          onBusyChange={handleBusyChange}
          campaignId={campaignId}
          reportPeriod={reportPeriod}
          /* ★ ③-1 首次生成流纳入对话：进行时气泡（中文阶段提示+取消；不展示思考原文） */
          generating={generating}
          genStageText={GEN_STAGES[genStage]}
          onCancelGenerate={handleCancel}
        />
      )}
    </aside>
  );

  // ── 中栏内容（画布/预览） ──
  const centerPanel = (
    <main className="flex h-full flex-col overflow-hidden bg-surface-subtle">
      {generatedHtml ? (
        <>
          {/* Toolbar */}
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-border-default bg-surface-primary px-4">
            <div className="flex items-center gap-2">
              {phase === 'chat' && (
                <div className="flex rounded-md border border-border-default">
                  <button
                    onClick={() => { setViewMode('visual'); setShowSource(false); }}
                    className={`rounded-l-md px-2.5 py-1 text-xs transition ${
                      viewMode === 'visual' && !showSource
                        ? 'bg-accent-primary text-foreground-inverse'
                        : 'text-foreground-secondary hover:bg-surface-hover'
                    }`}
                  >
                    ✏️ 编辑
                  </button>
                  <button
                    onClick={() => { setViewMode('preview'); setShowSource(false); }}
                    className={`border-l border-border-default px-2.5 py-1 text-xs transition ${
                      viewMode === 'preview' && !showSource
                        ? 'bg-accent-primary text-foreground-inverse'
                        : 'text-foreground-secondary hover:bg-surface-hover'
                    }`}
                  >
                    👁️ 预览
                  </button>
                  <button
                    onClick={() => setShowSource(!showSource)}
                    className={`rounded-r-md border-l border-border-default px-2.5 py-1 text-xs transition ${
                      showSource
                        ? 'bg-accent-primary text-foreground-inverse'
                        : 'text-foreground-secondary hover:bg-surface-hover'
                    }`}
                  >
                    {'</>'} 源码
                  </button>
                </div>
              )}
              {phase === 'config' && (
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
                    className={`rounded-r-md border-l border-border-default px-2.5 py-1 text-xs transition ${
                      previewDevice === 'mobile'
                        ? 'bg-accent-primary text-foreground-inverse'
                        : 'text-foreground-secondary hover:bg-surface-hover'
                    }`}
                  >
                    📱 移动
                  </button>
                </div>
              )}
              {/* ★ 流式生成时显示阶段提示 */}
              {generating && (
                <span className="text-[11px] text-accent-primary">
                  {GEN_STAGES[genStage]}
                </span>
              )}
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

          {/* 源码面板 */}
          {showSource && phase === 'chat' ? (
            <div className="flex flex-1 overflow-hidden">
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="flex h-8 shrink-0 items-center justify-between border-b border-border-default px-3 bg-surface-primary">
                  <span className="text-xs font-medium text-foreground-secondary">HTML 源码（手动编辑 → 保存生效）</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
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
            </div>
          ) : phase === 'chat' && viewMode === 'visual' ? (
            <Suspense fallback={<div className="flex h-full items-center justify-center text-foreground-secondary">可视化编辑器加载中…</div>}>
            <VisualEditor
              key="visual-editor"
              html={generatedHtml}
              onHtmlChange={(newHtml) => {
                setGeneratedHtml(newHtml);
                if (id) {
                  htmlTemplatesApi
                    .autoSave(id, newHtml, agentHistory)
                    .then(() => setSaved(true))
                    .catch(() => {});
                }
              }}
            />
            </Suspense>
          ) : (
          /* 普通预览（iframe）— 生成完成后一次性展示 */
          <div className="relative flex flex-1 overflow-hidden">
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
            {/* ★ Chat 模式 AI 编辑遮罩：保留旧报告半透明底层，完成后一次性替换 */}
            {phase === 'chat' && chatBusy && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-subtle/80 backdrop-blur-sm">
                <div className="text-center">
                  <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-accent-primary/20 border-t-accent-primary" />
                  <p className="text-sm font-medium text-foreground-secondary">正在编辑…</p>
                  {panelCollapsed && (
                    <button
                      onClick={() => cancelEditRef.current?.()}
                      className="mt-3 rounded-md border border-red/30 px-3 py-1.5 text-xs text-red hover:bg-red/5"
                    >
                      ⏹ 取消
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          )}
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          {generating ? (
            <div className="w-full max-w-2xl px-6 text-center">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-accent-primary/20 border-t-accent-primary" />
              <p className="text-sm font-medium text-foreground-secondary">{GEN_STAGES[genStage]}</p>
              <p className="mt-1 text-xs text-foreground-muted">
                {isThinking ? 'AI 正在思考…' : '正在生成报告…'}
              </p>
              <button
                onClick={handleCancel}
                className="mt-4 rounded-md border border-red/30 px-3 py-1.5 text-xs text-red hover:bg-red/5"
              >
                ⏹ 取消生成
              </button>
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
              {error && (
                <div className="mt-3">
                  <p className="text-xs text-red">{error}</p>
                  <button
                    onClick={handleRetry}
                    className="mt-1.5 rounded bg-red/20 px-2 py-1 text-[11px] font-medium text-red hover:bg-red/30"
                  >
                    🔄 重试
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface-subtle">
      {/* ────── Top Bar ────── */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border-default bg-surface-primary px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/projects/ai-html')}
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
          {generating && (
            <span className="flex items-center gap-1 text-[10px] text-accent-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-primary" />
              {isThinking ? '思考中' : '生成中'}
            </span>
          )}
          {/* ★ 报告基础信息透出标签 + 编辑入口 */}
          <div className="flex items-center gap-1">
            {basicInfoTags.map((t, i) => (
              <span
                key={i}
                className="hidden rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-secondary md:inline"
              >
                {t}
              </span>
            ))}
            <button
              onClick={() => setShowEdit(true)}
              disabled={generating}
              className="rounded px-1.5 py-0.5 text-[10px] text-foreground-secondary hover:bg-surface-hover disabled:opacity-40"
              title="编辑报告基础信息"
            >
              ✏️ 编辑
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && !generating && (
            <span className="flex items-center gap-1 text-xs text-green">
              <span className="h-1.5 w-1.5 rounded-full bg-green" /> 已保存
            </span>
          )}
          {phase === 'chat' && (
            <button
              onClick={() => {
                if (confirm('返回配置面板将重新生成报告，当前内容会被覆盖。确定？')) {
                  setPhase('config');
                  setGeneratedHtml('');
                  setSaved(false);
                  setShowSource(false);
                  setTruncated(false);
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
      {/* Recipe 模式:四层编辑器 */}
      {isRecipe && activeVersion ? (
        <RecipeEditor
          key={`${activeVersion.id}-${activeVersion.updatedAt ?? ''}`}
          versionId={activeVersion.id}
          recipeId={activeVersion.recipeId!}
          campaignId={campaignId}
          reportPeriod={reportPeriod}
          reportContent={activeVersion.reportContent ?? {}}
          tokenOverrides={(activeVersion.tokenOverrides as Record<string, unknown>) ?? {}}
          manifestOverrides={
            (activeVersion.manifestOverrides as { order?: string[]; hidden?: string[] }) ?? {}
          }
          onSaved={reloadVersion}
        />
      ) : (
        /* 三栏可拉伸布局 */
        <ResizablePanels
          left={leftPanel}
          center={centerPanel}
          leftCollapsed={panelCollapsed}
          leftWidth={380}
          minLeft={280}
          maxLeft={600}
        />
      )}

      {/* ★ 报告基础信息编辑对话框(复用 CreateProjectDialog) */}
      <CreateProjectDialog
        open={showEdit}
        loading={editSubmitting}
        error={editError}
        title="编辑报告"
        submitLabel="保存"
        lockScenario
        initial={
          project
            ? {
                name: project.name,
                width: project.width,
                height: project.height,
                meta: project.meta,
              }
            : null
        }
        onCancel={() => !editSubmitting && setShowEdit(false)}
        onSubmit={handleEditBasicInfo}
      />
    </div>
  );
}
