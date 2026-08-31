import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getSharedProject } from '../api/projects';
import { useEditorStore } from '../editor/store';
import { PageView, fitScale } from '../editor/preview/PageView';
import { themeToCssVars, injectFontLinks } from '../editor/theme';
import { bootstrapCustomFonts } from '../editor/customFonts';
import { DEFAULT_THEME } from '@mediakit/shared';
import type { ProjectDetail } from '@mediakit/shared';

/**
 * 公开分享页（M6）：匿名只读访问 /share/:token。
 * 不在 ProtectedLayout 内（无需登录）。复用 PageView 渲染。
 * ?print=1 模式：隐藏 chrome，连续渲染所有页（page-break），供 PDF 导出。
 */
export function SharePage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const isPrint = searchParams.get('print') === '1';

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);

  const pages = useEditorStore((s) => s.pages);
  const canvasWidth = useEditorStore((s) => s.canvasWidth) || 1280;
  const canvasHeight = useEditorStore((s) => s.canvasHeight) || 720;

  // 报告主题（品牌色 / 字体）：分享页 / PDF 导出同样按项目主题渲染。
  // themeStyle 挂在内容根节点 → CSS 变量级联到 PageView 组件；字体按需注入 <head>。
  const theme = useEditorStore((s) => s.projectMeta?.theme ?? DEFAULT_THEME);
  const themeStyle = useMemo<CSSProperties>(() => themeToCssVars(theme), [theme]);
  // 玻璃模式类：门控 .skin-card border-image（见 index.css .glass-mode）。
  const glassOn = theme.glass === true;
  useEffect(() => {
    injectFontLinks(theme);
  }, [theme]);

  // 分享页 / PDF 导出也尝试加载自定义字体（匿名时 /fonts 鉴权失败会静默跳过）。
  useEffect(() => {
    void bootstrapCustomFonts();
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getSharedProject(token)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        useEditorStore.getState().loadProject(d, d.name);
      })
      .catch(() => {
        if (!cancelled) setError('分享链接无效或已失效');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center text-neutral-600">{error}</div>
    );
  }
  if (!detail) {
    return <div className="flex h-screen items-center justify-center text-neutral-500">加载中…</div>;
  }

  // 打印模式：连续渲染所有页（每页 page-break），供 puppeteer 截 PDF。
  if (isPrint) {
    return (
      <div className={glassOn ? 'glass-mode' : undefined} style={themeStyle}>
        {pages.map((page, i) => (
          <div
            key={page.id}
            data-page
            style={{
              width: canvasWidth,
              height: canvasHeight,
              pageBreakAfter: 'always',
              position: 'relative',
              background: 'var(--surface-primary)',
            }}
          >
            <PageView page={page} canvasWidth={canvasWidth} canvasHeight={canvasHeight} scale={1} />
            {i < pages.length - 1 && <div style={{ breakAfter: 'page' }} />}
          </div>
        ))}
      </div>
    );
  }

  const page = pages[pageIndex];

  // fitScale 需要根据视口实时重算：监听 resize 并 debounce 存入 state。
  const [scale, setScale] = useState(() => {
    const viewportW = Math.min(window.innerWidth - 80, 1280);
    const viewportH = Math.min(window.innerHeight - 140, 720);
    return fitScale(canvasWidth, canvasHeight, viewportW, viewportH);
  });

  useEffect(() => {
    const recalc = () => {
      const viewportW = Math.min(window.innerWidth - 80, 1280);
      const viewportH = Math.min(window.innerHeight - 140, 720);
      setScale(fitScale(canvasWidth, canvasHeight, viewportW, viewportH));
    };
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(recalc, 150); // debounce：避免拖拽 resize 时频繁重算
    };
    window.addEventListener('resize', onResize);
    recalc(); // canvas 尺寸变化时也立即重算
    return () => {
      window.removeEventListener('resize', onResize);
      if (timer) clearTimeout(timer);
    };
  }, [canvasWidth, canvasHeight]);

  return (
    <div className={`flex h-screen flex-col bg-neutral-900${glassOn ? ' glass-mode' : ''}`} style={themeStyle}>
      <div className="flex h-12 items-center justify-between px-4 text-white">
        <span className="text-sm font-medium">{detail.name}</span>
        <span className="text-xs text-white/50">只读分享</span>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-hidden px-4">
        {page ? (
          <div className="rounded-lg bg-white shadow-2xl" style={{ width: canvasWidth * scale, height: canvasHeight * scale }}>
            <PageView page={page} canvasWidth={canvasWidth} canvasHeight={canvasHeight} scale={scale} />
          </div>
        ) : (
          <div className="text-white/60">无页面</div>
        )}
      </div>
      <div className="flex h-14 items-center justify-center gap-6">
        <button
          onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
          disabled={pageIndex <= 0}
          className="rounded px-4 py-1.5 text-white/80 hover:bg-white/10 disabled:opacity-30"
        >
          ←
        </button>
        <span className="text-sm text-white/70">
          第 {pages.length > 0 ? pageIndex + 1 : 0} 页 / 共 {pages.length} 页
        </span>
        <button
          onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
          disabled={pageIndex >= pages.length - 1}
          className="rounded px-4 py-1.5 text-white/80 hover:bg-white/10 disabled:opacity-30"
        >
          →
        </button>
      </div>
    </div>
  );
}
