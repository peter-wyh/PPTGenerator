import { useState, useRef, useCallback } from 'react';
import { useEditorStore } from './store';
import { PageThumbnail } from './components/PageThumbnail';
import { TemplateOverlay } from './components/TemplateOverlay';
import { ScenarioOverlay } from './components/ScenarioOverlay';
import { SaveAsTemplateOverlay } from './components/SaveAsTemplateOverlay';
import { resolveTemplateForBusinessLine, type Template } from './templates';
import { pageCategory } from '@mediakit/shared';
import { toast } from '../components/Toast';

/** 页面类型 → 侧栏图标映射（27 种，与模板 1:1）。 */
const PAGE_TYPE_ICONS: Record<string, string> = {
  // 基础
  blank: '📄',
  title: '🏷️',
  overview: '📊',
  table: '📋',
  // 投放报告
  'report-weekly-overview': '📈',
  'report-monthly-overview': '📈',
  'report-channel': '📡',
  'report-product': '🛍️',
  'report-creator-collab': '🤝',
  'report-placement': '🖼️',
  'report-posts': '📝',
  'report-wrapup-review': '🔎',
  'content-analysis': '📊',
  funnel: '🔻',
  // 公司 · 品牌
  cover: '🎨',
  agenda: '📑',
  company: '🏢',
  package: '📦',
  milestone: '🏗️',
  global: '🌐',
  org: '👥',
  service: '⚙️',
  // 达人 · 案例
  creator: '🌟',
  case: '📋',
  // 策略 · 内容
  challenge: '⚖️',
  process: '🔄',
  calendar: '📅',
  'campaign-plan': '🗺️',
  // 媒介包
  'audience-portrait': '👥',
  'account-overview': '📊',
  'brand-collab': '🏷️',
};

