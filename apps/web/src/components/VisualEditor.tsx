/**
 * VisualEditor — 基于 GrapesJS 的可视化 HTML 编辑器。
 *
 * 核心策略：
 * - AI 报告是完整 HTML 文档（含 Tailwind CDN、Chart.js、内联 JS）。
 * - 加载前剥离 <script>，提取内联脚本单独保存，保留 <canvas> 元素。
 * - 加载后将脚本注入 canvas iframe，让 Chart.js 等正常渲染。
 * - 导出时重组完整 HTML。
 * - 双击任意文本（表格单元格、标题、段落等）进入内联编辑。
 */
import { useRef, useEffect, useCallback, useState } from 'react';
import grapesjs from 'grapesjs';
import type { Editor } from 'grapesjs';
import { IconPicker } from './IconPicker';

export interface VisualEditorHandle {
  getHtml: () => string;
  setHtml: (html: string) => void;
  undo: () => void;
  redo: () => void;
}

interface VisualEditorProps {
  html: string;
  onHtmlChange?: (html: string) => void;
  editable?: boolean;
  defaultDevice?: 'desktop' | 'tablet' | 'mobile';
}

const DEVICE_WIDTHS: Record<string, string> = {
  desktop: '自适应',
  tablet: '768px',
  mobile: '375px',
};

/**
 * ★ 桌面设备画布宽度动态锁定为「预览 iframe 等效视口宽」（根宽 − gutter）——
 * 断点求值环境与预览完全一致（Tailwind md:/lg: 同触发），
 * 画布比预览窄的部分（右侧样式面板 300px）由 setZoom 等比缩放适配（Figma 式 WYSIWYG）。
 */
/** 预览 iframe 容器的 p-4 gutter（左右共 32px），画布宽度对齐时扣除。 */
const PREVIEW_GUTTER = 32;

// ── HTML 预处理工具 ──

function parseHtmlForEditor(
  fullHtml: string
): { bodyHtml: string; headCss: string; headLinks: string[]; tailwindCdn: string | null; headInlineScripts: string[]; fullHead: string; bodyScripts: string[] } {
  const headMatch = fullHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headContent = headMatch ? headMatch[1] : '';

  const styleBlocks = headContent.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
  const headCss = styleBlocks.map(s => s.replace(/<\/?style[^>]*>/gi, '')).join('\n');

  // ★ head 内联脚本（tailwind.config 品牌色定义等）——必须同步注入画布，
  //   否则自定义色 token（brand.primary 等）在编辑画布失效
  const headInlineScripts: string[] = [];
  const headScriptTags = headContent.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const tag of headScriptTags) {
    if (/\ssrc=/i.test(tag)) continue; // src 外链另行处理
    const inner = tag.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
    if (inner) headInlineScripts.push(inner);
  }

  const linkTags = headContent.match(/<link[^>]*>/gi) || [];
  const headLinks = linkTags.filter(l =>
    /stylesheet/i.test(l) || /fonts\.googleapis/i.test(l) || /font-awesome/i.test(l) || /preconnect/i.test(l)
  );

  // ★ Tailwind 运行时检测：cdn.tailwindcss.com（旧版直引）+ 自托管 play.min.js
  //   （服务端 CDN 重写后 HTML 里是 /vendor/tailwind/play.min.js，两种都要认，
  //    否则编辑画布不注入 Tailwind → grid/flex 全失效 → 内容垂直平铺）
  const twMatch = headContent.match(/<script[^>]*src="(https?:\/\/cdn\.tailwindcss\.com[^"]*|[^"]*\/vendor\/tailwind\/play\.min\.js[^"]*)"/i);
  const tailwindCdn = twMatch ? twMatch[1] : null;

  // ★ GREEDY match (* not *?) — 确保双 body 标签时也能捕获到所有内容（含脚本）
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  let bodyHtml = bodyMatch ? bodyMatch[1] : fullHtml;
  // ★ 剥离嵌套的 <body> 标签（GrapesJS 输出可能自带 body，防止双重 body）
  bodyHtml = bodyHtml.replace(/<\/?body[^>]*>/gi, '');

  // 提取 body 内联脚本
  const bodyScripts: string[] = [];
  bodyHtml = bodyHtml.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (_, content) => {
    if (content.trim()) bodyScripts.push(content.trim());
    return '';
  });
  bodyHtml = bodyHtml.replace(/<script[^>]*><\/script>/gi, '');

  return { bodyHtml, headCss, headLinks, tailwindCdn, headInlineScripts, fullHead: headContent, bodyScripts };
}

/**
 * ★ 触发 Tailwind Play CDN 全量重扫（幂等，可重复调用）。
 * 画布组件先于 Tailwind 注入加载时，Play CDN 的 MutationObserver 错过初始 class，
 * grid/flex 等工具类不生成 → 编辑画布与预览布局不一致。
 * 重新赋值 tailwind.config 等价于一次 config 变更，Play CDN 会全量重扫 class 并
 * 重新生成工具类样式。时序上 Tailwind 初始化、config 注入、组件落 DOM 均为异步，
 * 单次重扫可能仍赶在交集之前——helper 内置「立即 + 梯度延迟重试」兜底。
 */
