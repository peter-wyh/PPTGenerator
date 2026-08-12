/**
 * TemplateHtmlStudio — HTML 报告模板编辑器。
 * 路由：/templates/:id/html-studio
 *
 * 与 HtmlStudio 类似，但操作对象是 Template 而非 Project。
 * 加载模板 htmlContent → GrapesJS 可视化编辑 → 保存回 Template.htmlContent。
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { templatesApi } from '@/api/templates';
import { Button } from '@/components/Button';
import { VisualEditor } from '@/components/VisualEditor';
import type { TemplateDetail } from '@mediaket/shared';

export function TemplateHtmlStudio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState('');
  const [saved, setSaved] = useState(true);
  const [viewMode, setViewMode] = useState<'visual' | 'preview' | 'source'>('visual');
  const [copied, setCopied] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    templatesApi
      .get(id)
      .then((t) => {
        setTemplate(t);
        setHtml(t.htmlContent ?? '');
        setLoading(false);
      })
      .catch(() => {
        setError('模板加载失败或不存在');
        setLoading(false);
      });
  }, [id]);

  // 自动保存（防抖）
  const handleHtmlChange = useCallback(
    (newHtml: string) => {
      setHtml(newHtml);
      setSaved(false);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        if (id && template) {
          templatesApi
            .update(id, { htmlContent: newHtml })
            .then(() => setSaved(true))
            .catch(() => {});
        }
      }, 1500);
    },
    [id, template],
  );

  const handleManualSave = useCallback(() => {
    if (!id || !template) return;
    templatesApi
      .update(id, { htmlContent: html })
      .then(() => {
        setSaved(true);
      })
      .catch(() => {});
  }, [id, template, html]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [html]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template?.name || 'template'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [html, template]);

  // 清理
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-sm text-foreground-muted">加载中…</div>
      </div>
    );
  }
  if (error || !template) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-red">{error || '模板不存在'}</p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => navigate('/templates')}
          >
            返回模板列表
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface-subtle">
      {/* Top Bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border-default bg-surface-primary px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/templates')}
            className="text-sm text-foreground-muted transition hover:text-foreground-primary"
          >
            ← 返回
          </button>
          <span className="h-4 w-px bg-border-default" />
          <h1 className="text-sm font-medium text-foreground-primary">
            ⚡ HTML 模板编辑
          </h1>
          <span className="text-xs text-foreground-muted">· {template.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {saved ? (
            <span className="flex items-center gap-1 text-xs text-green">
              <span className="h-1.5 w-1.5 rounded-full bg-green" /> 已保存
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-foreground-muted">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
              保存中…
            </span>
          )}
          <Button variant="ghost" onClick={handleCopy} className="px-2 py-1 text-xs">
            {copied ? '✓ 已复制' : '📋 复制'}
          </Button>
          <Button variant="ghost" onClick={handleDownload} className="px-2 py-1 text-xs">
            💾 下载
          </Button>
          <Button onClick={handleManualSave} className="px-3 py-1 text-xs">
            💾 保存
          </Button>
        </div>
      </header>

      {/* View Mode Tabs */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border-default bg-surface-primary px-4">
        <div className="flex rounded-md border border-border-default">
          <button
            onClick={() => setViewMode('visual')}
            className={`rounded-l-md px-3 py-1.5 text-xs transition ${
              viewMode === 'visual'
                ? 'bg-accent-primary text-foreground-inverse'
                : 'text-foreground-secondary hover:bg-surface-hover'
            }`}
          >
            ✏️ 可视化编辑
          </button>
          <button
            onClick={() => setViewMode('preview')}
            className={`border-l border-border-default px-3 py-1.5 text-xs transition ${
              viewMode === 'preview'
                ? 'bg-accent-primary text-foreground-inverse'
                : 'text-foreground-secondary hover:bg-surface-hover'
            }`}
          >
            👁️ 预览
          </button>
          <button
            onClick={() => setViewMode('source')}
            className={`rounded-r-md border-l border-border-default px-3 py-1.5 text-xs transition ${
              viewMode === 'source'
                ? 'bg-accent-primary text-foreground-inverse'
                : 'text-foreground-secondary hover:bg-surface-hover'
            }`}
          >
            {'</>'} 源码
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {html ? (
          viewMode === 'visual' ? (
            <VisualEditor
              key="template-visual"
              html={html}
              onHtmlChange={handleHtmlChange}
            />
          ) : viewMode === 'source' ? (
            <textarea
              value={html}
              onChange={(e) => handleHtmlChange(e.target.value)}
              className="flex-1 resize-none bg-surface-secondary p-4 font-mono text-[11px] leading-relaxed text-foreground-primary focus:outline-none"
              spellCheck={false}
            />
          ) : (
            <div className="flex flex-1 items-start justify-center overflow-auto p-4">
              <iframe
                srcDoc={html}
                title="Template Preview"
                className="h-full w-full bg-white shadow-lg"
                style={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                sandbox="allow-same-origin allow-scripts"
              />
            </div>
          )
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mb-3 text-6xl opacity-20">📄</div>
              <p className="text-sm text-foreground-muted">
                此模板还没有 HTML 内容
              </p>
              <p className="mt-1 text-xs text-foreground-muted">
                切换到「源码」模式粘贴 HTML，或从已有报告「存为模板」
              </p>
              <button
                onClick={() => setViewMode('source')}
                className="mt-4 rounded-md bg-accent-primary px-4 py-2 text-xs text-foreground-inverse hover:bg-accent-secondary"
              >
                切换到源码模式
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
