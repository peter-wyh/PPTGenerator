/**
 * ThinkingPanel — AI 推理过程实时展示面板。
 * 显示 reasoning_content 流式文本，可折叠/展开。
 */
import { useState, useRef, useEffect } from 'react';

interface ThinkingPanelProps {
  reasoning: string;
  isThinking: boolean;
}

export function ThinkingPanel({ reasoning, isThinking }: ThinkingPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current && !collapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [reasoning, collapsed]);

  if (!reasoning && !isThinking) return null;

  return (
    <div className="border-b border-border-default bg-surface-secondary">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between px-4 py-2 text-xs font-medium text-foreground-secondary transition hover:bg-surface-hover"
      >
        <span className="flex items-center gap-1.5">
          {isThinking ? (
            <>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-primary" />
              <span className="text-accent-primary">AI 思考中…</span>
            </>
          ) : (
            <span className="text-foreground-muted">💭 AI 思考过程</span>
          )}
        </span>
        <span className="text-[10px] text-foreground-muted">
          {collapsed ? '▾ 展开' : '▴ 收起'}
        </span>
      </button>
      {!collapsed && (
        <div
          ref={scrollRef}
          className="max-h-40 overflow-y-auto whitespace-pre-wrap px-4 pb-3 text-[11px] leading-relaxed text-foreground-muted"
        >
          {reasoning || '…'}
        </div>
      )}
    </div>
  );
}
