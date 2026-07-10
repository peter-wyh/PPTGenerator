import type { CommentWordcloudData, EditorComponent, Sentiment } from '@mediakit/shared';
import { useEditorStore } from '../../store';
import { FieldGroup } from '../helpers';

const WORDCLOUD_SENTIMENT_OPTIONS: { value: Sentiment; label: string }[] = [
  { value: 'pos', label: '正面' },
  { value: 'neg', label: '负面' },
  { value: 'neutral', label: '中性' },
];

/** 评论词云：每个词 text + weight + 情感 + 删除，底部添加。 */
export function CommentWordcloudFields({ comp }: { comp: EditorComponent }) {
  const updateComponentData = useEditorStore((s) => s.updateComponentData);
  const commit = useEditorStore((s) => s.commit);
  const data = comp.data as CommentWordcloudData;
  const words = data.words ?? [];

  const write = (next: CommentWordcloudData['words']) => {
    updateComponentData(comp.id, { words: next } as Partial<CommentWordcloudData>);
    commit();
  };
  const setItem = (i: number, patch: Partial<{ text: string; weight: number; sentiment: Sentiment }>) =>
    write(words.map((w, idx) => (idx === i ? { ...w, ...patch } : w)));
  const add = () => write([...words, { text: '新词', weight: 50, sentiment: 'neutral' }]);
  const remove = (i: number) => write(words.filter((_, idx) => idx !== i));

  return (
    <FieldGroup title="评论词">
      <div className="space-y-1">
        {words.map((w, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              value={w.text}
              placeholder="词"
              onChange={(e) => setItem(i, { text: e.target.value })}
              className="w-16 rounded border border-border-default px-1.5 py-0.5 text-xs text-foreground-primary"
            />
            <input
              type="number"
              value={w.weight}
              onChange={(e) => setItem(i, { weight: Number(e.target.value) })}
              className="w-12 rounded border border-border-default px-1 py-0.5 text-xs text-foreground-primary"
            />
            <select
              value={w.sentiment}
              onChange={(e) => setItem(i, { sentiment: e.target.value as Sentiment })}
              className="rounded border border-border-default px-1 py-0.5 text-xs text-foreground-primary"
            >
              {WORDCLOUD_SENTIMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button onClick={() => remove(i)} className="text-foreground-muted hover:text-red">
              ✕
            </button>
          </div>
        ))}
      </div>
      <button onClick={add} className="text-xs text-accent-primary hover:underline">
        + 添加词
      </button>
    </FieldGroup>
  );
}
