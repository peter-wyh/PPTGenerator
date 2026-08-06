/**
 * VisualEditor — 基于 GrapesJS 的可视化 HTML 编辑器。
 *
 * 核心策略（防止浏览器卡死）：
 * - AI 报告是完整 HTML 文档（含 Tailwind CDN、Chart.js、内联 JS）。
 * - 加载到 GrapesJS 前：剥离所有 <script>，只取 <body> 内部 HTML
 *   + 收集 <head> 中的 <style> 块注入编辑器，保证视觉一致。
 * - 导出时：用原始 <head>（含 CDN scripts）+ 编辑后的 <body> + 编辑器 CSS 重组。
 * - 这样 Chart.js 等脚本在最终导出的 HTML 中照常运行，编辑器中只做静态布局编辑。
 */
import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import grapesjs from 'grapesjs';
import type { Editor } from 'grapesjs';

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

// ★ 自定义图层节点
interface LayerNode {
  id: string;
  cid?: string;
  path: string;
  label: string;
  depth: number;
  hasChildren: boolean;
  childCount: number;
}

const DEVICE_WIDTHS: Record<string, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

// ── HTML 预处理工具 ──

/**
 * 从完整 HTML 中提取编辑器所需信息。
 * 返回：bodyHTML（不含 script/canvas）、headCss（<style> 块原始文本）、
 * headLinks（stylesheet/font 链接）、tailwindCdn（Tailwind script URL，如有）
 */
function parseHtmlForEditor(
  fullHtml: string
): { bodyHtml: string; headCss: string; headLinks: string[]; tailwindCdn: string | null; fullHead: string } {
  const headMatch = fullHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headContent = headMatch ? headMatch[1] : '';

  // 提取 <style> 块内容
  const styleBlocks = headContent.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
  const headCss = styleBlocks.map(s => s.replace(/<\/?style[^>]*>/gi, '')).join('\n');

  // 提取 <link> 标签
  const linkTags = headContent.match(/<link[^>]*>/gi) || [];
  const headLinks = linkTags.filter(l =>
    /stylesheet/i.test(l) || /fonts\.googleapis/i.test(l) || /font-awesome/i.test(l) || /preconnect/i.test(l)
  );

  // 检测 Tailwind CDN
  const twMatch = headContent.match(/<script[^>]*src="(https:\/\/cdn\.tailwindcss\.com[^"]*)"/i);
  const tailwindCdn = twMatch ? twMatch[1] : null;

  // 提取 <body> 内容
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let bodyHtml = bodyMatch ? bodyMatch[1] : fullHtml;

  // 剥离 <script>
  bodyHtml = bodyHtml.replace(/<script[\s\S]*?<\/script>/gi, '');

  // 保留 canvas 但标记为占位（保持布局）
  bodyHtml = bodyHtml.replace(
    /<canvas([^>]*)><\/canvas>/gi,
    '<div class="chart-placeholder"$1 style="background:repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6 10px,#e5e7eb 10px,#e5e7eb 20px);border-radius:8px;min-height:200px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px;border:1px dashed #d1d5db;">📊 Chart</div>'
  );

  return { bodyHtml, headCss, headLinks, tailwindCdn, fullHead: headContent };
}