/** 页面栏：缩略图卡片 + 切换/改名/复制/删除 + 拖拽排序 + 模板新建。 */
export function PageSidebar() {
  const pages = useEditorStore((s) => s.pages);
  const currentPageId = useEditorStore((s) => s.currentPageId);
  const canvasWidth = useEditorStore((s) => s.canvasWidth);
  const canvasHeight = useEditorStore((s) => s.canvasHeight);
  const setPage = useEditorStore((s) => s.setPage);
  const deletePage = useEditorStore((s) => s.deletePage);
  const copyPage = useEditorStore((s) => s.copyPage);
  const renamePage = useEditorStore((s) => s.renamePage);
  const reorderPage = useEditorStore((s) => s.reorderPage);
  const isSinglePage = useEditorStore((s) => s.projectMeta?.styleType === 'single');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showScenarios, setShowScenarios] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // 存为模板
  const [saveTplPage, setSaveTplPage] = useState<{ id: string; name: string } | null>(null);

  // 删除确认：两击模式。第一次点击进入"确认删除?"态，3s 内再次点击才真删。
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDeleteClick = useCallback(
    (pageId: string) => {
      if (confirmDeleteId === pageId) {
        // 第二次点击 → 确认删除
        if (deleteTimer.current) clearTimeout(deleteTimer.current);
        setConfirmDeleteId(null);
        deletePage(pageId);
        toast.success('页面已删除');
      } else {
        // 第一次点击 → 进入确认态，3s 后自动复位
        if (deleteTimer.current) clearTimeout(deleteTimer.current);
        setConfirmDeleteId(pageId);
        deleteTimer.current = setTimeout(() => setConfirmDeleteId(null), 3000);
      }
    },
    [confirmDeleteId, deletePage],
  );

  function applyTemplate(tpl: Template) {
    if (tpl.id === 'blank') {
      useEditorStore.getState().addPage();
    } else {
      // 按当前项目业务线解析：存在同 pageType 的业务线变体则套变体（FT/SM/CX… 风格），否则回退通用。
      // 页面名仍取通用模板的描述性名称（如「月报 · 达人合作详情」），仅组件布局/变体走业务线。
      const bl = useEditorStore.getState().projectMeta?.businessLine;
      const resolved = resolveTemplateForBusinessLine(tpl, bl);
      // 单页超长模板：自动调整画板高度以容纳所有组件（仅单页面模式，不影响多页 PPT）
      if (resolved.canvasHeight && useEditorStore.getState().projectMeta?.styleType === 'single') {
        const cur = useEditorStore.getState().canvasHeight;
        if (resolved.canvasHeight > cur) {
          useEditorStore.setState({ canvasHeight: resolved.canvasHeight });
        }
      }
      useEditorStore
        .getState()
        .addPageWithComponents(
          tpl.name,
          resolved.components(),
          {
            ...(resolved.pageTitleIndex != null ? { titleComponentIndex: resolved.pageTitleIndex } : {}),
            ...(resolved.pageType ? { pageType: resolved.pageType } : {}),
          },
        );
    }
    setShowTemplates(false);
  }

  function onDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    reorderPage(dragIndex, targetIndex);
    setDragIndex(null);
  }

  return (
    <div className="flex w-[220px] flex-col border-r border-border-default bg-surface-primary">
      <div className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">
        页面 ({pages.length})
      </div>
      <div className="flex-1 space-y-2 overflow-auto px-2 pb-2">
        {pages.map((p, i) => (
          <div
            key={p.id}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(i)}
            onClick={() => setPage(p.id)}
            className={`group cursor-pointer rounded-lg border p-2 transition ${
              p.id === currentPageId
                ? 'border-accent-primary bg-accent-primary/5'
                : 'border-border-default hover:bg-surface-hover'
            } ${dragIndex === i ? 'opacity-40' : ''}`}
          >
            <div className="mb-1 flex items-center justify-between">
              {editingId === p.id ? (
                <input
                  autoFocus
                  value={draft}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => {
                    renamePage(p.id, draft);
                    setEditingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      renamePage(p.id, draft);
                      setEditingId(null);
                    }
                  }}
                  className="w-full rounded border border-border-default px-1 py-0.5 text-xs"
                />
              ) : (
                <span
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingId(p.id);
                    setDraft(p.name);
                  }}
                  className="truncate text-xs font-medium text-foreground-primary"
                >
                  {i + 1}. {PAGE_TYPE_ICONS[p.pageType ?? ''] ?? ''} {p.name}
                </span>
              )}
              <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  title="切换页面类型"
                  onClick={(e) => {
                    e.stopPropagation();
                    useEditorStore
                      .getState()
                      .setPageType(p.id, pageCategory(p.pageType) === 'media-report' ? undefined : 'cover');
                  }}
                  className="rounded px-1 py-0.5 text-xs hover:bg-surface-hover"
                >
                  {pageCategory(p.pageType) === 'media-report' ? '🔹' : '⚪'}
                </button>
                <button
                  title="复制页面"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyPage(p.id);
                  }}
                  className="text-foreground-muted hover:text-foreground-primary"
                >
                  📋
                </button>
                <button
                  title="存为模板"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSaveTplPage({ id: p.id, name: p.name });
                  }}
                  className="text-foreground-muted hover:text-foreground-primary"
                >
                  💾
                </button>
                {pages.length > 1 && (
                  <button
                    title={confirmDeleteId === p.id ? '再次点击确认删除' : '删除页面'}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(p.id);
                    }}
                    className={`whitespace-nowrap rounded px-1 py-0.5 text-xs ${
                      confirmDeleteId === p.id
                        ? 'bg-red/15 text-red'
                        : 'text-foreground-muted hover:text-red'
                    }`}
                  >
                    {confirmDeleteId === p.id ? '确认删除?' : '✕'}
                  </button>
                )}
              </div>
            </div>
            <PageThumbnail page={p} canvasWidth={canvasWidth} canvasHeight={canvasHeight} />
          </div>
        ))}
      </div>
      <div className="flex gap-2 p-2">
        {isSinglePage ? (
          <div className="flex-1 rounded-lg bg-surface-hover px-2 py-1.5 text-center text-xs text-foreground-muted">
            单页面模式
          </div>
        ) : (
          <>
            <button
              onClick={() => setShowScenarios(true)}
              className="flex-1 rounded-lg border border-accent-primary/40 bg-accent-primary/5 px-2 py-1.5 text-sm text-accent-primary hover:bg-accent-primary/10"
            >
              + 报告
            </button>
            <button
              onClick={() => setShowTemplates(true)}
              className="flex-1 rounded-lg border border-dashed border-border-default px-2 py-1.5 text-sm text-foreground-secondary hover:bg-surface-hover"
            >
              + 页面
            </button>
          </>
        )}
      </div>
      {showTemplates && (
        <TemplateOverlay onApply={applyTemplate} onClose={() => setShowTemplates(false)} />
      )}
      {showScenarios && <ScenarioOverlay onClose={() => setShowScenarios(false)} />}
      {saveTplPage && (
        <SaveAsTemplateOverlay
          open={!!saveTplPage}
          projectId={useEditorStore.getState().projectId ?? ''}
          pageId={saveTplPage.id}
          pageName={saveTplPage.name}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          projectMeta={useEditorStore.getState().projectMeta}
          onClose={() => setSaveTplPage(null)}
        />
      )}
    </div>
  );
}