function triggerTwRescan(canvasDoc: Document): void {
  const fire = () => {
    const w = canvasDoc.defaultView as (Window & { tailwind?: { config: unknown } }) | null;
    if (w?.tailwind) {
      w.tailwind.config = w.tailwind.config;
      return true;
    }
    return false;
  };
  fire();
  // 梯度延迟兜底：Tailwind 运行时/组件 DOM 就绪有先后，多打几枪保证命中交集
  [100, 400, 1000].forEach((delay) => setTimeout(() => fire(), delay));
}

function reconstructFullHtml(originalHtml: string, editedBodyHtml: string, editorCss: string, bodyScripts: string[]): string {
  const headMatch = originalHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headContent = headMatch ? headMatch[1] : '';

  const htmlTagMatch = originalHtml.match(/<html([^>]*)>/i);
  const htmlAttrs = htmlTagMatch ? htmlTagMatch[1] : ' lang="en"';

  const bodyTagMatch = originalHtml.match(/<body([^>]*)>/i);
  const bodyAttrs = bodyTagMatch ? bodyTagMatch[1] : '';

  // ★ 剥离 GrapesJS 输出中可能残留的嵌套 <body> 标签和重复的基础样式
  const cleanBody = editedBodyHtml
    .replace(/<style[^>]*>\* \{ box-sizing: border-box; \} body \{margin: 0;\}<\/style>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '');

  const scriptsTag = bodyScripts.length > 0
    ? '\n' + bodyScripts.map(s => `<script>\n${s}\n</script>`).join('\n')
    : '';

  return `<!DOCTYPE html>
<html${htmlAttrs}>
<head>
${headContent}
<style>
${editorCss}
</style>
</head>
<body${bodyAttrs}>
${cleanBody}${scriptsTag}
</body>
</html>`;
}

