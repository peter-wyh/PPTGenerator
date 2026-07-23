import { useRef, useState, useEffect } from 'react';
import { projectsApi } from '../../api/projects';
import { useEditorStore } from '../store';

/**
 * 导出下拉菜单（M6）：导出 PDF / 导出图片 / 复制分享链接。
 */
export function ExportMenu() {
  const projectId = useEditorStore((s) => s.projectId);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<null | 'pdf' | 'images' | 'share'>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  async function handlePdf() {
    if (!projectId || busy) return;
    setBusy('pdf');
    setFeedback(null);
    try {
      const blob = await projectsApi.exportPdf(projectId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'project.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch {
      setFeedback({ ok: false, text: 'PDF 导出失败，请稍后重试' });
    } finally {
      setBusy(null);
    }
  }

  async function handleImages() {
    if (!projectId || busy) return;
    setBusy('images');
    setFeedback(null);
    try {
      const blob = await projectsApi.exportImages(projectId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'slides.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch {
      setFeedback({ ok: false, text: '图片导出失败，请稍后重试' });
    } finally {
      setBusy(null);
    }
  }

  async function handleShare() {
    if (!projectId || busy) return;
    setBusy('share');
    setFeedback(null);
    try {
      const token = await projectsApi.createShare(projectId);
      const link = `${window.location.origin}/share/${token}`;
      try {
        await navigator.clipboard.writeText(link);
        setFeedback({ ok: true, text: '分享链接已复制' });
      } catch {
        setFeedback({ ok: true, text: link });
      }
    } catch {
      setFeedback({ ok: false, text: '生成分享链接失败' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded px-2 py-1 text-sm text-foreground-secondary hover:bg-surface-hover"
        title="导出 / 分享"
      >
        导出
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-md border border-border-default bg-surface-primary py-1 shadow-lg">
          <button
            onClick={handlePdf}
            disabled={busy !== null}
            className="block w-full px-3 py-1.5 text-left text-sm text-foreground-primary hover:bg-surface-hover disabled:opacity-50"
          >
            {busy === 'pdf' ? '导出中…' : '导出 PDF'}
          </button>
          <button
            onClick={handleImages}
            disabled={busy !== null}
            className="block w-full px-3 py-1.5 text-left text-sm text-foreground-primary hover:bg-surface-hover disabled:opacity-50"
          >
            {busy === 'images' ? '导出中…' : '导出图片 (PNG)'}
          </button>
          <hr className="my-1 border-border-default" />
          <button
            onClick={handleShare}
            disabled={busy !== null}
            className="block w-full px-3 py-1.5 text-left text-sm text-foreground-primary hover:bg-surface-hover disabled:opacity-50"
          >
            {busy === 'share' ? '生成中…' : '复制分享链接'}
          </button>
          {feedback && (
            <div
              className={`mx-2 mt-1 break-all rounded px-2 py-1 text-xs ${
                feedback.ok ? 'bg-[color-mix(in_srgb,var(--green)_12%,transparent)] text-[var(--green)]' : 'bg-[color-mix(in_srgb,var(--red)_12%,transparent)] text-[var(--red)]'
              }`}
            >
              {feedback.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
