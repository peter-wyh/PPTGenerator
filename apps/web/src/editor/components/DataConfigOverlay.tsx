import { useEffect, useState } from 'react';
import type { ReportCreator, ReportDataContext } from '@mediaket/shared';
import { useEditorStore } from '../store';
import { listCampaignCreators, fetchCampaignCreatorWorks, type Creator } from '../../api/creators';
import type { CreatorWorkPost } from '../../api/mock/creatorPerformance';

/** 达人作品集合（fetchCampaignCreatorWorks 返回类型）。 */
type CreatorWorks = { creatorId: string; creatorName: string; platform: string; tier: string; posts: CreatorWorkPost[] };

interface Props {
  onClose: () => void;
}

/**
 * 数据配置浮层（纯显隐模式）：
 *
 * 数据来源完全取自数据库——不再支持手动配置/编辑 KPI。
 * 用户唯一可操作：勾选达人显/隐。
 *
 * 数据链路：
 * 1. 从 projectMeta.campaignId 读取绑定的 Campaign ID
 * 2. 从 DB 加载该 Campaign 下所有达人 + 作品数据
 * 3. 默认全选（全部可见），用户可取消勾选
 * 4. 勾选状态写入 store.reportData.campaignCreators（供编辑器各组件取数）
 */
export function DataConfigOverlay({ onClose }: Props) {
  const setReportData = useEditorStore((s) => s.setReportData);
  const reportData = useEditorStore((s) => s.reportData);
  const projectIdCampaign = useEditorStore((s) => s.projectMeta?.campaignId);
  const campaignName = useEditorStore((s) => s.reportData?.campaign?.name);

  // DB 数据：Campaign 下全部达人 + 作品
  const [allCreators, setAllCreators] = useState<Creator[] | null>(null);
  const [allWorks, setAllWorks] = useState<CreatorWorks[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // 显隐集合（隐藏的达人 ID；默认空 = 全部可见）
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => {
    const existing = reportData.campaignCreators ?? [];
    const all = useEditorStore.getState().reportData;
    // 已有的 campaignCreators id 集合
    const existingIds = new Set(existing.map((c) => c.id));
    void all;
    return existingIds; // 暂存，加载后对比决定
  });

  const campaignId = projectIdCampaign ?? '';

  useEffect(() => {
    if (!campaignId) {
      setAllCreators(null);
      setAllWorks(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setFailed(false);
    setAllCreators(null);
    setAllWorks(null);
    Promise.all([
      listCampaignCreators(campaignId),
      fetchCampaignCreatorWorks(campaignId),
    ])
      .then(([list, works]) => {
        if (!alive) return;
        setAllCreators(list);
        setAllWorks(works);

        // 首次打开：默认全选
        const existing = useEditorStore.getState().reportData.campaignCreators;
        if (!existing || existing.length === 0) {
          syncToStore(list, new Set()); // 全选
          setHiddenIds(new Set());
        } else {
          // 从已有 reportData 反推隐藏列表
          const existingIds = new Set(existing.map((c) => c.id));
          const hidden = new Set<string>();
          for (const c of list) {
            if (!existingIds.has(c.id)) hidden.add(c.id);
          }
          setHiddenIds(hidden);
        }
      })
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [campaignId]);

  /** 切换达人显隐，实时同步到 store。 */
  function toggleCreator(c: Creator) {
    const next = new Set(hiddenIds);
    if (next.has(c.id)) next.delete(c.id);
    else next.add(c.id);
    setHiddenIds(next);
    if (allCreators) syncToStore(allCreators, next);
  }

  /** 将可见达人列表写入 store.reportData.campaignCreators。 */
  function syncToStore(list: Creator[], hidden: Set<string>) {
    const visible: ReportCreator[] = list
      .filter((c) => !hidden.has(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        handle: c.handle,
        platform: c.platform,
        tier: c.tier,
        followers: c.followers,
        engagement: c.engagement,
        category: c.category,
        region: c.region,
        avatar: c.avatar,
        audience: c.audience,
      }));
    const rd = useEditorStore.getState().reportData;
    const next: ReportDataContext = { ...rd, campaignCreators: visible };
    setReportData(next);
  }

  const visibleCount = allCreators ? allCreators.length - hiddenIds.size : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-[760px] flex-col overflow-hidden rounded-xl bg-surface-primary shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-5 py-3">
          <div>
            <div className="font-headings text-base font-semibold text-foreground-primary">
              数据配置
            </div>
            {campaignName && (
              <div className="text-xs text-foreground-muted">
                {campaignName} · 数据源：数据库
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-foreground-secondary hover:bg-surface-hover"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          {!campaignId && (
            <p className="text-sm text-foreground-muted">
              当前项目未绑定 Campaign，无法加载数据。
            </p>
          )}

          {campaignId && loading && (
            <p className="text-sm text-foreground-muted">加载中…</p>
          )}

          {campaignId && failed && (
            <p className="text-sm text-red">数据加载失败，请检查后端服务。</p>
          )}

          {campaignId && !loading && !failed && allCreators && allCreators.length === 0 && (
            <p className="text-sm text-foreground-muted">
              该 Campaign 下暂无达人数据。
            </p>
          )}

          {campaignId && !loading && !failed && allCreators && allCreators.length > 0 && (
            <div className="space-y-4">
              {/* 概要 */}
              <div className="flex items-center justify-between rounded-lg border border-border-default bg-surface-hover/50 px-3 py-2">
                <span className="text-xs text-foreground-secondary">
                  共 {allCreators.length} 位达人 · 显示 {visibleCount} 位 · 隐藏 {hiddenIds.size} 位
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setHiddenIds(new Set());
                      syncToStore(allCreators, new Set());
                    }}
                    className="rounded border border-border-default px-2 py-0.5 text-[11px] text-foreground-secondary hover:bg-surface-hover"
                  >
                    全部显示
                  </button>
                  <button
                    onClick={() => {
                      const all = new Set(allCreators.map((c) => c.id));
                      setHiddenIds(all);
                      syncToStore(allCreators, all);
                    }}
                    className="rounded border border-border-default px-2 py-0.5 text-[11px] text-foreground-secondary hover:bg-surface-hover"
                  >
                    全部隐藏
                  </button>
                </div>
              </div>

              {/* 达人列表（显隐勾选） */}
              <div className="space-y-2">
                {allCreators.map((c) => {
                  const visible = !hiddenIds.has(c.id);
                  const works = allWorks?.find((w) => w.creatorId === c.id);
                  return (
                    <div
                      key={c.id}
                      className={`rounded-lg border p-3 transition ${
                        visible
                          ? 'border-border-default bg-surface-primary'
                          : 'border-border-subtle bg-surface-hover/30 opacity-60'
                      }`}
                    >
                      {/* 达人信息行 */}
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleCreator(c)}
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs transition ${
                            visible
                              ? 'border-accent-primary bg-accent-primary text-white'
                              : 'border-border-default text-transparent hover:border-foreground-muted'
                          }`}
                          title={visible ? '点击隐藏' : '点击显示'}
                        >
                          ✓
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground-primary">{c.name}</span>
                            <span className="text-[10px] text-foreground-muted">
                              {c.platform} · {c.tier}
                            </span>
                          </div>
                          <div className="text-[11px] text-foreground-muted">
                            {c.handle && `@${c.handle}`}
                            {c.handle && ' · '}
                            {c.category}
                            {c.category && ' · '}
                            {c.region}
                          </div>
                          <div className="text-[11px] text-foreground-secondary">
                            粉丝 {c.followers} · 互动率 {c.engagement}
                          </div>
                        </div>
                        {works && works.posts.length > 0 && (
                          <span className="shrink-0 rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-muted">
                            {works.posts.length} 条作品
                          </span>
                        )}
                      </div>

                      {/* 作品预览（仅可见达人展示） */}
                      {visible && works && works.posts.length > 0 && (
                        <div className="mt-2 border-t border-border-subtle pt-2">
                          <CreatorPostList works={works} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-border-default px-5 py-3">
          <button
            onClick={onClose}
            className="rounded bg-accent-primary px-6 py-1.5 text-sm text-white hover:bg-accent-secondary"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================ 子组件 ============================ */

/** 达人作品列表：简洁卡片式展示作品数据（只读，不可编辑）。 */
function CreatorPostList({ works }: { works: CreatorWorks }) {
  return (
    <div className="space-y-1.5">
      {works.posts.map((post, i) => (
        <div key={i} className="flex items-center gap-3 rounded border border-border-subtle bg-surface-hover/30 px-2 py-1.5">
          {/* 多截图缩略图 */}
          <div className="flex gap-1">
            {(post.screenshots ?? []).slice(0, 3).map((ss, si) => (
              ss.src ? (
                <img key={si} src={ss.src} alt={ss.caption || ''} className="h-8 w-8 rounded border border-border-subtle object-cover" />
              ) : null
            ))}
          </div>
          {/* 标题 + 平台 */}
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-foreground-primary" title={post.title}>
              {post.title}
            </div>
            <div className="text-[10px] text-foreground-muted">
              {post.platform}
              {post.publishedAt ? ` · ${post.publishedAt}` : ''}
            </div>
          </div>
          {/* 指标（只读） */}
          <div className="flex shrink-0 items-center gap-2 text-[10px] text-foreground-muted tabular-nums">
            <span title="曝光">👁 {post.impressions}</span>
            <span title="点赞">👍 {post.likes}</span>
            <span title="评论">💬 {post.comments}</span>
            {post.shares && post.shares !== '0' && <span title="转发">↗ {post.shares}</span>}
            {post.saves && post.saves !== '0' && <span title="收藏">⭐ {post.saves}</span>}
            {post.orders && post.orders !== '0' && <span title="订单">📦 {post.orders}</span>}
            {post.cpm && <span title="CPM">💰 {post.cpm}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
