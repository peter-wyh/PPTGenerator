/**
 * VisualEditor — 基于 GrapesJS 的可视化 HTML 编辑器。
 *
 * 核心策略（防止浏览器卡死）：
 * - AI 报告是完整 HTML 文档（含 Tailwind CDN、Chart.js、内联 JS）。
 * - 加载到 GrapesJS 前：剥离所有 <script>，提取 body 中的脚本单独保存，
 *   保留 <canvas> 元素（保持图表占位），收集 <head> 中的 <style> 块注入编辑器。
 * - 编辑器加载后：将脚本注入 canvas iframe，让 Chart.js 等正常渲染图表。
 * - 导出时：用原始 <head>（含 CDN scripts）+ 编辑后的 <body> + body 脚本重组。
 */
import { useRef, useEffect, useCallback, useState } from 'react';
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

const DEVICE_WIDTHS: Record<string, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

// ── HTML 预处理工具 ──

/**
 * 从完整 HTML 中提取编辑器所需信息。
 * 返回：bodyHTML（不含 script，保留 canvas）、headCss、headLinks、tailwindCdn、
 * bodyScripts（从 body 中剥离的内联脚本，用于编辑器加载后注入 iframe）
 */
function parseHtmlForEditor(
  fullHtml: string
): { bodyHtml: string; headCss: string; headLinks: string[]; tailwindCdn: string | null; fullHead: string; bodyScripts: string[] } {
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

  // ★ 提取 body 中的内联脚本（用于编辑器加载后注入 iframe，让 Chart.js 等正常工作）
  const bodyScripts: string[] = [];
  bodyHtml = bodyHtml.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (_, content) => {
    // 只保留有实际代码内容的内联脚本（跳过外部 src 引用）
    if (content.trim()) {
      bodyScripts.push(content.trim());
    }
    return '';
  });
  // 同时剥离带 src 的 script 标签
  bodyHtml = bodyHtml.replace(/<script[^>]*><\/script>/gi, '');

  // ★ 保留 canvas 元素（不再替换为占位 div），让图表区域有正确的布局
  // Chart.js CDN 在 editor load 后注入 iframe head，init 脚本注入 iframe body

  return { bodyHtml, headCss, headLinks, tailwindCdn, fullHead: headContent, bodyScripts };
}

