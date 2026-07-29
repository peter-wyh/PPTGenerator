import { useEffect, useState } from 'react';
import type {
  CollaborationData,
  CollaborationDeliverable,
  ContentType,
  CommentWordItem,
  WorkAudienceInsight,
  WorkMetricItem,
  WorkScreenshotItem,
} from '@mediakit/shared';
import { collaborationId, collaborationLabel } from '@mediakit/shared';
import { ImageInput } from '@/components/ImageInput';
import { getCollaboration, saveCollaboration, removeCollaboration } from '@/api/collaborations';
import { buildSeedCollaboration } from '@/api/analytics/collaborationSeed';
import { formatExecPrice, formatCPE, formatCPM, rateCPE, rateCPM, COST_COLOR_CLASS, CPE_HINT, CPM_HINT, EXEC_PRICE_HINT } from '@/lib/format';

const CONTENT_TYPES: ContentType[] = ['post', 'reels', 'video', 'image', 'live', 'story'];

/** 小信息点图标 */
function InfoDot() {
  return (
    <svg className="w-2.5 h-2.5 inline-block shrink-0 opacity-40" viewBox="0 0 12 12" fill="currentColor">
      <path d="M6 1a5 5 0 100 10A5 5 0 006 1zm0 2a.75.75 0 110 1.5.75.75 0 010-1.5zm-.75 2.5h1.5v4H5.25v-4z" />
    </svg>
  );
}

const EMPTY: CollaborationData = { id: '', campaignId: '', creatorId: '', deliverables: [] };

/** 抽屉内：一个达人的合作详情——合作方式（派生）+ 每种作品类型的四类数据编辑器。 */
export function CollaborationDetail({
  campaignId,
  creatorId,
  onChange,
}: {
  campaignId: string;
  creatorId: string;
  creatorName: string;
  onChange?: () => void;
}) {
  const [data, setData] = useState<CollaborationData | null>(null); // null = 加载中
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCollaboration(campaignId, creatorId)
      .then((c) => {
        if (cancelled) return;
        // 后端无合作记录时，用 mock seed 生成 fallback（不自动落库，仅展示）
        setData(c ?? buildSeedCollaboration(campaignId, creatorId));
      })
      .catch(() => {
        if (!cancelled) setData(buildSeedCollaboration(campaignId, creatorId));
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, creatorId]);

  if (!data) return <div className="text-xs text-foreground-muted">加载合作…</div>;

  const label = collaborationLabel(data);

  async function save() {
    await saveCollaboration(data!);
    setEditing(false);
    onChange?.();
  }
  async function remove() {
    await removeCollaboration(campaignId, creatorId);
    setData({ ...EMPTY, id: collaborationId(campaignId, creatorId), campaignId, creatorId });
    setEditing(false);
    onChange?.();
  }

  function patch(fn: (d: CollaborationData) => CollaborationData) {
    setData((prev) => (prev ? fn(prev) : prev));
  }
  const addDeliverable = () =>
    patch((d) => ({ ...d, deliverables: [...d.deliverables, { contentType: 'post' }] }));
  const setDeliverable = (i: number, del: CollaborationDeliverable) =>
    patch((d) => ({ ...d, deliverables: d.deliverables.map((x, idx) => (idx === i ? del : x)) }));
  const removeDeliverable = (i: number) =>
    patch((d) => ({ ...d, deliverables: d.deliverables.filter((_, idx) => idx !== i) }));

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-foreground-muted">
          合作方式：<b className="text-foreground-primary">{label}</b>
        </span>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={() => void save()} className="text-accent-primary hover:underline">保存</button>
              <button onClick={() => setEditing(false)} className="text-foreground-secondary hover:underline">取消</button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="text-accent-primary hover:underline">编辑合作</button>
          )}
          {data.deliverables.length > 0 && (
            <button onClick={() => void remove()} className="text-red hover:underline">删除</button>
          )}
        </div>
      </div>

      {data.deliverables.length === 0 && !editing ? (
        <p className="text-foreground-muted">未设置合作。点「编辑合作」添加作品类型。</p>
      ) : (
        data.deliverables.map((del, i) => (
          <DeliverableEditor
            key={i}
            deliverable={del}
            editing={editing}
            onChange={(d) => setDeliverable(i, d)}
            onRemove={() => removeDeliverable(i)}
          />
        ))
      )}

      {editing && (
        <button onClick={addDeliverable} className="text-accent-primary hover:underline">+ 添加作品类型</button>
      )}
    </div>
  );
}

