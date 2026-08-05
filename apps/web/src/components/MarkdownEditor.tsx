/**
 * Markdown 渲染器 — 无外部依赖。
 * 支持: 标题(h1-h3)、代码块(```lang)、行内代码(`code`)、粗体/斜体、
 *       无序列表、有序列表、引用(>)、分隔线(---)、表格(|)、链接([]())
 * 用于系统提示词回显（只读展示）。
 */
import { type FC } from 'react';

/** 将单行 markdown 文本渲染为 JSX（行内格式） */
function renderInline(text: string, keyPrefix: string) {
  const parts: JSX.Element[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // 行内代码 `code`
    let m = remaining.match(/^`([^`]+)`/);
    if (m) {
      parts.push(<code key={`${keyPrefix}-${key++}`} className="rounded bg-slate-200 px-1.5 py-0.5 text-[12px] text-slate-800 font-mono">{m[1]}</code>);
      remaining = remaining.slice(m[0].length);
      continue;
    }
    // 粗体 **text**
    m = remaining.match(/^\*\*([^*]+)\*\*/);
    if (m) {
      parts.push(<strong key={`${keyPrefix}-${key++}`} className="font-semibold text-slate-900">{m[1]}</strong>);
      remaining = remaining.slice(m[0].length);
      continue;
    }
    // 斜体 *text* 或 _text_
    m = remaining.match(/^(?:\*([^*]+)\*|_([^_]+)_)/);
    if (m) {
      parts.push(<em key={`${keyPrefix}-${key++}`} className="italic text-slate-600">{m[1] || m[2]}</em>);
      remaining = remaining.slice(m[0].length);
      continue;
    }
    // 链接 [text](url)
    m = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (m) {
      parts.push(<a key={`${keyPrefix}-${key++}`} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{m[1]}</a>);
      remaining = remaining.slice(m[0].length);
      continue;
    }
    // 普通文字：消费到下一个特殊字符
    const next = remaining.search(/[`*_\[]/);
    if (next === -1) {
      parts.push(<span key={`${keyPrefix}-${key++}`}>{remaining}</span>);
      break;
    }
    if (next === 0) {
      parts.push(<span key={`${keyPrefix}-${key++}`}>{remaining[0]}</span>);
      remaining = remaining.slice(1);
    } else {
      parts.push(<span key={`${keyPrefix}-${key++}`}>{remaining.slice(0, next)}</span>);
      remaining = remaining.slice(next);
    }
  }
  return parts;
}

interface MarkdownPreviewProps {
  content: string;
  /** 自定义容器类名 */
  className?: string;
}

export const MarkdownPreview: FC<MarkdownPreviewProps> = ({ content, className = '' }) => {
  const lines = content.split('\n');
  const elements: JSX.Element[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 代码块 ```lang ... ```
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre key={`md-${key++}`} className="my-3 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
          <code className={`text-[13px] leading-relaxed font-mono text-slate-700 ${lang === 'css' ? 'language-css' : ''}`}>
            {codeLines.join('\n')}
          </code>
        </pre>
      );
      continue;
    }

    // 分隔线 ---
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={`md-${key++}`} className="my-4 border-slate-300" />);
      i++;
      continue;
    }

    // 标题 h1-h4
    const headingMatch = line.match(/^(#{1,4})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const cls = level === 1 ? 'text-lg font-bold text-slate-900 mt-5 mb-3'
        : level === 2 ? 'text-base font-bold text-slate-900 mt-4 mb-2'
        : level === 3 ? 'text-sm font-semibold text-slate-800 mt-3 mb-1.5'
        : 'text-sm font-semibold text-slate-700 mt-2 mb-1';
      elements.push(
        level === 1 ? <h1 key={`md-${key++}`} className={cls}>{renderInline(text, `h1-${key}`)}</h1>
        : level === 2 ? <h2 key={`md-${key++}`} className={cls}>{renderInline(text, `h2-${key}`)}</h2>
        : level === 3 ? <h3 key={`md-${key++}`} className={cls}>{renderInline(text, `h3-${key}`)}</h3>
        : <h4 key={`md-${key++}`} className={cls}>{renderInline(text, `h4-${key}`)}</h4>
      );
      i++;
      continue;
    }

    // 引用 >
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].slice(1).trim());
        i++;
      }
      elements.push(
        <blockquote key={`md-${key++}`} className="my-3 border-l-[3px] border-blue-500/60 bg-blue-50 py-2 pl-4 pr-3 text-[13px] text-slate-600 rounded-r">
          {renderInline(quoteLines.join(' '), `bq-${key}`)}
        </blockquote>
      );
      continue;
    }

    // 表格 | a | b |
    if (line.startsWith('|') && i + 1 < lines.length && lines[i + 1].startsWith('|') && /[-:]/.test(lines[i + 1])) {
      const headerCells = line.split('|').slice(1, -1).map((c) => c.trim());
      i += 2; // skip header + separator
      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        bodyRows.push(lines[i].split('|').slice(1, -1).map((c) => c.trim()));
        i++;
      }
      elements.push(
        <div key={`md-${key++}`} className="my-3 overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-slate-300">
                {headerCells.map((c, ci) => (
                  <th key={ci} className="px-3 py-2 text-left font-semibold text-slate-800">{renderInline(c, `th-${key}-${ci}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri} className="border-b border-slate-100">
                  {row.map((c, ci) => (
                    <td key={ci} className="px-3 py-2 text-slate-600">{renderInline(c, `td-${key}-${ri}-${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // 无序列表 - or *
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''));
        i++;
      }
      elements.push(
        <ul key={`md-${key++}`} className="my-2 space-y-1 pl-5 text-[13px] text-slate-700">
          {items.map((item, idx) => (
            <li key={idx} className="relative pl-3 before:absolute before:left-0 before:top-[7px] before:h-1.5 before:w-1.5 before:rounded-full before:bg-slate-400">
              {renderInline(item, `li-${key}-${idx}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 有序列表 1.
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      elements.push(
        <ol key={`md-${key++}`} className="my-2 space-y-1 pl-5 text-[13px] text-slate-700 list-decimal">
          {items.map((item, idx) => (
            <li key={idx} className="pl-1 marker:text-slate-400">
              {renderInline(item, `ol-${key}-${idx}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 空行
    if (line.trim() === '') {
      i++;
      continue;
    }

    // 普通段落
    elements.push(
      <p key={`md-${key++}`} className="my-1.5 text-[13px] leading-relaxed text-slate-600">
        {renderInline(line, `p-${key}`)}
      </p>
    );
    i++;
  }

  return <div className={`markdown-body ${className}`}>{elements}</div>;
};