/** 重组完整 HTML 文档：原始 head scripts + 编辑后的 body */
function reconstructFullHtml(originalHtml: string, editedBodyHtml: string, editorCss: string): string {
  const headMatch = originalHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headContent = headMatch ? headMatch[1] : '';

  // 提取 <html> 标签属性
  const htmlTagMatch = originalHtml.match(/<html([^>]*)>/i);
  const htmlAttrs = htmlTagMatch ? htmlTagMatch[1] : ' lang="en"';

  // 提取 <body> 标签属性
  const bodyTagMatch = originalHtml.match(/<body([^>]*)>/i);
  const bodyAttrs = bodyTagMatch ? bodyTagMatch[1] : '';

  // 从 editedBodyHtml 中剥离之前注入的 style 块
  const cleanBody = editedBodyHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // 恢复 canvas 元素（替换 placeholder 回 canvas）
  const finalBody = cleanBody.replace(
    /<div[^>]*class="chart-placeholder"[^>]*>.*?<\/div>/gi,
    '<canvas></canvas>'
  );

  return `<!DOCTYPE html>
<html${htmlAttrs}>
<head>
${headContent}
<style>
${editorCss}
</style>
</head>
<body${bodyAttrs}>
${finalBody}
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
  const changeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [device, setDevice] = useState(defaultDevice);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ── 初始化 GrapesJS ──
  useEffect(() => {
    if (!containerRef.current) return;

    originalHtmlRef.current = html;
    const parsed = parseHtmlForEditor(html);

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
      layerManager: {
        appendTo: '#gjs-layers',
      },
      // ★ 启用富文本编辑：双击文本组件（td/span/p/div 等）进入内联编辑
      richTextEditor: {
        custom: true,
        actions: ['bold', 'italic', 'underline', 'strikethrough', 'link'],
      },
    });

    editorRef.current = editor;

    // ★ 在加载组件前注册：确保所有组件可编辑
    editor.on('component:create', (model: any) => {
      if (!model?.set) return;
      const type = model.get('type');
      // textnode 和 text 类型已默认可编辑
      if (type === 'textnode' || type === 'text') return;
      // 其他组件（td/th/div/span 等）也标记为可编辑
      model.set({ editable: true });
    });

    // 加载 body 组件
    editor.setComponents(parsed.bodyHtml);
    lastLoadedBodyRef.current = parsed.bodyHtml;

    editor.setDevice(defaultDevice);

    // ── 监听内容变化（防抖回调）──
    const debouncedChange = () => {
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
      changeTimerRef.current = setTimeout(() => {
        if (!onHtmlChange) return;
        const editedHtml = editor.getHtml();
        const editedCss = editor.getCss();
        const orig = originalHtmlRef.current as string;
        const fullHtml = reconstructFullHtml(orig, editedHtml, editedCss);
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

    editor.on('load', () => {
      // ★ 关键：将 CSS、字体、Tailwind 注入 canvas iframe 的 <head>
      const canvasDoc = editor.Canvas.getDocument();
      const canvasHead = canvasDoc.head;

      // 1) 注入 <style> 块（报告自带样式）
      if (parsed.headCss) {
        const styleEl = canvasDoc.createElement('style');
        styleEl.textContent = parsed.headCss;
        canvasHead.appendChild(styleEl);
      }

      // 2) 注入 Tailwind CDN（让 tailwind class 生效）
      if (parsed.tailwindCdn) {
        const twScript = canvasDoc.createElement('script');
        twScript.src = parsed.tailwindCdn;
        canvasHead.appendChild(twScript);
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

      updateUndoRedo();
      setIsLoading(false);

      // 渲染样式面板
      const smContainer = document.querySelector('#gjs-sm');
      if (smContainer && editor.StyleManager) {
        editor.StyleManager.render();
      }
      // 渲染图层面板 — 使用自定义 React 组件，不渲染 GrapesJS 原生面板
      const layersContainer = document.querySelector('#gjs-layers');
      // GrapesJS LayerManager 数据已通过 layerManager.appendTo 自动挂载到 #gjs-layers
      // 但我们用自定义 React 图层树替代原生渲染（避免 775 节点 DOM 爆炸）
      // 隐藏原生面板，自定义面板会读取 editor.Layers API
      if (layersContainer) {
        (layersContainer as HTMLElement).style.display = 'none';
      }
      // ★ editor 加载完成后触发图层重渲染
      setLayerVersion(v => v + 1);
    });

    return () => {
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
      editor.destroy();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 外部 HTML 变更 → 同步到编辑器 ──
  useEffect(() => {
    if (!editorRef.current) return;

    const parsed = parseHtmlForEditor(html);
    // 避免自身 onChange 触发的循环
    if (parsed.bodyHtml === lastLoadedBodyRef.current) return;

    originalHtmlRef.current = html;
    const editor = editorRef.current;
    editor.setComponents(parsed.bodyHtml);
    lastLoadedBodyRef.current = parsed.bodyHtml;
    editor.UndoManager.clear();

    // 重新注入 CSS 到 canvas
    const canvasDoc = editor.Canvas.getDocument();
    if (parsed.headCss && canvasDoc.head) {
      // 清除旧 style 标签
      canvasDoc.head.querySelectorAll('style').forEach(s => s.remove());
      const styleEl = canvasDoc.createElement('style');
      styleEl.textContent = parsed.headCss;
      canvasDoc.head.appendChild(styleEl);
    }
  }, [html]);

  // ── 设备切换 ──
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.setDevice(device);
  }, [device]);

  // ── 预览模式 ──
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

  // ── 图层/样式面板切换 ──
  const [activePanel, setActivePanel] = useState<'layers' | 'style'>('style');
  const [selectedInfo, setSelectedInfo] = useState<string>('未选中元素');
  // ★ 自定义图层树：展开的节点路径 Set
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());
  // ★ 触发图层重渲染的计数器（editor load 后递增）
  const [layerVersion, setLayerVersion] = useState(0);

  // ★ 从 GrapesJS 组件树递归构建可见图层列表（只展开 expandedLayers 中的路径）
  const visibleLayers: LayerNode[] = useMemo(() => {
    if (!editorRef.current) return [];
    const editor = editorRef.current;
    const wrapper = editor.DomComponents.getWrapper();
    if (!wrapper) return [];

    const result: LayerNode[] = [];

    const buildLabel = (comp: any): string => {
      const tag = comp.get('tagName') || 'div';
      const type = comp.get('type') || 'default';
      if (type === 'textnode') {
        const txt = comp.get('content')?.trim().substring(0, 25);
        return txt || 'text';
      }
      const classes = (comp.get('classes') || []).map((c: any) => c.get('name')).filter((n: string) => !n.startsWith('_')).slice(0, 2);
      return classes.length > 0 ? `${tag}.${classes.join('.')}` : tag;
    };

    const walk = (component: any, depth: number, path: string) => {
      const children = component.components();
      const childModels = children.models || children;
      const childArray = Array.from(childModels) as any[];

      childArray.forEach((child: any, i: number) => {
        const childPath = `${path}-${i}`;
        const grandChildren = child.components();
        const gcModels = grandChildren.models || grandChildren;
        const gcArray = Array.from(gcModels) as any[];

        const node: LayerNode = {
          id: child.cid || childPath,
          cid: child.cid,
          path: childPath,
          label: buildLabel(child),
          depth,
          hasChildren: gcArray.length > 0,
          childCount: gcArray.length,
        };
        result.push(node);

        // 如果当前路径在 expandedLayers 中，递归子节点
        if (expandedLayers.has(childPath) && gcArray.length > 0) {
          walk(child, depth + 1, childPath);
        }
      });
    };

    walk(wrapper, 0, 'root');
    return result;
  }, [expandedLayers, layerVersion]);

  // 选中元素时自动切换到样式面板
  useEffect(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const onSelect = () => {
      const sel = editor.getSelected();
      if (sel) {
        const tag = sel.get('tagName') || 'div';
        const cls = (sel.get('classes') || []).map((c: { get: (k: string) => string }) => c.get('name')).filter(Boolean).slice(0, 2).join(' ');
        setSelectedInfo(`<${tag}>${cls ? ' .' + cls : ''}`);
      } else {
        setSelectedInfo('未选中元素');
      }
    };
    editor.on('component:selected', onSelect);
    editor.on('component:deselected', onSelect);
    return () => {
      editor.off('component:selected', onSelect);
      editor.off('component:deselected', onSelect);
    };
  }, []);

  const showPanel = useCallback((panel: 'layers' | 'style') => {
    setActivePanel(panel);
    // 原生面板已隐藏，这里只控制自定义面板显示
    const smEl = document.querySelector('#gjs-sm');
    if (smEl) (smEl as HTMLElement).style.display = panel === 'style' ? 'block' : 'none';
  }, []);

  // ★ 图层点击：选中组件
  const handleLayerClick = useCallback((cid?: string) => {
    if (!editorRef.current || !cid) return;
    const editor = editorRef.current;
    // 兼容不同 GrapesJS 版本：尝试 getById、allById[cid]、遍历查找
    const dc = editor.DomComponents as any;
    let comp = null;
    if (typeof dc.getById === 'function') {
      comp = dc.getById(cid);
    }
    if (!comp && dc.allById) {
      comp = dc.allById[cid];
    }
    if (!comp) {
      // 遍历 wrapper 查找匹配 cid 的组件
      const wrapper = dc.getWrapper();
      const find = (c: any): any => {
        if (c.cid === cid) return c;
        const children = c.components().models || c.components();
        for (const child of Array.from(children)) {
          const found = find(child);
          if (found) return found;
        }
        return null;
      };
      comp = wrapper ? find(wrapper) : null;
    }
    if (comp) {
      editor.select(comp);
    }
  }, []);

  // ★ 图层展开/折叠
  const handleLayerToggle = useCallback((path: string) => {
    setExpandedLayers(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-surface-subtle">
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

      {/* ── 编辑器主体：左 Canvas + 右 Panels ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="relative flex-1 overflow-hidden">
          <div
            ref={containerRef}
            className="h-full w-full"
            style={{ pointerEvents: previewMode ? 'none' : 'auto' }}
          />
        </div>

        {/* 右侧面板：图层 + 样式 */}
        {!previewMode && (
          <div className="flex w-[300px] shrink-0 flex-col border-l border-border-default bg-surface-primary">
            {/* 选中元素信息条 */}
            <div className="flex items-center gap-2 border-b border-border-default px-3 py-2 bg-surface-hover/50">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-accent-primary shrink-0">
                <path d="M3 1h10v2H3V1zm0 4h10v10H3V5zm2 2v6h6V7H5z"/>
              </svg>
              <span className="text-xs font-mono text-foreground-secondary truncate">{selectedInfo}</span>
            </div>
            {/* Tabs */}
            <div className="flex border-b border-border-default">
              <button
                onClick={() => showPanel('layers')}
                className={`flex-1 py-2 text-xs font-medium transition ${
                  activePanel === 'layers' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-foreground-secondary hover:bg-surface-hover'
                }`}
              >
                📦 图层
              </button>
              <button
                onClick={() => showPanel('style')}
                className={`flex-1 py-2 text-xs font-medium transition border-l border-border-default ${
                  activePanel === 'style' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-foreground-secondary hover:bg-surface-hover'
                }`}
              >
                🎨 样式
              </button>
            </div>
            {/* 面板容器 */}
            <div className="flex-1 overflow-y-auto gjs-panel-scroll">
              {/* ★ 自定义图层树（惰性渲染，避免 775 节点 DOM 爆炸） */}
              {activePanel === 'layers' && (
                <div className="text-xs">
                  {visibleLayers.length === 0 && (
                    <div className="px-3 py-4 text-center text-foreground-muted">暂无图层</div>
                  )}
                  {visibleLayers.map(node => (
                    <div
                      key={node.id}
                      className="flex items-center gap-1 border-b border-border-subtle/50 px-1 py-1.5 hover:bg-surface-hover cursor-pointer transition"
                      style={{ paddingLeft: `${4 + node.depth * 14}px` }}
                      onClick={() => handleLayerClick(node.cid)}
                    >
                      {/* 展开/折叠箭头 */}
                      <span
                        className="flex h-4 w-4 shrink-0 items-center justify-center text-foreground-muted"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (node.hasChildren) handleLayerToggle(node.path);
                        }}
                      >
                        {node.hasChildren ? (
                          <svg
                            width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
                            style={{
                              transform: expandedLayers.has(node.path) ? 'rotate(90deg)' : 'rotate(0)',
                              transition: 'transform 0.15s',
                            }}
                          >
                            <path d="M3 1L7 5L3 9" stroke="currentColor" strokeWidth="1.5" fill="none" />
                          </svg>
                        ) : null}
                      </span>
                      {/* 图层标签 */}
                      <span className="truncate font-mono text-[11px] text-foreground-secondary">
                        {node.label}
                      </span>
                      {node.childCount > 0 && (
                        <span className="ml-auto shrink-0 text-[9px] text-foreground-muted">
                          {node.childCount}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {/* GrapesJS 样式面板（原生，保留） */}
              <div id="gjs-sm" className="gjs-sm-container text-xs" style={{ display: activePanel === 'style' ? 'block' : 'none' }} />
              {/* 隐藏的原生图层面板（GrapesJS LayerManager 数据源） */}
              <div id="gjs-layers" style={{ display: 'none' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
