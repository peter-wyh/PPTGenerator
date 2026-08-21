/**
 * AgentChatPanel — Report Agent 对话面板。
 * 用户输入编辑指令 → 调用 AI 增量编辑 → 返回修改后 HTML → 自动保存。
 * 支持图片上传（vision 多模态）和 HTML 文件导入。
 *
 * ★ SSE 流式：思考过程实时展示 + HTML 流式预览 + 取消按钮
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/Button';
import { toast } from '@/components/Toast';
import { htmlTemplatesApi, type SSEChunk } from '@/api/htmlTemplates';
import type { AgentChatMessage } from '@/api/htmlTemplates';

/** 可折叠的 AI 思考过程（复用于流式临时气泡 + 聊天历史永久展示）★ 支持全屏 */
function CollapsibleReasoning({ text, defaultCollapsed = true }: { text: string; defaultCollapsed?: boolean }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [fullscreen, setFullscreen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [collapsed, text]);

  // ★ ③-2 全屏模式：Esc 退出
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fullscreen]);

  const body = (
    <div
      ref={scrollRef}
      className={`whitespace-pre-wrap text-[11px] leading-relaxed text-foreground-muted ${
        fullscreen ? 'flex-1 overflow-y-auto p-6 font-mono' : 'max-h-40 overflow-y-auto'
      }`}
    >
      {text}
    </div>
  );

  return (
    <div className="mt-1.5">
      <div className="mb-1 flex items-center gap-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-[10px] text-foreground-muted hover:text-foreground-secondary"
        >
          {collapsed ? '▸ AI 思考过程' : '▾ 收起思考过程'}
        </button>
        {!collapsed && (
          <button
            onClick={() => setFullscreen(true)}
            className="text-[10px] text-foreground-muted hover:text-foreground-secondary"
            title="全屏查看思考过程 (Esc 退出)"
          >
            ⛶ 全屏
          </button>
        )}
      </div>
      {!collapsed && !fullscreen && body}
      {/* ★ ③-2 全屏思考浮层：覆盖整个视口 */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-surface-primary/95 backdrop-blur-sm">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-border-default px-4">
            <span className="text-sm font-medium text-foreground-primary">🧠 AI 思考过程</span>
            <button
              onClick={() => setFullscreen(false)}
              className="rounded-md border border-border-default px-3 py-1.5 text-xs text-foreground-secondary hover:bg-surface-hover"
            >
              ✕ 退出全屏 (Esc)
            </button>
          </div>
          {body}
        </div>
      )}
    </div>
  );
}

interface AgentChatPanelProps {
  projectId: string;
  currentHtml: string;
  agentHistory: AgentChatMessage[];
  onHtmlChange: (html: string) => void;
  onHistoryChange: (history: AgentChatMessage[]) => void;
  /**
   * 编辑繁忙状态变化，并附带「如何取消」的能力。
   * busy=true 时 cancel 为当前编辑的取消函数；busy=false 时 cancel 为 undefined。
   * 供父组件（HtmlStudio）驱动中栏画布遮罩 + 兜底取消（左栏收起时）。
   */
  onBusyChange?: (busy: boolean, cancel?: () => void) => void;
  /** ★ ④ 数据上下文：绑定的 Campaign + 报告周期。随编辑请求发送，服务端注入真实 DB 数据防伪造。 */
  campaignId?: string;
  reportPeriod?: { startDate?: string; endDate?: string };
  /**
   * ★ ③-1 首次生成流（HtmlStudio handleGenerate 驱动）：
   * active=true 时面板底部渲染「生成中」进行时气泡（阶段轮播 + 思考流 + 取消），
   * 与迭代编辑的 loading 气泡同一视觉模式，生成过程完整纳入对话时间线。
   */
  generating?: boolean;
  genStageText?: string;
  onCancelGenerate?: () => void;
  /** ★ 首次生成的实时思考流（HtmlStudio streamingReasoning → state），平铺展示在生成气泡内 */
  generateReasoning?: string;
}

