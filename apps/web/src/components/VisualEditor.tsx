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

/** 从完整 HTML 文档中提取 <body> 内部 HTML，剥离所有 <script> 标签 */
function extractBodyForEditor(fullHtml: string): { bodyContent: string; headScripts: string; headMeta: string } {
  // 提取 <head> 内容
  const headMatch = fullHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headContent = headMatch ? headMatch[1] : '';

  // 分离 <style> 和其他 head 内容
  const styleBlocks: string[] = [];
  const otherHead: string[] = [];
  const headLines = headContent.split(/(?=<(?:style|link|script|meta)[^>]*>)/i);

  for (const segment of headLines) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    // 保留 <style> 块（编辑器中需要看到样式）
    if (/^<style/i.test(trimmed)) {
      styleBlocks.push(trimmed);
    }
    // 保留 <link rel="stylesheet">（字体等）
    else if (/^<link[^>]*stylesheet/i.test(trimmed)) {
      otherHead.push(trimmed);
    }
    // 保留 <meta> 标签
    else if (/^<meta/i.test(trimmed)) {
      otherHead.push(trimmed);
    }
    // 跳过 <script> 标签（编辑器中不执行）
  }

  // 提取 <body> 内容
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let bodyContent = bodyMatch ? bodyMatch[1] : fullHtml;

  // 从 body 中剥离 <script> 标签
  bodyContent = bodyContent.replace(/<script[\s\S]*?<\/script>/gi, '');

  // 从 body 中剥离 <canvas>（Chart.js 渲染目标，在编辑器中无意义）
  bodyContent = bodyContent.replace(/<canvas[^>]*><\/canvas>/gi, '<div class="chart-placeholder" style="background:#f3f4f6;border-radius:8px;min-height:200px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px;">📊 图表区域（导出后自动渲染）</div>');

  // 注入 head 中的 style 到 body 开头（GrapesJS 只渲染 body）
  const injectedStyles = styleBlocks.length > 0
    ? styleBlocks.join('\n')
    : '';

  return {
    bodyContent: injectedStyles + bodyContent,
    headScripts: headContent.match(/<script[\s\S]*?<\/script>/gi)?.join('\n') || '',
    headMeta: otherHead.join('\n'),
  };
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
    const { bodyContent } = extractBodyForEditor(html);

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
            name: '尺寸',
            open: true,
            buildProps: ['width', 'min-width', 'max-width', 'height', 'min-height', 'max-height'],
          },
          {
            name: '间距',
            open: false,
            buildProps: ['margin', 'padding'],
          },
          {
            name: '排版',
            open: false,
            buildProps: [
              'font-family', 'font-size', 'font-weight', 'font-style',
              'text-align', 'text-decoration', 'color', 'line-height',
              'letter-spacing',
            ],
          },
          {
            name: '背景',
            open: false,
            buildProps: ['background-color', 'background-image', 'background-repeat', 'background-position', 'background-size'],
          },
          {
            name: '边框',
            open: false,
            buildProps: ['border', 'border-radius', 'border-color', 'border-style', 'border-width'],
          },
          {
            name: '效果',
            open: false,
            buildProps: ['opacity', 'box-shadow', 'display', 'flex-direction', 'justify-content', 'align-items', 'gap'],
          },
          {
            name: '定位',
            open: false,
            buildProps: ['position', 'top', 'right', 'bottom', 'left', 'z-index'],
          },
        ],
      },
      layerManager: {
        appendTo: '#gjs-layers',
      },
    });

    editorRef.current = editor;

    // 加载预处理后的 body 内容
    editor.setComponents(bodyContent);
    lastLoadedBodyRef.current = bodyContent;

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
      updateUndoRedo();
      setIsLoading(false);
      // 渲染样式面板
      const smContainer = document.querySelector('#gjs-sm');
      if (smContainer && editor.StyleManager) {
        editor.StyleManager.render();
      }
      // 渲染图层面板
      const layersContainer = document.querySelector('#gjs-layers');
      if (layersContainer && editor.Layers) {
        editor.runCommand('open-layers');
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

    const { bodyContent } = extractBodyForEditor(html);
    // 避免自身 onChange 触发的循环
    if (bodyContent === lastLoadedBodyRef.current) return;

    originalHtmlRef.current = html;
    const editor = editorRef.current;
    editor.setComponents(bodyContent);
    lastLoadedBodyRef.current = bodyContent;
    editor.UndoManager.clear();
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
  const showPanel = useCallback((panel: 'layers' | 'style') => {
    setActivePanel(panel);
    const layersEl = document.querySelector('#gjs-layers');
    const smEl = document.querySelector('#gjs-sm');
    if (layersEl) (layersEl as HTMLElement).style.display = panel === 'layers' ? 'block' : 'none';
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

        {/* 右侧面板：图层 + 样式 */}
        {!previewMode && (
          <div className="flex w-[300px] shrink-0 flex-col border-l border-border-default bg-surface-primary">
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
            <div className="flex-1 overflow-y-auto">
              <div id="gjs-layers" className="gjs-layers-container text-xs" style={{ display: activePanel === 'layers' ? 'block' : 'none' }} />
              <div id="gjs-sm" className="gjs-sm-container text-xs" style={{ display: activePanel === 'style' ? 'block' : 'none' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
