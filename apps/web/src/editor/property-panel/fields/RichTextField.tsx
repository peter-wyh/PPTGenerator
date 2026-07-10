import { useEffect, useRef } from 'react';
import { sanitizeRichText, renderHtmlWithHighlights } from '../../richText';

/**
 * 轻量富文本字段：toolbar（加粗/斜体/列表）+ contentEditable。
 * 不受控：挂载时以 sanitize 后的 HTML 初始化；onBlur 时清洗并写回。
 * 高亮整合：未聚焦时按 highlights 属性渲染高亮 span（命中词包强调色），
 *   内容随 highlights 属性变化即时重算（「内容伴随属性调整」）；
 *   聚焦中不回写以保光标；commit 始终存清洗后的纯 HTML（高亮 span 不入库）。
 * contentEditable / execCommand 在 jsdom 不可用，编辑交互不单测。
 */
export function RichTextField({
  value,
  highlights,
  onChange,
}: {
  value: string;
  highlights?: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // 同步外部 value/highlights → contentEditable：仅在未聚焦时写入，避免覆盖用户正在编辑的光标。
  // 这样删除/重排行（index key 复用实例）或 undo 时，正文也能正确跟随 data；
  // 改高亮词时，未聚焦的编辑器即时重算高亮（聚焦中的编辑器失焦后再重算）。
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return; // 聚焦中：不干预编辑。
    const html = renderHtmlWithHighlights(value, highlights);
    if (el.innerHTML !== html) el.innerHTML = html;
  }, [value, highlights]);

  const exec = (cmd: string) => {
    document.execCommand(cmd);
    ref.current?.focus();
  };

  const commit = () => {
    if (!ref.current) return;
    const next = sanitizeRichText(ref.current.innerHTML);
    if (next !== sanitizeRichText(value)) onChange(next);
  };

  return (
    <div className="rounded border border-border-default">
      <div className="flex gap-1 border-b border-border-subtle px-1 py-0.5">
        <button
          type="button"
          title="加粗"
          onMouseDown={(e) => {
            e.preventDefault();
            exec('bold');
          }}
          className="font-bold px-1.5 text-xs text-foreground-secondary hover:bg-surface-hover rounded"
        >
          B
        </button>
        <button
          type="button"
          title="斜体"
          onMouseDown={(e) => {
            e.preventDefault();
            exec('italic');
          }}
          className="italic px-1.5 text-xs text-foreground-secondary hover:bg-surface-hover rounded"
        >
          I
        </button>
        <button
          type="button"
          title="列表"
          onMouseDown={(e) => {
            e.preventDefault();
            exec('insertUnorderedList');
          }}
          className="px-1.5 text-xs text-foreground-secondary hover:bg-surface-hover rounded"
        >
          •
        </button>
      </div>
      {/* onInput 实时提交：Canvas 点击组件时 mousedown.preventDefault 会阻止 contentEditable 失焦，
          仅依赖 onBlur 会导致编辑后的内容永远无法同步到画板；onInput 使内容随输入即时入库。
          useEffect 仍在聚焦时跳过回写（见上），避免光标跳动。 */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={commit}
        onBlur={commit}
        className="min-h-[60px] px-2 py-1 text-xs text-foreground-primary focus:outline-none [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4"
      />
    </div>
  );
}
