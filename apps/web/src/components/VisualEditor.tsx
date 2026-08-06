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

function parseHtmlForEditor(
  fullHtml: string
): { bodyHtml: string; headCss: string; headLinks: string[]; tailwindCdn: string | null; fullHead: string; bodyScripts: string[] } {
  const headMatch = fullHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headContent = headMatch ? headMatch[1] : '';

  const styleBlocks = headContent.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
  const headCss = styleBlocks.map(s => s.replace(/<\/?style[^>]*>/gi, '')).join('\n');

  const linkTags = headContent.match(/<link[^>]*>/gi) || [];
  const headLinks = linkTags.filter(l =>
    /stylesheet/i.test(l) || /fonts\.googleapis/i.test(l) || /font-awesome/i.test(l) || /preconnect/i.test(l)
  );

  const twMatch = headContent.match(/<script[^>]*src="(https:\/\/cdn\.tailwindcss\.com[^"]*)"/i);
  const tailwindCdn = twMatch ? twMatch[1] : null;

  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let bodyHtml = bodyMatch ? bodyMatch[1] : fullHtml;

  // 提取 body 内联脚本
  const bodyScripts: string[] = [];
  bodyHtml = bodyHtml.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (_, content) => {
    if (content.trim()) bodyScripts.push(content.trim());
    return '';
  });
  bodyHtml = bodyHtml.replace(/<script[^>]*><\/script>/gi, '');

  return { bodyHtml, headCss, headLinks, tailwindCdn, fullHead: headContent, bodyScripts };
}

function reconstructFullHtml(originalHtml: string, editedBodyHtml: string, editorCss: string, bodyScripts: string[]): string {
  const headMatch = originalHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headContent = headMatch ? headMatch[1] : '';

  const htmlTagMatch = originalHtml.match(/<html([^>]*)>/i);
  const htmlAttrs = htmlTagMatch ? htmlTagMatch[1] : ' lang="en"';

  const bodyTagMatch = originalHtml.match(/<body([^>]*)>/i);
  const bodyAttrs = bodyTagMatch ? bodyTagMatch[1] : '';

  const cleanBody = editedBodyHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

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

  // ★ 选中图片时的状态：null = 未选中图片，object = 选中了 img 组件
  const [selectedImg, setSelectedImg] = useState<{ comp: any; src: string; alt: string } | null>(null);

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

    // ★ 关键：在 setComponents 之前注册，确保所有组件（含 td/th/p/div/span）
    //   都标记为 editable，这样双击才能进入 RTE 内联编辑
    editor.on('component:create', (model: any) => {
      if (!model?.set) return;
      const type = model.get('type');
      if (type === 'textnode' || type === 'text') return; // 已默认可编辑
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

    // 选中元素信息 + 图片状态同步
    const onSelect = () => {
      const sel = editor.getSelected();
      if (sel) {
        const tag = String(sel.get('tagName') || 'div').toLowerCase();
        const cls = (sel.get('classes') || []).map((c: { get: (k: string) => string }) => c.get('name')).filter(Boolean).slice(0, 2).join(' ');
        setSelectedInfo(`<${tag}>${cls ? ' .' + cls : ''}`);

        // ★ 选中图片时同步 src/alt 到状态
        if (tag === 'img') {
          const attrs = sel.getAttributes();
          setSelectedImg({
            comp: sel,
            src: String(attrs.src || ''),
            alt: String(attrs.alt || ''),
          });
        } else {
          setSelectedImg(null);
        }
      } else {
        setSelectedInfo('未选中元素');
        setSelectedImg(null);
      }
    };
    editor.on('component:selected', onSelect);
    editor.on('component:deselected', onSelect);

    editor.on('load', () => {
      const canvasDoc = editor.Canvas.getDocument();
      const canvasHead = canvasDoc.head;

      // 1) 注入 <style> 块
      if (parsed.headCss) {
        const styleEl = canvasDoc.createElement('style');
        styleEl.textContent = parsed.headCss;
        canvasHead.appendChild(styleEl);
      }

      // 2) 注入 Tailwind CDN
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
    if (parsed.headCss && canvasDoc.head) {
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
