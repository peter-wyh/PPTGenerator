import { useEffect, useState } from 'react';
import type {
  CollaborationData,
  CollaborationDeliverable,
  ContentType,
  CommentWordItem,
  WorkMetricItem,
  WorkScreenshotItem,
} from '@mediakit/shared';
import { collaborationId, collaborationLabel } from '@mediakit/shared';
import { ImageInput } from '@/components/ImageInput';
import { getCollaboration, saveCollaboration, removeCollaboration } from '@/api/collaborations';

const CONTENT_TYPES: ContentType[] = ['post', 'reels', 'video', 'image', 'live', 'story'];

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
    getCollaboration(campaignId, creatorId).then((c) => {
      if (cancelled) return;
      setData(c ?? { ...EMPTY, id: collaborationId(campaignId, creatorId), campaignId, creatorId });
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
  const { contentType, screenshots = [], metrics = [], audience, wordcloud = [] } = deliverable;
  const patch = (p: Partial<CollaborationDeliverable>) => onChange({ ...deliverable, ...p });

  const setScreenshots = (s: WorkScreenshotItem[]) => patch({ screenshots: s });
  const setMetrics = (m: WorkMetricItem[]) => patch({ metrics: m });
  const setWords = (w: CommentWordItem[]) => patch({ wordcloud: w });

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

      {/* 画像（v1 只读概要，编辑留后续） */}
      <div className="text-foreground-muted">
        画像：
        {audience
          ? `${(audience.topCities ?? []).length} 城 / ${(audience.genderSplit ?? []).length} 性别 / ${(audience.ageRange ?? []).length} 年龄`
          : '暂无'}
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
