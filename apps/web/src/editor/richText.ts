/**
 * 轻量富文本处理（strategy-block 内容）。
 *
 * 内容以「受限 HTML 字符串」存储于组件 data（如 StrategyBlockData.rows[i][2]）。
 * 仅允许白名单标签、无属性；编辑端 contentEditable 产出的 <div>（换行）
 * 在清洗时补 <br> 以保留换行语义。无第三方依赖。
 */

/** 允许保留的标签（无属性）。 */
const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'UL', 'OL', 'LI', 'BR', 'P', 'MARK']);

/** 连同内容整体移除的标签（避免 script/style 等通过 unpack 泄漏文本或执行）。 */
const DROP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'HEAD', 'META', 'LINK', 'TITLE', 'NOSCRIPT',
  'OBJECT', 'EMBED', 'IFRAME', 'TEMPLATE', 'SVG',
]);

/**
 * 清洗 HTML：白名单内标签去属性；非白名单标签 unpack（保留子节点），
 * 其中 <DIV>（contentEditable 常见换行产物）在 unpack 后补一个 <br>；
 * DROP_TAGS 整体移除。基于 document.createElement（jsdom 兼容，无需 DOMParser）。
 */
export function sanitizeRichText(html: string): string {
  if (!html) return '';
  const root = document.createElement('div');
  root.innerHTML = html;
  cleanNode(root);
  return root.innerHTML;
}

function cleanNode(node: Element): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const tag = el.tagName;
      if (DROP_TAGS.has(tag)) {
        el.remove();
        continue;
      }
      // 先递归清理子节点（unpack 前确保子节点已干净）。
      cleanNode(el);
      if (ALLOWED_TAGS.has(tag)) {
        // 白名单：移除所有属性，保留标签与已清理的子节点。
        for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
      } else {
        // 非白名单：用子节点 fragment 替换（unpack）。DIV 补 <br>。
        const frag = document.createDocumentFragment();
        while (el.firstChild) frag.appendChild(el.firstChild);
        if (tag === 'DIV') frag.appendChild(document.createElement('br'));
        el.replaceWith(frag);
      }
    } else if (child.nodeType !== Node.TEXT_NODE) {
      // 注释等非文本/元素节点移除。
      child.parentNode?.removeChild(child);
    }
  }
}

/**
 * 清洗 HTML 后，在「文本节点」上按高亮词（逗号分隔）切分，命中词包成强调 span。
 * 标签结构不被破坏；正则用捕获组配合 split，分隔（命中）片段保留在结果数组中。
 */
export function renderHtmlWithHighlights(html: string, highlights?: string): string {
  const safe = sanitizeRichText(html);
  const words = (highlights ?? '')
    .split(/[,，]/)
    .map((w) => w.trim())
    .filter(Boolean);
  if (words.length === 0 || !safe) return safe;

  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'i');
  const lower = words.map((w) => w.toLowerCase());

  const root = document.createElement('div');
  root.innerHTML = safe;
  highlightTextNodes(root, re, lower);
  return root.innerHTML;
}

function highlightTextNodes(node: Node, re: RegExp, lower: string[]): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? '';
      if (!text || !re.test(text)) continue;
      const parts = text.split(re);
      const frag = document.createDocumentFragment();
      for (const p of parts) {
        if (!p) continue;
        if (lower.includes(p.toLowerCase())) {
          const span = document.createElement('span');
          span.className = 'text-accent-secondary font-medium';
          span.textContent = p;
          frag.appendChild(span);
        } else {
          frag.appendChild(document.createTextNode(p));
        }
      }
      child.replaceWith(frag);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      highlightTextNodes(child, re, lower);
    }
  }
}