/** 重组完整 HTML 文档：原始 head + 编辑后的 body + body 脚本 */
function reconstructFullHtml(originalHtml: string, editedBodyHtml: string, editorCss: string, bodyScripts: string[]): string {
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

  // ★ 重新注入 body 脚本（Chart.js init 等）
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

    editor.on('load', () => {
      // ★ 关键：将 CSS、字体、Tailwind、Chart.js 注入 canvas iframe 的 <head>
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

      // ★ 4) 注入 body 脚本（Chart.js init 等）到 iframe
      //     脚本中的 getElementById / querySelector 在 iframe document 上下文中运行，
      //     canvas 元素已在 setComponents 时加载，所以能正确找到。
      //     Chart.js CDN 需要先加载，延迟执行 init 脚本
      if (parsed.bodyScripts.length > 0) {
        // 检查 head 中是否有 Chart.js CDN，如果有也注入 iframe
        const chartJsMatch = parsed.fullHead.match(/<script[^>]*src="([^"]*chart[^"]*\.js[^"]*)"[^>]*>/i);
        if (chartJsMatch) {
          const chartScript = canvasDoc.createElement('script');
          chartScript.src = chartJsMatch[1];
          chartScript.onload = () => {
            // Chart.js 加载完成后注入 init 脚本
            for (const scriptContent of parsed.bodyScripts) {
              const s = canvasDoc.createElement('script');
              s.textContent = scriptContent;
              canvasDoc.body.appendChild(s);
            }
          };
          canvasHead.appendChild(chartScript);
        } else {
          // 没有 CDN 依赖，直接注入
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
    bodyScriptsRef.current = parsed.bodyScripts;
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

  // ── 样式/属性面板切换 ──
  const [activePanel, setActivePanel] = useState<'style' | 'attributes'>('style');
  const [selectedInfo, setSelectedInfo] = useState<string>('未选中元素');

  // ★ 选中的组件引用（用于属性面板编辑）
  const [selectedComp, setSelectedComp] = useState<any>(null);
  // ★ 属性面板的本地状态（与 GrapesJS 组件同步）
  const [attrState, setAttrState] = useState<Record<string, string>>({});
  // ★ 强制属性面板刷新的计数器
  const [attrVersion, setAttrVersion] = useState(0);

  // 选中元素时同步属性状态
  useEffect(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const onSelect = () => {
      const sel = editor.getSelected();
      if (sel) {
        const tag = sel.get('tagName') || 'div';
        const cls = (sel.get('classes') || []).map((c: { get: (k: string) => string }) => c.get('name')).filter(Boolean).slice(0, 2).join(' ');
        setSelectedInfo(`<${tag}>${cls ? ' .' + cls : ''}`);

        // ★ 同步属性到本地状态
        setSelectedComp(sel);
        const attrs = sel.getAttributes();
        const flat: Record<string, string> = {};
        for (const [k, v] of Object.entries(attrs)) {
          flat[k] = String(v ?? '');
        }
        setAttrState(flat);

        // 选中图片/链接时自动切到属性面板
        if (['img', 'a', 'video', 'iframe'].includes(String(tag).toLowerCase())) {
          setActivePanel('attributes');
        }
      } else {
        setSelectedInfo('未选中元素');
        setSelectedComp(null);
        setAttrState({});
      }
    };
    editor.on('component:selected', onSelect);
    editor.on('component:deselected', onSelect);
    return () => {
      editor.off('component:selected', onSelect);
      editor.off('component:deselected', onSelect);
    };
  }, []);

  // ★ 更新组件属性
  const updateAttribute = useCallback((key: string, value: string) => {
    if (!selectedComp) return;
    selectedComp.addAttributes({ [key]: value });
    setAttrState(prev => ({ ...prev, [key]: value }));
    setAttrVersion(v => v + 1);
  }, [selectedComp]);

  // ★ 文件上传 → base64 data URL
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedComp) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      selectedComp.addAttributes({ src: dataUrl });
      setAttrState(prev => ({ ...prev, src: dataUrl }));
      setAttrVersion(v => v + 1);
    };
    reader.readAsDataURL(file);
  }, [selectedComp]);

  const showPanel = useCallback((panel: 'style' | 'attributes') => {
    setActivePanel(panel);
    const smEl = document.querySelector('#gjs-sm');
    if (smEl) (smEl as HTMLElement).style.display = panel === 'style' ? 'block' : 'none';
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

        {/* 右侧面板：样式 + 属性（已移除图层） */}
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
                onClick={() => showPanel('style')}
                className={`flex-1 py-2 text-xs font-medium transition ${
                  activePanel === 'style' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-foreground-secondary hover:bg-surface-hover'
                }`}
              >
                🎨 样式
              </button>
              <button
                onClick={() => showPanel('attributes')}
                className={`flex-1 py-2 text-xs font-medium transition border-l border-border-default ${
                  activePanel === 'attributes' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-foreground-secondary hover:bg-surface-hover'
                }`}
              >
                ⚙️ 属性
              </button>
            </div>
            {/* 面板容器 */}
            <div className="flex-1 overflow-y-auto gjs-panel-scroll">
              {/* GrapesJS 样式面板（原生） */}
              <div id="gjs-sm" className="gjs-sm-container text-xs" style={{ display: activePanel === 'style' ? 'block' : 'none' }} />

              {/* ★ 自定义属性面板：图片 src / 链接 href 等 */}
              {activePanel === 'attributes' && (
                <div className="space-y-3 p-3 text-xs" key={attrVersion}>
                  {!selectedComp ? (
                    <div className="py-4 text-center text-foreground-muted">
                      请在画布中选中一个元素
                    </div>
                  ) : (() => {
                    const tag = String(selectedComp.get('tagName') || 'div').toLowerCase();
                    return (
                      <>
                        {/* 通用提示 */}
                        <div className="rounded-md bg-surface-hover/50 px-2.5 py-1.5 text-[11px] text-foreground-secondary">
                          当前元素：<span className="font-mono">&lt;{tag}&gt;</span>
                        </div>

                        {/* ── 图片专属属性 ── */}
                        {tag === 'img' && (
                          <>
                            {/* 图片预览 */}
                            <div className="overflow-hidden rounded-md border border-border-default bg-surface-subtle">
                              {attrState.src ? (
                                <img
                                  src={attrState.src}
                                  alt="预览"
                                  className="max-h-32 w-full object-contain"
                                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                                />
                              ) : (
                                <div className="flex h-24 items-center justify-center text-foreground-muted">无图片</div>
                              )}
                            </div>

                            {/* 上传本地图片 */}
                            <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-border-default px-3 py-2.5 text-foreground-secondary transition hover:border-accent-primary hover:text-accent-primary">
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 11V3.5L5 6.5l-1-1L8 1.5l4 4-1 1L9 3.5V11H8zm-5 2h10v2H3v-2z"/>
                              </svg>
                              上传本地图片
                              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            </label>

                            {/* src URL 输入框 */}
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-foreground-secondary">图片地址 (src)</label>
                              <input
                                type="text"
                                value={attrState.src || ''}
                                onChange={(e) => updateAttribute('src', e.target.value)}
                                placeholder="https://..."
                                className="w-full rounded-md border border-border-default bg-surface-primary px-2.5 py-1.5 text-[11px] text-foreground-primary focus:border-accent-primary focus:outline-none"
                              />
                            </div>

                            {/* alt 文本 */}
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-foreground-secondary">替代文本 (alt)</label>
                              <input
                                type="text"
                                value={attrState.alt || ''}
                                onChange={(e) => updateAttribute('alt', e.target.value)}
                                placeholder="图片描述"
                                className="w-full rounded-md border border-border-default bg-surface-primary px-2.5 py-1.5 text-[11px] text-foreground-primary focus:border-accent-primary focus:outline-none"
                              />
                            </div>

                            {/* 尺寸快捷设置 */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="mb-1 block text-[11px] font-medium text-foreground-secondary">宽度 (width)</label>
                                <input
                                  type="text"
                                  value={attrState.width || ''}
                                  onChange={(e) => updateAttribute('width', e.target.value)}
                                  placeholder="100%"
                                  className="w-full rounded-md border border-border-default bg-surface-primary px-2.5 py-1.5 text-[11px] text-foreground-primary focus:border-accent-primary focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-[11px] font-medium text-foreground-secondary">高度 (height)</label>
                                <input
                                  type="text"
                                  value={attrState.height || ''}
                                  onChange={(e) => updateAttribute('height', e.target.value)}
                                  placeholder="auto"
                                  className="w-full rounded-md border border-border-default bg-surface-primary px-2.5 py-1.5 text-[11px] text-foreground-primary focus:border-accent-primary focus:outline-none"
                                />
                              </div>
                            </div>
                          </>
                        )}

                        {/* ── 链接专属属性 ── */}
                        {tag === 'a' && (
                          <div>
                            <label className="mb-1 block text-[11px] font-medium text-foreground-secondary">链接地址 (href)</label>
                            <input
                              type="text"
                              value={attrState.href || ''}
                              onChange={(e) => updateAttribute('href', e.target.value)}
                              placeholder="https://..."
                              className="w-full rounded-md border border-border-default bg-surface-primary px-2.5 py-1.5 text-[11px] text-foreground-primary focus:border-accent-primary focus:outline-none"
                            />
                            <div className="mt-2 flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="target-blank"
                                checked={attrState.target === '_blank'}
                                onChange={(e) => updateAttribute('target', e.target.checked ? '_blank' : '')}
                                className="accent-accent-primary"
                              />
                              <label htmlFor="target-blank" className="text-[11px] text-foreground-secondary cursor-pointer">
                                在新标签页打开 (target="_blank")
                              </label>
                            </div>
                          </div>
                        )}

                        {/* ── 视频/iframe 专属属性 ── */}
                        {(tag === 'video' || tag === 'iframe') && (
                          <>
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-foreground-secondary">{tag === 'video' ? '视频地址 (src)' : '嵌入地址 (src)'}</label>
                              <input
                                type="text"
                                value={attrState.src || ''}
                                onChange={(e) => updateAttribute('src', e.target.value)}
                                placeholder="https://..."
                                className="w-full rounded-md border border-border-default bg-surface-primary px-2.5 py-1.5 text-[11px] text-foreground-primary focus:border-accent-primary focus:outline-none"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="mb-1 block text-[11px] font-medium text-foreground-secondary">宽度</label>
                                <input
                                  type="text"
                                  value={attrState.width || ''}
                                  onChange={(e) => updateAttribute('width', e.target.value)}
                                  placeholder="100%"
                                  className="w-full rounded-md border border-border-default bg-surface-primary px-2.5 py-1.5 text-[11px] text-foreground-primary focus:border-accent-primary focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-[11px] font-medium text-foreground-secondary">高度</label>
                                <input
                                  type="text"
                                  value={attrState.height || ''}
                                  onChange={(e) => updateAttribute('height', e.target.value)}
                                  placeholder="auto"
                                  className="w-full rounded-md border border-border-default bg-surface-primary px-2.5 py-1.5 text-[11px] text-foreground-primary focus:border-accent-primary focus:outline-none"
                                />
                              </div>
                            </div>
                          </>
                        )}

                        {/* ── 通用 class 属性（所有元素）── */}
                        <div className="border-t border-border-subtle pt-2">
                          <label className="mb-1 block text-[11px] font-medium text-foreground-secondary">CSS 类名 (class)</label>
                          <input
                            type="text"
                            value={attrState.class || ''}
                            onChange={(e) => updateAttribute('class', e.target.value)}
                            placeholder="class-name"
                            className="w-full rounded-md border border-border-default bg-surface-primary px-2.5 py-1.5 text-[11px] text-foreground-primary focus:border-accent-primary focus:outline-none"
                          />
                        </div>

                        {/* ── 通用 id 属性 ── */}
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-foreground-secondary">ID</label>
                          <input
                            type="text"
                            value={attrState.id || ''}
                            onChange={(e) => updateAttribute('id', e.target.value)}
                            placeholder="element-id"
                            className="w-full rounded-md border border-border-default bg-surface-primary px-2.5 py-1.5 text-[11px] text-foreground-primary focus:border-accent-primary focus:outline-none"
                          />
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}