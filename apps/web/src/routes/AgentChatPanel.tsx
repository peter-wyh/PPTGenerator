/**
 * AgentChatPanel — Report Agent 对话面板。
 * 用户输入编辑指令 → 调用 AI 增量编辑 → 返回修改后 HTML → 自动保存。
 * 支持图片上传（vision 多模态）和 HTML 文件导入。
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/Button';
import { htmlTemplatesApi } from '@/api/htmlTemplates';
import type { AgentChatMessage } from '@/api/htmlTemplates';

interface AgentChatPanelProps {
  projectId: string;
  currentHtml: string;
  agentHistory: AgentChatMessage[];
  onHtmlChange: (html: string) => void;
  onHistoryChange: (history: AgentChatMessage[]) => void;
}

const QUICK_ACTIONS = [
  { label: '改标题', prompt: '把报告标题改为：' },
  { label: '换配色', prompt: '把报告的主色调改为：' },
  { label: '加列', prompt: '在表格中添加一列：' },
  { label: '改图表', prompt: '把图表类型改为：' },
];

// 图片大小限制（base data URL，~4MB）
const MAX_IMAGE_SIZE = 4 * 1024 * 1024;

export function AgentChatPanel({
  projectId,
  currentHtml,
  agentHistory,
  onHtmlChange,
  onHistoryChange,
}: AgentChatPanelProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const htmlInputRef = useRef<HTMLInputElement>(null);

  // ★ 已选择的图片（base64 data URL 数组），随消息一起发送
  const [pendingImages, setPendingImages] = useState<string[]>([]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agentHistory, loading, pendingImages]);

  // ── 图片上传处理 ──
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newImages: string[] = [];
    Array.from(files).forEach((file) => {
      if (file.size > MAX_IMAGE_SIZE) {
        setError(`图片 "${file.name}" 超过 4MB 限制`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        newImages.push(reader.result as string);
        if (newImages.length === Math.min(files.length, 5)) {
          setPendingImages((prev) => [...prev, ...newImages].slice(0, 5));
        }
      };
      reader.readAsDataURL(file);
    });
    // reset input value 以便可以重复选择同一文件
    e.target.value = '';
  }, []);

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
      };
      const newHistory = [...agentHistory, userMsg, aiMsg];
      onHistoryChange(newHistory);
      // 自动保存
      void htmlTemplatesApi.autoSave(projectId, html, newHistory);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [agentHistory, onHtmlChange, onHistoryChange, projectId]);

  const handleSend = useCallback(
    async (instruction?: string) => {
      const text = (instruction ?? input).trim();
      if ((!text && pendingImages.length === 0) || loading || !currentHtml) return;

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

      try {
        const html = await htmlTemplatesApi.agentEdit({
          currentHtml,
          instruction: text || '请参考上传的图片修改报告',
          images: hasImages ? sentImages : undefined,
        });
        onHtmlChange(html);

        const aiMsg: AgentChatMessage = {
          role: 'assistant',
          content: '已更新 ✅',
          action: 'edit',
          ts: new Date().toISOString(),
        };
        const finalHistory = [...newHistory, aiMsg];
        onHistoryChange(finalHistory);

        // 自动保存
        await htmlTemplatesApi.autoSave(projectId, html, finalHistory);
      } catch (e: unknown) {
        const err = e as {
          response?: { data?: { error?: { message?: string }; message?: string } };
          message?: string;
        };
        setError(
          err.response?.data?.error?.message ||
            err.response?.data?.message ||
            err.message ||
            '编辑失败，请重试',
        );
      } finally {
        setLoading(false);
      }
    },
    [input, loading, currentHtml, agentHistory, onHtmlChange, onHistoryChange, projectId, pendingImages],
  );

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
              {/* 显示消息中的图片缩略图 */}
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
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-surface-hover px-3 py-2 text-xs text-foreground-muted">
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-primary" />
                AI 正在编辑… (~1-2min)
              </span>
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red/10 px-3 py-2 text-xs text-red">{error}</div>
        )}
      </div>

      {/* 待发送图片预览条 */}
      {pendingImages.length > 0 && (
        <div className="flex items-center gap-1.5 border-t border-border-default px-3 pt-2">
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
          {/* 图片上传按钮 */}
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

          {/* HTML 导入按钮 */}
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

          {/* 文本输入 */}
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
