import { useEffect, useState } from 'react';
import type { Creator, PostDaily } from '@mediaket/shared';
import { CreatorAvatar } from '@/components/CreatorAvatar';

interface Props {
  creator: Creator;
  onClose: () => void;
}

/** 达人详情右侧滑出浮窗:头像/简介/标签 + 基本字段 + 报价 + 联系方式 + 频道 KPI + 受众画像 + 作品列表(可展开每日效果)+ 频道统计。 */
export function CreatorDetailDrawer({ creator, onClose }: Props) {
  const [open, setOpen] = useState(false);
  const [expandedWorkIdx, setExpandedWorkIdx] = useState<number | null>(null);
  useEffect(() => {
    const r = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(r);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const profile: [string, string][] = [
    ['Platform', creator.platform],
    ['Tier', creator.tier],
    ['Followers', creator.followers],
    ['Engagement', creator.engagement],
    ['Category', creator.category],
    ['Region', creator.region],
  ];

  const metrics = creator.metrics ?? [];
  const works = creator.works ?? [];
  const audience = creator.audience;

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <aside
        className={`fixed inset-y-0 right-0 flex h-full w-[440px] max-w-[90vw] flex-col overflow-auto bg-surface-primary shadow-xl transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={creator.name}
      >
        {/* 头部:头像 + name + handle + 简介 + 标签 */}
        <div className="flex items-start gap-3 border-b border-border-subtle p-5">
          <CreatorAvatar name={creator.name} avatar={creator.avatar} size={64} />
          <div className="min-w-0 flex-1">
            <div className="font-headings text-lg font-semibold text-foreground-primary">{creator.name}</div>
            <div className="truncate text-sm text-foreground-secondary">{creator.handle}</div>
            {creator.bio && (
              <p className="mt-2 text-sm leading-relaxed text-foreground-secondary">{creator.bio}</p>
            )}
            {creator.tags && creator.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {creator.tags.map((t) => (
                  <span key={t} className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent-primary">{t}</span>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="关闭" className="rounded p-1 text-foreground-secondary hover:bg-surface-hover">
            ✕
          </button>
        </div>

        {/* 基本字段网格 */}
        <div className="grid grid-cols-2 gap-px bg-border-subtle">
          {profile.map(([k, v]) => (
            <div key={k} className="bg-surface-primary p-3">
              <div className="text-[11px] uppercase tracking-wide text-foreground-muted">{k}</div>
              <div className="text-sm font-medium text-foreground-primary">{v || '—'}</div>
            </div>
          ))}
        </div>

        {/* 合作报价 */}
        {creator.rate && (creator.rate.post || creator.rate.video || creator.rate.live) && (
          <div className="p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">合作报价{creator.rate.currency ? ` (${creator.rate.currency})` : ''}</div>
            <div className="grid grid-cols-3 gap-2">
              {creator.rate.post && <RateCell label="图文" value={creator.rate.post} />}
              {creator.rate.video && <RateCell label="短视频" value={creator.rate.video} />}
              {creator.rate.live && <RateCell label="直播" value={creator.rate.live} />}
            </div>
            {creator.rate.note && <div className="mt-2 text-[11px] text-foreground-muted">{creator.rate.note}</div>}
          </div>
        )}

        {/* 联系方式 */}
        {creator.contact && (creator.contact.mcn || creator.contact.email || creator.contact.phone || creator.contact.contactPerson) && (
          <div className="p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">商务联系方式</div>
            <div className="space-y-1 text-sm">
              {creator.contact.mcn && <ContactRow label="MCN" value={creator.contact.mcn} />}
              {creator.contact.email && <ContactRow label="邮箱" value={creator.contact.email} />}
              {creator.contact.phone && <ContactRow label="电话" value={creator.contact.phone} />}
              {creator.contact.contactPerson && <ContactRow label="联系人" value={creator.contact.contactPerson} />}
            </div>
          </div>
        )}

        {/* 频道 KPI(metrics 为空则隐藏) */}
        {metrics.length > 0 && (
          <div className="p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">频道 KPI</div>
            <div className="grid grid-cols-2 gap-2">
              {metrics.map((m, i) => (
                <div key={`${m.label}-${i}`} className="rounded-lg border border-border-subtle p-3">
                  <div className="text-[11px] text-foreground-muted">{m.label}</div>
                  <div className="text-base font-semibold text-foreground-primary">{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 受众画像 */}
        {audience && (audience.genderSplit?.length || audience.ageRange?.length || audience.topCities?.length) ? (
          <div className="border-t border-border-subtle p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">受众画像</div>
            <div className="space-y-3">
              {/* 性别占比 */}
              {audience.genderSplit?.length ? (
                <div>
                  <div className="mb-1 text-[11px] text-foreground-muted">性别分布</div>
                  <div className="flex gap-1">
                    {audience.genderSplit.map((g, i) => (
                      <div key={i} className="flex-1 rounded bg-surface-hover px-2 py-1 text-center">
                        <div className="text-xs font-medium text-foreground-primary">{g.value}%</div>
                        <div className="text-[10px] text-foreground-muted">{g.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {/* 年龄段 */}
              {audience.ageRange?.length ? (
                <div>
                  <div className="mb-1 text-[11px] text-foreground-muted">年龄分布</div>
                  <div className="flex items-end gap-1">
                    {audience.ageRange.map((a, i) => (
                      <div key={i} className="flex-1 text-center">
                        <div className="mx-auto rounded-t bg-accent-primary/30" style={{ height: `${a.value}px`, minHeight: '4px' }} />
                        <div className="mt-0.5 text-[9px] text-foreground-muted">{a.label}</div>
                        <div className="text-[9px] font-medium text-foreground-secondary">{a.value}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {/* 城市 TOP */}
              {audience.topCities?.length ? (
                <div>
                  <div className="mb-1 text-[11px] text-foreground-muted">城市 TOP</div>
                  <div className="flex flex-wrap gap-1">
                    {audience.topCities.map((c, i) => (
                      <span key={i} className="rounded-full bg-surface-hover px-2 py-0.5 text-[10px] text-foreground-secondary">
                        {c.label} {c.value}%
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* 作品列表(可展开每日效果数据) */}
        {works.length > 0 ? (
          <div className="border-t border-border-subtle p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              作品列表 <span className="text-foreground-muted">({works.length})</span>
            </div>
            <div className="space-y-2">
              {works.map((w, i) => {
                const daily = (w as { daily?: PostDaily[] }).daily;
                const isExpanded = expandedWorkIdx === i;
                return (
                  <div key={w.id || i} className="rounded-lg border border-border-subtle bg-surface-hover/30">
                    {/* 作品头部(可点击展开) */}
                    <div
                      className={`flex items-start gap-2 p-2 ${daily?.length ? 'cursor-pointer' : ''}`}
                      onClick={() => daily?.length && setExpandedWorkIdx(isExpanded ? null : i)}
                    >
                      {w.cover ? (
                        <img src={w.cover} alt={w.title} className="h-10 w-10 shrink-0 rounded border border-border-subtle object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-border-subtle bg-surface-hover text-foreground-muted text-[10px]">
                          {w.platform?.slice(0, 2) || '—'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="truncate text-xs font-medium text-foreground-primary" title={w.title}>{w.title}</span>
                          {w.featured && <span className="rounded bg-accent-soft px-1 text-[9px] text-accent-primary">精选</span>}
                          {w.contentType && <span className="text-[9px] text-foreground-muted">{w.contentType}</span>}
                        </div>
                        <div className="text-[10px] text-foreground-muted">
                          {w.platform}
                          {w.publishedAt ? ` · ${w.publishedAt}` : ''}
                        </div>
                        {/* 指标 */}
                        <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-foreground-muted tabular-nums">
                          {w.impressions && <span title="曝光">👁 {w.impressions}</span>}
                          {w.likes && <span title="点赞">👍 {w.likes}</span>}
                          {w.comments && <span title="评论">💬 {w.comments}</span>}
                          {w.shares && w.shares !== '0' && <span title="转发">↗ {w.shares}</span>}
                          {w.saves && w.saves !== '0' && <span title="收藏">⭐ {w.saves}</span>}
                          {w.engagementRate && <span title="互动率">📊 {w.engagementRate}</span>}
                          {w.attribution?.gmv && <span title="GMV">💰 <span>{w.attribution.gmv}</span></span>}
                        </div>
                      </div>
                      {/* 展开指示 */}
                      {daily?.length ? (
                        <span className="shrink-0 self-center p-1 text-foreground-muted text-[10px]" title={isExpanded ? '收起每日数据' : '展开每日数据'}>
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      ) : null}
                      {w.url && (
                        <a
                          href={w.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 rounded p-1 text-foreground-muted hover:text-accent-primary"
                          title="查看原贴"
                          onClick={(e) => e.stopPropagation()}
                        >
                          ↗
                        </a>
                      )}
                    </div>
                    {/* 每日效果数据表格 */}
                    {isExpanded && daily && daily.length > 0 && (
                      <div className="border-t border-border-subtle px-2 pb-2 pt-1">
                        <div className="mb-1 text-[10px] font-medium text-foreground-muted">
                          每日效果数据 ({daily.length} 天)
                        </div>
                        <div className="max-h-40 overflow-auto rounded border border-border-subtle">
                          <table className="w-full text-[10px] tabular-nums">
                            <thead className="sticky top-0 bg-surface-hover text-foreground-muted">
                              <tr>
                                <th className="px-1.5 py-0.5 text-left font-medium">日期</th>
                                <th className="px-1.5 py-0.5 text-right font-medium">曝光</th>
                                <th className="px-1.5 py-0.5 text-right font-medium">点赞</th>
                                <th className="px-1.5 py-0.5 text-right font-medium">评论</th>
                                <th className="px-1.5 py-0.5 text-right font-medium">转发</th>
                                <th className="px-1.5 py-0.5 text-right font-medium">收藏</th>
                              </tr>
                            </thead>
                            <tbody>
                              {daily.map((d, di) => (
                                <tr key={di} className="border-t border-border-subtle text-foreground-secondary">
                                  <td className="whitespace-nowrap px-1.5 py-0.5">{d.date}</td>
                                  <td className="px-1.5 py-0.5 text-right">{d.impressions}</td>
                                  <td className="px-1.5 py-0.5 text-right">{d.likes}</td>
                                  <td className="px-1.5 py-0.5 text-right">{d.comments}</td>
                                  <td className="px-1.5 py-0.5 text-right">{d.shares}</td>
                                  <td className="px-1.5 py-0.5 text-right">{d.saves}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="border-t border-border-subtle p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">作品列表</div>
            <div className="text-xs text-foreground-muted">暂无作品数据（需在数据管理-合作列表中关联 Campaign 后获取）</div>
          </div>
        )}

        {/* 频道统计 */}
        {(creator.stats?.length ?? 0) > 0 && (
          <div className="border-t border-border-subtle p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">频道统计</div>
            <div className="grid grid-cols-2 gap-2">
              {creator.stats!.map((s, i) => (
                <div key={`${s.label}-${i}`} className="rounded-lg border border-border-subtle p-3">
                  <div className="text-[11px] text-foreground-muted">{s.label}</div>
                  <div className="text-sm font-semibold text-foreground-primary">{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function RateCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-subtle p-3">
      <div className="text-[11px] text-foreground-muted">{label}</div>
      <div className="text-sm font-semibold text-foreground-primary">{value}</div>
    </div>
  );
}

function ContactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-14 shrink-0 text-foreground-muted">{label}</span>
      <span className="text-foreground-primary">{value}</span>
    </div>
  );
}