export function VisualEditor({
  html,
  onHtmlChange,
  defaultDevice = 'desktop',
}: VisualEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const originalHtmlRef = useRef<string>(html);
  const lastLoadedBodyRef = useRef<string>('');
  const bodyScriptsRef = useRef<string[]>([]);
  const changeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [device, setDevice] = useState(defaultDevice);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInfo, setSelectedInfo] = useState<string>('未选中元素');
  // ★ 桌面画布锁定宽度（容器宽+面板宽），0 = 未测量
  const [desktopWidth, setDesktopWidth] = useState(0);

  // ★ 选中图片时的状态：null = 未选中图片，object = 选中了 img 组件
  const [selectedImg, setSelectedImg] = useState<{ comp: any; src: string; alt: string } | null>(null);

  // ★ 选中图标时的状态：null = 未选中图标，object = 选中了 <i class="fa-*"> 组件
  const [selectedIcon, setSelectedIcon] = useState<{ comp: any; className: string } | null>(null);

  // ── 初始化 GrapesJS ──
  useEffect(() => {
    if (!containerRef.current) return;

    originalHtmlRef.current = html;
    const parsed = parseHtmlForEditor(html);
    bodyScriptsRef.current = parsed.bodyScripts;

    const editor = grapesjs.init({
      container: containerRef.current,
      height: '100%',
      width: '100%',
      fromElement: false,
      storageManager: false,
      deviceManager: {
        devices: [
          { name: 'desktop', width: '' },
          { name: 'tablet', width: '768px' },
          { name: 'mobile', width: '375px' },
        ],
      },
      selectorManager: { componentFirst: true },
      styleManager: {
        appendTo: '#gjs-sm',
        sectors: [
          {
            name: '布局',
            open: true,
            buildProps: ['width', 'height', 'margin', 'padding'],
          },
          {
            name: '排版',
            open: false,
            buildProps: [
              'font-family', 'font-size', 'font-weight',
              'text-align', 'color', 'line-height',
            ],
          },
          {
            name: '背景',
            open: false,
            buildProps: ['background-color'],
          },
          {
            name: '边框',
            open: false,
            buildProps: ['border-radius', 'border', 'border-color'],
          },
          {
            name: '效果',
            open: false,
            buildProps: ['display', 'flex-direction', 'justify-content', 'align-items', 'gap', 'opacity'],
          },
        ],
      },
    });

    editorRef.current = editor;

    // ★ 关键：标记所有组件 editable，让 GrapesJS 知道这些组件可以编辑
    //   （配合下方原生 contenteditable 双保险）
    editor.on('component:create', (model: any) => {
      if (!model?.set) return;
      const type = model.get('type');
      if (type === 'textnode' || type === 'text') return;
      model.set({ editable: true });
    });

    // 加载 body 组件
    editor.setComponents(parsed.bodyHtml);
    lastLoadedBodyRef.current = parsed.bodyHtml;

    // ★ 桌面设备由 device/desktopWidth effect 接管（动态宽度+缩放）
    if (defaultDevice !== 'desktop') editor.setDevice(defaultDevice);

    // ── 监听内容变化（防抖回调）──
    const debouncedChange = () => {
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
      changeTimerRef.current = setTimeout(() => {
        if (!onHtmlChange) return;
        const editedHtml = editor.getHtml();
        const editedCss = editor.getCss() ?? '';
        const orig = originalHtmlRef.current as string;
        const scripts = bodyScriptsRef.current;
        const fullHtml = reconstructFullHtml(orig, editedHtml, editedCss, scripts);
        onHtmlChange(fullHtml);
      }, 800);
    };

    editor.on('component:update', debouncedChange);
    editor.on('component:create', debouncedChange);
    editor.on('component:remove', debouncedChange);
    editor.on('styleable:change', debouncedChange);

    // 撤销/重做状态
    const updateUndoRedo = () => {
      const um = editor.UndoManager;
      setCanUndo(um.hasUndo());
      setCanRedo(um.hasRedo());
    };
    editor.on('component:update', updateUndoRedo);
    editor.on('component:create', updateUndoRedo);
    editor.on('component:remove', updateUndoRedo);

    // 判断 GrapesJS 组件是否是图标元素
    const isIconElementStr = (comp: any): boolean => {
      const tag = String(comp.get('tagName') || '').toLowerCase();
      if (tag !== 'i' && tag !== 'em' && tag !== 'span') return false;
      const attrs = comp.getAttributes();
      const cls = String(attrs.class || '');
      return /\b(fa[srlbd]?|fi-[a-z]+|icon|material-icons|bi)\b/i.test(cls);
    };

    // 选中元素信息 + 图片/图标状态同步
    const onSelect = () => {
      const sel = editor.getSelected();
      if (sel) {
        // ★ 如果选中的是图标内部元素（svg/path 等），向上找到 <i class="fa-*">
        let effectiveSel = sel;
        let checkComp: any = sel;
        for (let i = 0; i < 5 && checkComp; i++) {
          if (isIconElementStr(checkComp)) {
            effectiveSel = checkComp;
            break;
          }
          checkComp = checkComp.parent?.();
        }

        const tag = String(effectiveSel.get('tagName') || 'div').toLowerCase();
        const cls = (effectiveSel.get('classes') || []).map((c: { get: (k: string) => string }) => c.get('name')).filter(Boolean).slice(0, 2).join(' ');
        setSelectedInfo(`<${tag}>${cls ? ' .' + cls : ''}`);

        // ★ 选中图片时同步 src/alt 到状态
        if (tag === 'img') {
          const attrs = effectiveSel.getAttributes();
          setSelectedImg({
            comp: effectiveSel,
            src: String(attrs.src || ''),
            alt: String(attrs.alt || ''),
          });
          setSelectedIcon(null);
        } else if (isIconElementStr(effectiveSel)) {
          // ★ 选中图标时同步 class 到状态
          const attrs = effectiveSel.getAttributes();
          setSelectedIcon({
            comp: effectiveSel,
            className: String(attrs.class || ''),
          });
          setSelectedImg(null);
        } else {
          setSelectedImg(null);
          setSelectedIcon(null);
        }
      } else {
        setSelectedInfo('未选中元素');
        setSelectedImg(null);
        setSelectedIcon(null);
      }
    };
    editor.on('component:selected', onSelect);
    editor.on('component:deselected', onSelect);

    editor.on('load', () => {
      const canvasDoc = editor.Canvas.getDocument();
      if (!canvasDoc) return;
      const canvasHead = canvasDoc.head;

      // 1) 注入 <style> 块
      if (parsed.headCss) {
        const styleEl = canvasDoc.createElement('style');
        styleEl.textContent = parsed.headCss;
        canvasHead.appendChild(styleEl);
      }

      // 2) 注入 Tailwind CDN —— onload 后追加 head 内联脚本（tailwind.config 品牌色等）
      //    ★ config 必须在 Tailwind 运行时就绪后执行（Play CDN 会在每个 config 变更时重扫 class）
      //    ★ 画布组件先于 Tailwind 注入加载 → Play CDN 的 MutationObserver 错过初始 class，
      //      注入完成后必须「重新赋值 config」主动触发一次全量重扫，否则 grid/flex 工具类
      //      不生成 → 编辑画布布局与预览不一致（垂直平铺）。
      if (parsed.tailwindCdn) {
        const injectHeadScripts = () => {
          for (const s of parsed.headInlineScripts) {
            const el = canvasDoc.createElement('script');
            el.textContent = s;
            canvasHead.appendChild(el);
          }
          // 主动触发 Play CDN 重扫（等价于 config 变更，全量重新生成工具类样式）
          triggerTwRescan(canvasDoc);
        };
        const twScript = canvasDoc.createElement('script');
        twScript.src = parsed.tailwindCdn;
        twScript.onload = injectHeadScripts;
        twScript.onerror = injectHeadScripts; // 加载失败也注入 config/style，降级为无 Tailwind 视图
        canvasHead.appendChild(twScript);
      } else {
        // 无 Tailwind 的报告（纯 style）也要注入 head 内联脚本
        for (const s of parsed.headInlineScripts) {
          const el = canvasDoc.createElement('script');
          el.textContent = s;
          canvasHead.appendChild(el);
        }
      }

      // 3) 注入字体和样式链接
      for (const linkTag of parsed.headLinks) {
        const href = linkTag.match(/href="([^"]*)"/i);
        const rel = linkTag.match(/rel="([^"]*)"/i);
        if (href) {
          const linkEl = canvasDoc.createElement('link');
          linkEl.href = href[1];
          if (rel) linkEl.rel = rel[1];
          canvasHead.appendChild(linkEl);
        }
      }

      // 4) 注入 body 脚本（Chart.js init 等）
      if (parsed.bodyScripts.length > 0) {
        const chartJsMatch = parsed.fullHead.match(/<script[^>]*src="([^"]*chart[^"]*\.js[^"]*)"[^>]*>/i);
        if (chartJsMatch) {
          const chartScript = canvasDoc.createElement('script');
          chartScript.src = chartJsMatch[1];
          chartScript.onload = () => {
            for (const scriptContent of parsed.bodyScripts) {
              const s = canvasDoc.createElement('script');
              s.textContent = scriptContent;
              canvasDoc.body.appendChild(s);
            }
          };
          canvasHead.appendChild(chartScript);
        } else {
          for (const scriptContent of parsed.bodyScripts) {
            const s = canvasDoc.createElement('script');
            s.textContent = scriptContent;
            canvasDoc.body.appendChild(s);
          }
        }
      }

      updateUndoRedo();
      setIsLoading(false);

      // 渲染样式面板
      const smContainer = document.querySelector('#gjs-sm');
      if (smContainer && editor.StyleManager) {
        editor.StyleManager.render();
      }

      // ★★★ 核心功能：双击任何元素进入编辑 ★★★
      // 策略：
      // 1) 有文本的元素（TD/P/H1/SPAN等）→ contenteditable 编辑文本
      // 2) 图标元素（<i class="fas fa-xxx">）→ contenteditable 编辑 class 名
      // 3) 图片元素 → 选中后通过右侧面板编辑（已有逻辑）
      // 失焦时关闭编辑并同步回 GrapesJS 组件模型，触发 update 事件确保保存
      const canvasBody = canvasDoc!.body;
      const TEXT_TAGS = ['TD', 'TH', 'P', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
                         'LI', 'LABEL', 'CAPTION', 'DIV', 'A', 'STRONG', 'B', 'EM', 'I',
                         'SMALL', 'DD', 'DT', 'BLOCKQUOTE', 'FIGCAPTION',
                         'BUTTON', 'SUMMARY', 'TIME', 'MARK', 'SUB', 'SUP'];

      // 判断是否是图标元素（<i class="fa/fas/far/fab/fi-*">）
      // Font Awesome 5+ 会把 <i> 内部替换为 <svg>，所以双击时 target 可能是 svg/path
      const isIconElement = (el: Element | null): el is HTMLElement => {
        if (!el) return false;
        if (el.tagName === 'I' || el.tagName === 'EM' || el.tagName === 'SPAN') {
          const cls = el.getAttribute('class') || '';
          return /\b(fa[srlbd]?|fi-[a-z]+|icon|material-icons|bi|lu)\b/i.test(cls);
        }
        return false;
      };

      // 从当前元素向上查找图标容器
      const findIconContainer = (el: Element): HTMLElement | null => {
        let node: Element | null = el;
        while (node && node !== canvasBody) {
          if (isIconElement(node)) return node as HTMLElement;
          node = node.parentElement;
        }
        return null;
      };

      // 找到「可编辑」的目标元素——优先找图标，然后找有文本的，最后 fallback
      const findEditableTarget = (el: Element): Element | null => {
        // ★ 第一优先：图标元素（含 SVG 子元素的 FA5+ 图标）
        // 双击 svg/path/use 时向上找 <i class="fa-*">
        const icon = findIconContainer(el);
        if (icon) return icon;

        let node: Element | null = el;
        // 第二轮：找有直接文本的 TEXT_TAGS 元素
        while (node && node !== canvasBody) {
          const hasDirectText = Array.from(node.childNodes).some(
            n => n.nodeType === 3 && n.textContent && n.textContent.trim().length > 0
          );
          if (hasDirectText && TEXT_TAGS.includes(node.tagName)) {
            return node;
          }
          node = node.parentElement;
        }
        // 第三轮：fallback 到点击元素本身（如果在 TEXT_TAGS 中）
        if (el !== canvasBody && TEXT_TAGS.includes(el.tagName)) {
          return el;
        }
        return null;
      };

      let currentEditable: HTMLElement | null = null;
      let isIconEdit: boolean = false; // 标记当前是否在编辑图标 class

      // 结束编辑：关闭 contenteditable，把修改同步到 GrapesJS
      const finishEditing = () => {
        if (!currentEditable) return;
        currentEditable.removeAttribute('contenteditable');
        currentEditable.removeAttribute('title');

        const edited = currentEditable;

        // GrapesJS 需要手动通知组件模型更新
        const selected = editor.getSelected();
        if (selected) {
          // 找到对应的 GrapesJS 组件并触发更新
          // GrapesJS 没有 DOM→Component 的直接映射，遍历所有组件查找匹配的 DOM 元素
          const wrapper = editor.DomComponents.getWrapper();
          let foundComp: any = null;
          const searchComp = (comp: any): void => {
            if (!comp) return;
            if (comp.getEl && comp.getEl() === edited) { foundComp = comp; return; }
            const children = comp.components?.();
            if (children) {
              for (let i = 0; i < children.length; i++) {
                searchComp(children[i] ?? children.models?.[i]);
                if (foundComp) return;
              }
            }
          };
          searchComp(wrapper);
          const comp = foundComp;
          if (comp) {
            if (isIconEdit) {
              // 图标编辑：把 class 同步到组件属性
              comp.setAttributes({ class: edited.className });
            } else {
              // 文本编辑：把 innerHTML 同步到组件
              comp.set('content', edited.innerHTML);
            }
            comp.trigger('change:content');
            comp.trigger('change:attributes');
          }
          selected.trigger('change:content');
        }

        // 直接触发 debouncedChange（确保保存）
        const editedHtml = editor.getHtml();
        const editedCss = editor.getCss() ?? '';
        const orig = originalHtmlRef.current;
        const scripts = bodyScriptsRef.current;
        const fullHtml = reconstructFullHtml(orig, editedHtml, editedCss, scripts);
        onHtmlChange?.(fullHtml);

        currentEditable = null;
        isIconEdit = false;
      };

      // 双击 → 进入编辑（capture 阶段抢先，阻止 GrapesJS 内置 RTE 抢占）
      canvasBody.addEventListener('dblclick', (e: Event) => {
        const target = e.target as Element;
        const editableEl = findEditableTarget(target);

        if (editableEl) {
          e.preventDefault();
          e.stopPropagation();

          // 先结束之前的编辑
          if (currentEditable && currentEditable !== editableEl) {
            finishEditing();
          }

          currentEditable = editableEl as HTMLElement;

          // 判断是否是图标编辑
          isIconEdit = isIconElement(editableEl)
            && !Array.from(editableEl.childNodes).some(n => n.nodeType === 3 && n.textContent?.trim());

          if (isIconEdit) {
            // 图标编辑模式：用 input 浮层编辑 class，不破坏内部 SVG
            const currentClass = (editableEl as HTMLElement).getAttribute('class') || '';
            const classInput = canvasDoc!.createElement('input');
            classInput.type = 'text';
            classInput.value = currentClass;
            classInput.style.cssText = 'position:absolute;z-index:99999;font-size:12px;padding:4px 8px;border:2px solid #3b82f6;border-radius:4px;background:#fff;color:#000;width:260px;box-shadow:0 2px 8px rgba(0,0,0,0.2)';
            const rect = (editableEl as HTMLElement).getBoundingClientRect();
            const canvasRect = canvasDoc!.body.getBoundingClientRect();
            classInput.style.left = `${rect.left - canvasRect.left}px`;
            classInput.style.top = `${rect.bottom - canvasRect.top + 4}px`;
            canvasDoc!.body.appendChild(classInput);
            classInput.focus();
            classInput.select();

            const finishIconEdit = () => {
              const newClass = classInput.value.trim();
              if (newClass && newClass !== currentClass) {
                // 写入新的 class 到图标元素
                (editableEl as HTMLElement).setAttribute('class', newClass);
                // 同步到 GrapesJS 组件
                const wrapper = editor.DomComponents.getWrapper();
                let foundComp: any = null;
                const searchComp = (comp: any): void => {
                  if (!comp) return;
                  if (comp.getEl && comp.getEl() === editableEl) { foundComp = comp; return; }
                  const children = comp.components?.();
                  if (children) {
                    for (let i = 0; i < children.length; i++) {
                      searchComp(children[i] ?? children.models?.[i]);
                      if (foundComp) return;
                    }
                  }
                };
                searchComp(wrapper);
                if (foundComp) {
                  foundComp.setAttributes({ class: newClass });
                  foundComp.trigger('change:attributes');
                }
                // 触发保存
                const editedHtml = editor.getHtml();
                const editedCss = editor.getCss() ?? '';
                const orig = originalHtmlRef.current;
                const scripts = bodyScriptsRef.current;
                const fullHtml = reconstructFullHtml(orig, editedHtml, editedCss, scripts);
                onHtmlChange?.(fullHtml);
              }
              classInput.remove();
              currentEditable = null;
              isIconEdit = false;
            };

            classInput.addEventListener('blur', finishIconEdit, { once: true });
            classInput.addEventListener('keydown', (ev: KeyboardEvent) => {
              if (ev.key === 'Enter') { ev.preventDefault(); classInput.blur(); }
              if (ev.key === 'Escape') { classInput.value = currentClass; classInput.blur(); }
            });
          } else {
            // 文本编辑模式
            currentEditable.setAttribute('contenteditable', 'true');
            currentEditable.focus();
            const range = canvasDoc!.createRange();
            range.selectNodeContents(currentEditable);
            const sel = canvasDoc!.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
          }
        }
      }, true); // ← capture: true，先于 GrapesJS 处理

      // 失焦/Enter → 结束编辑
      canvasBody.addEventListener('focusout', (e: Event) => {
        const target = e.target as HTMLElement;
        if (target.getAttribute('contenteditable') === 'true') {
          // 延迟检查，避免选择内部子元素时误触
          setTimeout(() => {
            // 检查焦点是否还在当前可编辑元素内
            const focused = canvasDoc!.activeElement;
            if (currentEditable && focused !== currentEditable) {
              finishEditing();
            }
          }, 50);
        }
      });

      canvasBody.addEventListener('keydown', (e: KeyboardEvent) => {
        if (!currentEditable) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          finishEditing();
        }
        // Shift+Enter 插入换行，单独 Enter 结束编辑
        if (e.key === 'Enter' && !e.shiftKey) {
          // 图标编辑模式：Enter 直接保存
          if (isIconEdit) {
            e.preventDefault();
            // 把编辑后的 class 写回元素的 class 属性
            const newClass = currentEditable.textContent?.trim() || '';
            currentEditable.setAttribute('class', newClass);
            // 清空文本（图标不应该有文本内容）
            currentEditable.textContent = '';
            finishEditing();
            return;
          }
          // 检查是否在 td/th/div/p 中（多行文本可以换行）
          const tag = currentEditable.tagName;
          if (tag === 'TD' || tag === 'TH' || tag === 'DIV' || tag === 'P') {
            return; // 允许换行
          }
          e.preventDefault();
          finishEditing();
        }
      });
    });

    return () => {
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
      editor.off('component:selected', onSelect);
      editor.off('component:deselected', onSelect);
      editor.destroy();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 外部 HTML 变更 → 同步到编辑器 ──
  useEffect(() => {
    if (!editorRef.current) return;

    const parsed = parseHtmlForEditor(html);
    if (parsed.bodyHtml === lastLoadedBodyRef.current) return;

    originalHtmlRef.current = html;
    bodyScriptsRef.current = parsed.bodyScripts;
    const editor = editorRef.current;
    editor.setComponents(parsed.bodyHtml);
    lastLoadedBodyRef.current = parsed.bodyHtml;
    editor.UndoManager.clear();

    const canvasDoc = editor.Canvas.getDocument();
    if (!canvasDoc) return;
    if (parsed.headCss && canvasDoc.head) {
      canvasDoc.head.querySelectorAll('style').forEach(s => s.remove());
      const styleEl = canvasDoc.createElement('style');
      styleEl.textContent = parsed.headCss;
      canvasDoc.head.appendChild(styleEl);
    }
    // ★ head 内联脚本（tailwind.config 等）同样需要重注入（外部版本切换时色板定义会变）
    const oldCfg = canvasDoc.head.querySelectorAll('script[data-head-inline]');
    oldCfg.forEach(s => s.remove());
    for (const s of parsed.headInlineScripts) {
      const el = canvasDoc.createElement('script');
      el.setAttribute('data-head-inline', '1');
      el.textContent = s;
      canvasDoc.head.appendChild(el);
    }
    // ★ 主动触发 Play CDN 重扫——外部版本切换后 body 已重建，重扫确保工具类样式同步
    triggerTwRescan(canvasDoc);
  }, [html]);

  // ── 设备切换 ──
  useEffect(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;

    // ★ setZoom(0) 会被 grapesjs 0.23.4 钳到下限 1%（transform matrix(0.01)，
    //   画布视觉塌缩成 8px）——0 并非"100% 不缩放"。不缩放必须显式传 100。
    const fitZoom = (targetW: number, capAt100 = true) => {
      requestAnimationFrame(() => {
        if (!editorRef.current || targetW <= 0) return;
        const viewEl = editor.Canvas.getCanvasView().el;
        const ratio = viewEl.clientWidth / targetW;
        const pct = ratio >= 0.999 ? 100 : Math.max(1, Math.round(ratio * 100));
        // capAt100: 手机视图(375px)不放大到画布区满宽——放大导致文字模糊，居中留白更符合常规编辑器行为
        editor.Canvas.setZoom(capAt100 ? Math.min(pct, 100) : pct);
      });
    };

    if (device === 'desktop' && desktopWidth > 0) {
      // ★ 动态设备:宽度=预览等效宽(容器+面板),断点行为与预览 iframe 一致。
      editor.Devices.add({ id: 'desktop-wide', name: 'desktop-wide', width: `${desktopWidth}px` });
      editor.setDevice('desktop-wide');
      fitZoom(desktopWidth);
    } else {
      editor.setDevice(device);
      if (device === 'desktop') {
        // 初始挂载 desktopWidth 尚未测得——先按 100% 渲染，测量后 effect 重跑再 fit
        editor.Canvas.setZoom(100);
      } else {
        // ★ 平板(768)/手机(375)同样按画布区宽度自适应缩放，与桌面同款 fit 逻辑
        const targetW = device === 'tablet' ? 768 : 375;
        fitZoom(targetW);
      }
    }
  }, [device, desktopWidth]);

  // ── 测量容器宽度 → 桌面画布锁定宽 ──
  // ★ WYSIWYG 原则：device 宽必须等于「预览」模式 iframe 的 CSS 视口宽（根宽 − p-4×2 gutter）。
  //   两者断点(md:768/lg:1024/xl:1280)求值环境一致，Tailwind 响应式行为才一致。
  //   画布区比预览区窄 300px（右侧样式面板），由 setZoom 按 device 宽等比缩放适配——
  //   而非把 +300 补进 device 宽（那是像素平移，会改变断点求值 → 预览/编辑布局漂移）。
  useEffect(() => {
    const el = containerRef.current?.closest('.visual-editor-root') as HTMLElement | null;
    if (!el) return;
    const measure = () => setDesktopWidth(Math.max(320, el.clientWidth - PREVIEW_GUTTER));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const togglePreviewMode = useCallback(() => {
    setPreviewMode((prev) => {
      const next = !prev;
      if (editorRef.current) {
        editorRef.current.runCommand(next ? 'core:preview' : 'core:preview-off');
      }
      return next;
    });
  }, []);

  const handleUndo = useCallback(() => {
    editorRef.current?.UndoManager.undo();
  }, []);

  const handleRedo = useCallback(() => {
    editorRef.current?.UndoManager.redo();
  }, []);

  // ★ 更新图片 src
  const handleImgSrcChange = useCallback((newSrc: string) => {
    if (!selectedImg) return;
    selectedImg.comp.addAttributes({ src: newSrc });
    setSelectedImg(prev => prev ? { ...prev, src: newSrc } : null);
  }, [selectedImg]);

  // ★ 更新图片 alt
  const handleImgAltChange = useCallback((newAlt: string) => {
    if (!selectedImg) return;
    selectedImg.comp.addAttributes({ alt: newAlt });
    setSelectedImg(prev => prev ? { ...prev, alt: newAlt } : null);
  }, [selectedImg]);

  // ★ 更新图标 class（替换图标）
  const handleIconChange = useCallback((newClass: string) => {
    if (!selectedIcon) return;
    selectedIcon.comp.setAttributes({ class: newClass });
    setSelectedIcon(prev => prev ? { ...prev, className: newClass } : null);
  }, [selectedIcon]);

  // ★ 本地上传图片 → base64
  const handleImgUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedImg) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      selectedImg.comp.addAttributes({ src: dataUrl });
      setSelectedImg(prev => prev ? { ...prev, src: dataUrl } : null);
    };
    reader.readAsDataURL(file);
  }, [selectedImg]);

  return (
    <div className="visual-editor-root flex h-full w-full flex-col overflow-hidden bg-surface-subtle">
      {/* ── 工具栏 ── */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border-default bg-surface-primary px-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleUndo}
            disabled={!canUndo || previewMode}
            className="rounded p-1.5 text-foreground-secondary hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed"
            title="撤销 (Ctrl+Z)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 3.5L4 7h2.5c0 2.5 2 4.5 4.5 4.5.5 0 1-.1 1.5-.3l-1.2-1.2c-.1 0-.2.05-.3.05-1.7 0-3-1.3-3-3H10L8 3.5z"/></svg>
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo || previewMode}
            className="rounded p-1.5 text-foreground-secondary hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed"
            title="重做 (Ctrl+Y)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 3.5L12 7H9.5c0 2.5-2 4.5-4.5 4.5-.5 0-1-.1-1.5-.3l1.2-1.2c.1 0 .2.05.3.05 1.7 0 3-1.3 3-3H6L8 3.5z"/></svg>
          </button>
          <div className="mx-1 h-5 w-px bg-border-default" />
          {/* 设备切换 */}
          <div className="flex rounded-md border border-border-default">
            <button
              onClick={() => setDevice('desktop')}
              className={`rounded-l-md px-2.5 py-1 text-xs transition ${
                device === 'desktop' ? 'bg-accent-primary text-foreground-inverse' : 'text-foreground-secondary hover:bg-surface-hover'
              }`}
              title="桌面视图"
            >
              🖥️
            </button>
            <button
              onClick={() => setDevice('tablet')}
              className={`border-x border-border-default px-2.5 py-1 text-xs transition ${
                device === 'tablet' ? 'bg-accent-primary text-foreground-inverse' : 'text-foreground-secondary hover:bg-surface-hover'
              }`}
              title="平板视图"
            >
              📱
            </button>
            <button
              onClick={() => setDevice('mobile')}
              className={`rounded-r-md px-2.5 py-1 text-xs transition ${
                device === 'mobile' ? 'bg-accent-primary text-foreground-inverse' : 'text-foreground-secondary hover:bg-surface-hover'
              }`}
              title="手机视图"
            >
              📱
            </button>
          </div>
          <span className="text-[11px] text-foreground-muted">{DEVICE_WIDTHS[device]}</span>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <span className="text-[11px] text-foreground-muted animate-pulse">加载中…</span>}
          <span className="text-[11px] text-foreground-muted">💡 双击文字可编辑</span>
          <button
            onClick={togglePreviewMode}
            className={`rounded-md px-2.5 py-1 text-xs transition ${
              previewMode ? 'bg-accent-primary/10 text-accent-primary' : 'text-foreground-secondary hover:bg-surface-hover'
            }`}
            title={previewMode ? '退出预览' : '进入预览'}
          >
            {previewMode ? '✏️ 编辑' : '👁️ 预览'}
          </button>
        </div>
      </div>

      {/* ── 编辑器主体：左 Canvas + 右 样式面板 ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="relative flex-1 overflow-hidden">
          <div
            ref={containerRef}
            className="h-full w-full"
            style={{ pointerEvents: previewMode ? 'none' : 'auto' }}
          />
        </div>

        {/* 右侧样式面板 */}
        {!previewMode && (
          <div className="flex w-[300px] shrink-0 flex-col border-l border-border-default bg-surface-primary">
            {/* 选中元素信息条 */}
            <div className="flex items-center gap-2 border-b border-border-default px-3 py-2 bg-surface-hover/50">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-accent-primary shrink-0">
                <path d="M3 1h10v2H3V1zm0 4h10v10H3V5zm2 2v6h6V7H5z"/>
              </svg>
              <span className="text-xs font-mono text-foreground-secondary truncate">{selectedInfo}</span>
            </div>
            {/* ★ 图片编辑卡片：选中 img 时自动出现在样式面板上方 */}
            {selectedImg && (
              <div className="space-y-2.5 border-b border-border-default p-3 bg-surface-hover/30">
                <div className="text-[11px] font-semibold text-foreground-secondary">🖼️ 图片设置</div>

                {/* 预览 */}
                <div className="overflow-hidden rounded-md border border-border-default bg-white">
                  {selectedImg.src ? (
                    <img
                      src={selectedImg.src}
                      alt="预览"
                      className="max-h-28 w-full object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                    />
                  ) : (
                    <div className="flex h-16 items-center justify-center text-[11px] text-foreground-muted">无图片</div>
                  )}
                </div>

                {/* 本地上传 */}
                <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-border-default px-3 py-2 text-[11px] text-foreground-secondary transition hover:border-accent-primary hover:text-accent-primary">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 11V3.5L5 6.5l-1-1L8 1.5l4 4-1 1L9 3.5V11H8zm-5 2h10v2H3v-2z"/>
                  </svg>
                  上传本地图片
                  <input type="file" accept="image/*" className="hidden" onChange={handleImgUpload} />
                </label>

                {/* src URL */}
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-foreground-muted">图片地址</label>
                  <input
                    type="text"
                    value={selectedImg.src}
                    onChange={(e) => handleImgSrcChange(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-md border border-border-default bg-surface-primary px-2 py-1.5 text-[11px] text-foreground-primary focus:border-accent-primary focus:outline-none"
                  />
                </div>

                {/* alt */}
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-foreground-muted">替代文本</label>
                  <input
                    type="text"
                    value={selectedImg.alt}
                    onChange={(e) => handleImgAltChange(e.target.value)}
                    placeholder="图片描述"
                    className="w-full rounded-md border border-border-default bg-surface-primary px-2 py-1.5 text-[11px] text-foreground-primary focus:border-accent-primary focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* ★ 图标替换卡片：选中 <i class="fa-*"> 时自动出现 */}
            {selectedIcon && (
              <IconPicker
                currentClass={selectedIcon.className}
                onChange={handleIconChange}
              />
            )}

            {/* GrapesJS 样式面板 */}
            <div className="flex-1 overflow-y-auto gjs-panel-scroll">
              <div id="gjs-sm" className="gjs-sm-container text-xs" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