/** 单个作品类型的四类数据编辑/展示（v1：截图/效果/词云可编辑，画像只读概要）。 */
function DeliverableEditor({
  deliverable,
  editing,
  onChange,
  onRemove,
}: {
  deliverable: CollaborationDeliverable;
  editing: boolean;
  onChange: (d: CollaborationDeliverable) => void;
  onRemove: () => void;
}) {
  const { contentType, screenshots = [], metrics = [], audience, wordcloud = [], execPrice, cpe, cpm } = deliverable;
  const patch = (p: Partial<CollaborationDeliverable>) => onChange({ ...deliverable, ...p });

  const setScreenshots = (s: WorkScreenshotItem[]) => patch({ screenshots: s });
  const setMetrics = (m: WorkMetricItem[]) => patch({ metrics: m });
  const setWords = (w: CommentWordItem[]) => patch({ wordcloud: w });
  const setAudience = (p: Partial<WorkAudienceInsight>) =>
    patch({ audience: { ...(deliverable.audience ?? {}), ...p } });

  return (
    <div className="rounded border border-border-subtle p-2">
      <div className="mb-1 flex items-center gap-2">
        {editing ? (
          <select
            value={contentType}
            onChange={(e) => patch({ contentType: e.target.value as ContentType })}
            className="rounded border border-border-default px-1 py-0.5"
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        ) : (
          <span className="font-medium text-foreground-primary">{contentType}</span>
        )}
        {editing && (
          <button onClick={onRemove} className="ml-auto text-red hover:underline">移除</button>
        )}
      </div>

      {/* 作品截图 */}
      <Section title="作品截图" editing={editing} onAdd={() => setScreenshots([...screenshots, { src: '' }])}>
        {screenshots.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <ImageInput
              value={s.src}
              onChange={(url) => setScreenshots(screenshots.map((x, idx) => (idx === i ? { ...x, src: url } : x)))}
            />
            <input
              value={s.caption ?? ''}
              placeholder="说明"
              disabled={!editing}
              onChange={(e) => setScreenshots(screenshots.map((x, idx) => (idx === i ? { ...x, caption: e.target.value } : x)))}
              className="w-24 rounded border border-border-default px-1 py-0.5 disabled:bg-transparent"
            />
            {editing && (
              <button onClick={() => setScreenshots(screenshots.filter((_, idx) => idx !== i))} className="text-red">✕</button>
            )}
          </div>
        ))}
      </Section>

      {/* 效果数据 */}
      <Section title="效果数据" editing={editing} onAdd={() => setMetrics([...metrics, { label: '', value: '' }])}>
        {metrics.map((m, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              value={m.label}
              placeholder="指标"
              disabled={!editing}
              onChange={(e) => setMetrics(metrics.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
              className="w-20 rounded border border-border-default px-1 py-0.5 disabled:bg-transparent"
            />
            <input
              value={m.value}
              placeholder="数值"
              disabled={!editing}
              onChange={(e) => setMetrics(metrics.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))}
              className="w-24 rounded border border-border-default px-1 py-0.5 disabled:bg-transparent"
            />
            {editing && (
              <button onClick={() => setMetrics(metrics.filter((_, idx) => idx !== i))} className="text-red">✕</button>
            )}
          </div>
        ))}
      </Section>

      {/* 成本指标（只读，由 seed 自动计算） */}
      {(execPrice != null || cpe != null || cpm != null) && (
        <div className="mb-1">
          <div className="flex items-center gap-2 text-foreground-secondary">
            <span>成本指标</span>
          </div>
          <div className="ml-2 grid grid-cols-3 gap-2">
            {execPrice != null && (
              <div className="rounded border border-border-subtle px-2 py-1 text-center" title={EXEC_PRICE_HINT}>
                <div className="text-[10px] text-foreground-muted flex items-center justify-center gap-0.5">
                  <InfoDot />
                  执行价
                </div>
                <div className="text-sm font-semibold tabular-nums text-foreground-primary">
                  {formatExecPrice(execPrice)}
                </div>
              </div>
            )}
            {cpe != null && (
              <div className="rounded border border-border-subtle px-2 py-1 text-center" title={CPE_HINT}>
                <div className="text-[10px] text-foreground-muted flex items-center justify-center gap-0.5">
                  <InfoDot />
                  CPE
                </div>
                <div className={`text-sm font-semibold tabular-nums ${COST_COLOR_CLASS[rateCPE(Number(cpe))]}`}>
                  {formatCPE(cpe)}
                </div>
              </div>
            )}
            {cpm != null && (
              <div className="rounded border border-border-subtle px-2 py-1 text-center" title={CPM_HINT}>
                <div className="text-[10px] text-foreground-muted flex items-center justify-center gap-0.5">
                  <InfoDot />
                  CPM
                </div>
                <div className={`text-sm font-semibold tabular-nums ${COST_COLOR_CLASS[rateCPM(Number(cpm))]}`}>
                  {formatCPM(cpm)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 每日效果数据（只读展示） */}
      {deliverable.daily && deliverable.daily.length > 0 && (
        <div className="mb-1">
          <div className="flex items-center gap-2 text-foreground-secondary">
            <span>每日效果数据</span>
            <span className="text-foreground-muted">({deliverable.daily.length} 天)</span>
          </div>
          <div className="ml-2 mt-0.5 max-h-32 overflow-auto rounded border border-border-subtle">
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
                {deliverable.daily.map((d, di) => (
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

      {/* 评论词云 */}
      <Section title="评论词云" editing={editing} onAdd={() => setWords([...wordcloud, { text: '', weight: 50, sentiment: 'neutral' }])}>
        {wordcloud.map((w, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              value={w.text}
              placeholder="词"
              disabled={!editing}
              onChange={(e) => setWords(wordcloud.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)))}
              className="w-20 rounded border border-border-default px-1 py-0.5 disabled:bg-transparent"
            />
            <input
              type="number"
              value={w.weight}
              disabled={!editing}
              onChange={(e) => setWords(wordcloud.map((x, idx) => (idx === i ? { ...x, weight: Number(e.target.value) } : x)))}
              className="w-14 rounded border border-border-default px-1 py-0.5 disabled:bg-transparent"
            />
            <select
              value={w.sentiment}
              disabled={!editing}
              onChange={(e) => setWords(wordcloud.map((x, idx) => (idx === i ? { ...x, sentiment: e.target.value as CommentWordItem['sentiment'] } : x)))}
              className="rounded border border-border-default px-1 py-0.5 disabled:bg-transparent"
            >
              <option value="pos">pos</option>
              <option value="neg">neg</option>
              <option value="neutral">neutral</option>
            </select>
            {editing && (
              <button onClick={() => setWords(wordcloud.filter((_, idx) => idx !== i))} className="text-red">✕</button>
            )}
          </div>
        ))}
      </Section>

      {/* 受众画像（城市/性别/年龄/趋势，editing 可编辑） */}
      <NamedValueSection title="受众·城市" items={audience?.topCities ?? []} editing={editing}
        onChange={(items) => setAudience({ topCities: items })} />
      <NamedValueSection title="受众·性别" items={audience?.genderSplit ?? []} editing={editing}
        onChange={(items) => setAudience({ genderSplit: items })} />
      <NamedValueSection title="受众·年龄" items={audience?.ageRange ?? []} editing={editing}
        onChange={(items) => setAudience({ ageRange: items })} />
      <NamedValueSection title="受众·趋势" items={audience?.trend ?? []} editing={editing}
        onChange={(items) => setAudience({ trend: items })} />
      <div className="ml-2 mb-1 flex items-center gap-1 text-foreground-secondary">
        <span>趋势名</span>
        <input
          value={audience?.trendLabel ?? ''}
          placeholder="如 播放趋势"
          disabled={!editing}
          onChange={(e) => setAudience({ trendLabel: e.target.value })}
          className="w-28 rounded border border-border-default px-1 py-0.5 disabled:bg-transparent"
        />
      </div>
    </div>
  );
}

function Section({
  title,
  editing,
  onAdd,
  children,
}: {
  title: string;
  editing: boolean;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 text-foreground-secondary">
        <span>{title}</span>
        {editing && (
          <button onClick={onAdd} className="text-accent-primary hover:underline">+ 添加</button>
        )}
      </div>
      <div className="ml-2 space-y-0.5">{children}</div>
    </div>
  );
}

/** 受众画像的 label/value 行编辑器（城市/性别/年龄/趋势共用）。复用 Section；跳过 color（图表自动上色）。 */
function NamedValueSection({
  title,
  items,
  editing,
  onChange,
}: {
  title: string;
  items: { label: string; value: number }[];
  editing: boolean;
  onChange: (items: { label: string; value: number }[]) => void;
}) {
  return (
    <Section title={title} editing={editing} onAdd={() => onChange([...items, { label: '', value: 0 }])}>
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            value={it.label}
            placeholder="标签"
            disabled={!editing}
            onChange={(e) => onChange(items.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
            className="w-20 rounded border border-border-default px-1 py-0.5 disabled:bg-transparent"
          />
          <input
            type="number"
            value={it.value}
            placeholder="值"
            disabled={!editing}
            onChange={(e) => onChange(items.map((x, idx) => (idx === i ? { ...x, value: Number(e.target.value) } : x)))}
            className="w-16 rounded border border-border-default px-1 py-0.5 disabled:bg-transparent"
          />
          {editing && (
            <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="text-red">✕</button>
          )}
        </div>
      ))}
    </Section>
  );
}