const QUICK_ACTIONS = [
  { label: '改标题', prompt: '把报告标题改为：' },
  { label: '换配色', prompt: '把报告的主色调改为：' },
  { label: '加列', prompt: '在表格中添加一列：' },
  { label: '改图表', prompt: '把图表类型改为：' },
];

// 图片大小限制（base64 data URL，~4MB）
const MAX_IMAGE_SIZE = 4 * 1024 * 1024;

export function AgentChatPanel({
  projectId,
  currentHtml,
  agentHistory,
  onHtmlChange,
  onHistoryChange,
  onBusyChange,
  campaignId,
  reportPeriod,
  generating = false,
  genStageText = '',
  onCancelGenerate,
  generateReasoning,
}: AgentChatPanelProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const htmlInputRef = useRef<HTMLInputElement>(null);

  // ★ SSE 流式状态
  const [reasoning, setReasoning] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 已选择的图片（base64 data URL 数组），随消息一起发送
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  // ★ HTML 代码区块展开态:null=全部折叠,数字=展开第 idx 条消息的源码
  const [expandedCodeIdx, setExpandedCodeIdx] = useState<number | null>(null);
  // ★ QA 模式标记:当前 loading 来自数据问答(加载文案区分)
  const [qaMode, setQaMode] = useState(false);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agentHistory, loading, pendingImages, reasoning]);

  // ── 图片上传处理 ──
  // ★ 修复:旧逻辑「超限文件被拒后,完成判定 newImages.length === Math.min(files.length,5)
  //   永远凑不齐」→ 其余合法图片静默丢失。改为成功/失败分别计数,全部 settle 后一次性入列 + toast 反馈。
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newImages: string[] = [];
    let done = 0;
    let failed = 0;
    const rejected: string[] = [];
    const total = files.length;

    const settle = () => {
      if (done + failed < total) return;
      if (newImages.length > 0) {
        const space = Math.max(0, 5 - pendingImages.length);
        const kept = Math.min(newImages.length, space);
        setPendingImages((prev) => [...prev, ...newImages].slice(0, 5));
        if (kept < newImages.length) {
          toast.success(`已添加 ${kept} 张图片（待发送上限 5 张，${newImages.length - kept} 张未添加）`);
        } else {
          toast.success(`已添加 ${kept}/${total} 张图片，发送时随消息附带`);
        }
      }
      if (rejected.length > 0) {
        toast.error(`超 4MB 未添加: ${[...new Set(rejected)].join('、')}`);
      }
      if (failed > rejected.length) {
        toast.error('部分文件读取失败，请重试');
      }
    };

    Array.from(files).forEach((file) => {
      if (file.size > MAX_IMAGE_SIZE) {
        rejected.push(file.name);
        failed++;
        settle();
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        newImages.push(reader.result as string);
        done++;
        settle();
      };
      reader.onerror = () => {
        failed++;
        settle();
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }, [pendingImages]);

  const removePendingImage = useCallback((idx: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ── HTML 文件导入处理 ──
  const handleHtmlImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const html = reader.result as string;
      onHtmlChange(html);
      const userMsg: AgentChatMessage = {
        role: 'user',
        content: `📄 已导入 HTML 文件: ${file.name}`,
        ts: new Date().toISOString(),
      };
      const aiMsg: AgentChatMessage = {
        role: 'assistant',
        content: 'HTML 已加载到编辑器 ✅ 可以继续对话修改',
        ts: new Date().toISOString(),
        // ★ 对话即版本历史:导入的 HTML 也是版本点
        htmlSnapshot: html,
      };
      const newHistory = [...agentHistory, userMsg, aiMsg];
      onHistoryChange(newHistory);
      void htmlTemplatesApi.autoSave(projectId, html, newHistory);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [agentHistory, onHtmlChange, onHistoryChange, projectId]);

  // ★ 取消编辑
  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setIsThinking(false);
    setReasoning('');
  }, []);

  // ★ 对话即版本历史:恢复到历史快照。
  //  右侧预览立即切换(onHtmlChange) + autoSave 落库 + 历史追加「已恢复」消息(带同一快照,仍是版本点)。
  // ★ 消息即产物,画板即即时预览:点击带快照的消息 → 画板立即预览该版本。
  //  不写库、不追加「已恢复」消息、不改变历史——预览是纯前端行为,
  //  下一次对话编辑仍从画板当前内容(currentHtml)继续。
  const handlePreviewSnapshot = useCallback(
    (snapshot: string) => {
      onHtmlChange(snapshot);
    },
    [onHtmlChange],
  );

  // ★ handleSend — SSE 流式编辑
  // ★ 意图路由:问题类消息走数据问答(不产出 HTML),编辑类走 SSE 编辑。
  //  判定保守——明确的问题形态才走 QA,拿不准一律走编辑(编辑是既有主链路,误伤成本低)。
  const isQuestionOnly = useCallback((text: string): boolean => {
    // 带图片 = 参考素材,必然是编辑
    if (pendingImages.length > 0) return false;
    const t = text.trim();
    if (!t) return false;
    // 疑问词/问号开头或整句只有一个问号结尾
    const questionStart = /^(这|那|哪个|哪些|什么|为什|怎么|如何|多少|几|是不是|有没有|能不能|可不可以|可否|是否|帮我看|帮我查|查一下|看一下|tell|what|which|why|how|how many|how much|is |are |does |do )/i.test(t);
    const endsWithQuestion = /[?？]$/.test(t);
    // 排除:明确的编辑动词开头(即使带问号也是命令式,如"把标题改成XX?")
    const editVerb = /^(把|将|请|帮我把|帮我改|改|加|删|换|调|生成|重新|更新|插入|去掉|移除|修改|统一|全部)/.test(t);
    return !editVerb && (questionStart || endsWithQuestion);
  }, [pendingImages.length]);

  // ★ 数据问答:走 agent-qa 端点,纯文本回答进对话,不动 HTML 不写库
  const handleQuestion = useCallback(
    async (text: string, historyAfterUser: AgentChatMessage[]) => {
      // 取最近几轮纯文本对话作上下文(截断防超长)
      const recent = historyAfterUser
        .filter((m) => !m.images?.length)
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
      const { answer, hasDataContext } = await htmlTemplatesApi.agentQa({
        question: text,
        campaignId,
        history: recent,
      });
      const qaMsg: AgentChatMessage = {
        role: 'assistant',
        content: answer,
        action: 'qa',
        ts: new Date().toISOString(),
        // 问答无快照;hasDataContext=false 时提示未绑定 campaign
        ...(hasDataContext ? {} : {}),
      };
      onHistoryChange([...historyAfterUser, qaMsg]);
      void htmlTemplatesApi.autoSave(projectId, currentHtml ?? undefined, [
        ...historyAfterUser,
        qaMsg,
      ] as AgentChatMessage[]);
    },
    [campaignId, currentHtml, onHistoryChange, projectId],
  );

  const handleSend = useCallback(
    async (instruction?: string) => {
      const text = (instruction ?? input).trim();
      if ((!text && pendingImages.length === 0) || loading || !currentHtml) return;

      // ★ 意图分流:问题类 → QA 端点(不进 SSE 编辑流)
      if (isQuestionOnly(text)) {
        const userMsg: AgentChatMessage = {
          role: 'user',
          content: text,
          ts: new Date().toISOString(),
        };
        const newHistory = [...agentHistory, userMsg];
        onHistoryChange(newHistory);
        setInput('');
        setLoading(true);
        setQaMode(true);
        setError('');
        try {
          await handleQuestion(text, newHistory);
        } catch (e: any) {
          setError(e?.response?.data?.error?.message || e?.message || '问答失败,请重试');
        } finally {
          setLoading(false);
          setQaMode(false);
        }
        return;
      }

      const hasImages = pendingImages.length > 0;
      const displayContent = hasImages
        ? `${text || '请参考上传的图片修改报告'}\n📎 ${pendingImages.length}张图片`
        : text;

      const userMsg: AgentChatMessage = {
        role: 'user',
        content: displayContent,
        images: hasImages ? pendingImages : undefined,
        ts: new Date().toISOString(),
      };
      const newHistory = [...agentHistory, userMsg];
      onHistoryChange(newHistory);
      setInput('');
      const sentImages = pendingImages;
      setPendingImages([]);
      setLoading(true);
      setError('');
      setReasoning('');
      setIsThinking(false);

      const abortCtrl = new AbortController();
      abortRef.current = abortCtrl;
      let finalHtml = '';
      // ★ 思考过程累积在局部变量（setReasoning 的 state 在闭包中读不到最新值，
      // 旧代码 `reasoning || undefined` 永远取到初始 ''，导致消息里从未带过思考）
      let reasoningAcc = '';

      try {
        onBusyChange?.(true, handleCancel);
        await htmlTemplatesApi.agentEditStream(
          {
            currentHtml,
            instruction: text || '请参考上传的图片修改报告',
            images: hasImages ? sentImages : undefined,
            // ★ ④ 数据上下文：服务端注入真实 DB 数据，AI 数据改动以此为唯一真源
            campaignId,
            reportPeriod,
          },
          (chunk: SSEChunk) => {
            if (chunk.type === 'reasoning') {
              setIsThinking(true);
              reasoningAcc += chunk.text;
              setReasoning((prev) => prev + chunk.text);
            } else if (chunk.type === 'content') {
              setIsThinking(false);
              finalHtml += chunk.text;
              // 取消渐进式渲染：content 阶段不更新画布，等 done 一次性展示
            } else if (chunk.type === 'done') {
              finalHtml = chunk.html;
              onHtmlChange(finalHtml);
            } else if (chunk.type === 'error') {
              setError(chunk.message);
            }
          },
          abortCtrl.signal,
        );

        if (finalHtml && finalHtml.startsWith('<')) {
          const aiMsg: AgentChatMessage = {
            role: 'assistant',
            content: '已更新 ✅',
            action: 'edit',
            reasoning: reasoningAcc || undefined,
            ts: new Date().toISOString(),
            // ★ 对话即版本历史:本次编辑后的成品挂快照,历史消息可「恢复到此版本」
            htmlSnapshot: finalHtml,
          };
          const finalHistory = [...newHistory, aiMsg];
          onHistoryChange(finalHistory);
          await htmlTemplatesApi.autoSave(projectId, finalHtml, finalHistory);
        }
      } catch (e: unknown) {
        const err = e as {
          response?: { data?: { error?: { message?: string }; message?: string } };
          name?: string;
          message?: string;
        };
        if (err.name === 'AbortError') {
          // ★ 用户主动取消：回填输入框（下次可直接改完再发），历史里补一条「已取消」标记
          setInput(hasImages ? (text ? `${text}\n📎 ${sentImages.length}张图片` : '') : text);
          setPendingImages(hasImages ? sentImages : []);
          onHistoryChange([
            ...newHistory,
            { role: 'assistant', content: '已取消本次编辑 ⏹️', action: 'cancelled', ts: new Date().toISOString() },
          ]);
        } else {
          setError(
            err.response?.data?.error?.message ||
              err.response?.data?.message ||
              err.message ||
              '编辑失败，请重试',
          );
        }
      } finally {
        setLoading(false);
        setIsThinking(false);
        setReasoning('');
        abortRef.current = null;
        onBusyChange?.(false);
      }
    },
    [input, loading, currentHtml, agentHistory, onHtmlChange, onHistoryChange, projectId, pendingImages, onBusyChange, handleCancel],
  );

  // ★ 重试上一次编辑
  const handleRetry = useCallback(() => {
    const lastUserMsg = [...agentHistory].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      // 提取纯文本指令（去掉图片描述后缀）
      const instruction = lastUserMsg.content.split('\n📎')[0];
      void handleSend(instruction);
    }
  }, [agentHistory, handleSend]);

  return (
    <div className="flex h-full flex-col">
      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {agentHistory.length === 0 && (
          <div className="rounded-lg bg-surface-hover px-3 py-4 text-center text-xs text-foreground-muted">
            💬 报告已生成！用自然语言告诉我你想怎么修改：
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {QUICK_ACTIONS.map((q) => (
                <button
                  key={q.label}
                  onClick={() => void handleSend(q.prompt)}
                  disabled={loading}
                  className="rounded-md bg-accent-primary/10 px-2 py-1 text-[11px] text-accent-primary hover:bg-accent-primary/20 disabled:opacity-50"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {agentHistory.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                msg.role === 'user'
                  ? 'bg-accent-primary text-foreground-inverse'
                  : 'bg-surface-hover text-foreground-primary'
              }`}
            >
              {msg.images && msg.images.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-1">
                  {msg.images.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt={`upload-${i}`}
                      className="max-h-16 rounded border border-white/20 object-cover"
                    />
                  ))}
                </div>
              )}
              {msg.content}
              {msg.reasoning && (
                /* ★ 思考过程平铺：默认展开（defaultCollapsed=false），可手动收起 */
                <CollapsibleReasoning
                  text={msg.reasoning}
                  defaultCollapsed={false}
                />
              )}
              {/* ★ 消息即产物:HTML 代码区块——头部(文件名+大小+预览按钮)+可折叠源码
                  预览=画板即时切换到该版本(纯预览,不写库不改历史);源码默认折叠,点开可查真 */}
              {msg.htmlSnapshot && (
                <div className="mt-1.5 overflow-hidden rounded-md border border-border-default bg-surface-default">
                  <div className="flex items-center justify-between gap-2 border-b border-border-subtle bg-surface-hover px-2 py-1">
                    <span className="inline-flex items-center gap-1 truncate font-mono text-[10px] text-foreground-muted">
                      <span>📄</span>
                      report.html
                    </span>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <span className="text-[10px] text-foreground-muted">
                        {msg.htmlSnapshot.length >= 1024
                          ? `${Math.round(msg.htmlSnapshot.length / 1024)} KB`
                          : `${msg.htmlSnapshot.length} B`}
                      </span>
                      <button
                        onClick={() => handlePreviewSnapshot(msg.htmlSnapshot!)}
                        className="rounded bg-accent-primary px-2 py-0.5 text-[10px] font-medium text-foreground-inverse hover:bg-accent-secondary"
                      >
                        ▣ 预览
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedCodeIdx(expandedCodeIdx === idx ? null : idx)}
                    className="flex w-full items-center justify-center gap-1 px-2 py-1 text-[10px] text-foreground-muted hover:bg-surface-hover hover:text-foreground-secondary"
                  >
                    {expandedCodeIdx === idx ? '▲ 收起源码' : '▼ 查看源码'}
                  </button>
                  {expandedCodeIdx === idx && (
                    <pre className="max-h-64 overflow-auto border-t border-border-subtle bg-surface-hover px-2 py-1.5 font-mono text-[10px] leading-relaxed text-foreground-secondary">
                      {msg.htmlSnapshot}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg bg-surface-hover px-3 py-2 text-xs text-foreground-muted">
              {/* 头部：状态文案 + 取消 */}
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1 font-medium text-foreground-secondary">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-primary" />
                  {isThinking || reasoning ? 'AI 思考中…' : qaMode ? '查询数据中…' : 'AI 正在编辑…'}
                </span>
                <button
                  onClick={handleCancel}
                  className="text-[10px] text-red hover:underline"
                >
                  取消
                </button>
              </div>
              {/* ★ 思考过程平铺：实时流式展示原文（折叠入口改为收起） */}
              {isThinking || reasoning ? (
                <CollapsibleReasoning
                  text={reasoning}
                  defaultCollapsed={false}
                />
              ) : null}
            </div>
          </div>
        )}
        {/* ★ ③-1 首次生成进行时气泡：阶段提示 + 思考流平铺 + 取消 */}
        {generating && !loading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg bg-surface-hover px-3 py-2 text-xs text-foreground-muted">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1 font-medium text-foreground-secondary">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-primary" />
                  {genStageText || '正在生成报告…'}
                </span>
                <button
                  onClick={onCancelGenerate}
                  className="text-[10px] text-red hover:underline"
                >
                  取消
                </button>
              </div>
              {/* ★ 思考过程平铺：生成思考流实时展示（HtmlStudio 通过 generateReasoning 传入） */}
              {generateReasoning ? (
                <CollapsibleReasoning
                  text={generateReasoning}
                  defaultCollapsed={false}
                />
              ) : null}
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red/10 px-3 py-2 text-xs text-red">
            <p>{error}</p>
            <button
              onClick={handleRetry}
              className="mt-1 rounded bg-red/20 px-2 py-0.5 text-[10px] font-medium hover:bg-red/30"
            >
              🔄 重试
            </button>
          </div>
        )}
      </div>

      {/* 待发送图片预览条 ★ 带张数徽标(n/5)——上传成功与否一眼可见 */}
      {pendingImages.length > 0 && (
        <div className="flex items-center gap-1.5 border-t border-border-default px-3 pt-2">
          <span className="shrink-0 rounded bg-accent-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-primary">
            📎 {pendingImages.length}/5
          </span>
          {pendingImages.map((img, idx) => (
            <div key={idx} className="relative">
              <img
                src={img}
                alt={`pending-${idx}`}
                className="h-12 w-12 rounded border border-border-default object-cover"
              />
              <button
                onClick={() => removePendingImage(idx)}
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red text-[8px] text-white"
                title="移除"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 输入框 */}
      <div className="shrink-0 border-t border-border-default p-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => imgInputRef.current?.click()}
            disabled={loading}
            className="shrink-0 rounded-md border border-border-default p-2 text-foreground-secondary transition hover:bg-surface-hover disabled:opacity-50"
            title="上传图片（AI 可参考图片编辑）"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M14 4v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2zM5 7l1.5-1.5L9 8l3-3 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6l1 1h1zM5.5 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
            </svg>
          </button>
          <input
            ref={imgInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageUpload}
          />

          <button
            onClick={() => htmlInputRef.current?.click()}
            disabled={loading}
            className="shrink-0 rounded-md border border-border-default p-2 text-foreground-secondary transition hover:bg-surface-hover disabled:opacity-50"
            title="导入 HTML 文件"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 3h12v3h-1V4H3v8h4v1H2V3zm8 6l3 3-3 3v-2H6v-2h4V9z"/>
            </svg>
          </button>
          <input
            ref={htmlInputRef}
            type="file"
            accept=".html,.htm,text/html"
            className="hidden"
            onChange={handleHtmlImport}
          />

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={pendingImages.length > 0 ? '描述你想让 AI 怎么参考图片修改…' : '输入编辑指令… (如：把 KPI 卡片改成渐变色)'}
            disabled={loading}
            className="flex-1 rounded-lg border border-border-default bg-surface-secondary px-3 py-2 text-xs text-foreground-primary placeholder:text-foreground-muted focus:border-accent-primary focus:outline-none disabled:opacity-50"
          />
          <Button
            onClick={() => void handleSend()}
            loading={loading}
            disabled={(!input.trim() && pendingImages.length === 0) || loading}
            className="shrink-0 px-3 py-2 text-xs"
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  );
}
