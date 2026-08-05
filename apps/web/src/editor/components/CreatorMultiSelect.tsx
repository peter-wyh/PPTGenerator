import type { Creator } from '@mediakit/shared';

interface Props {
  creators: Creator[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

/** 达人多选复选框组(数据管理:campaign 关联合作达人;新增/编辑表单与「管理合作达人」共用)。 */
export function CreatorMultiSelect({ creators, selected, onChange }: Props) {
  const set = new Set(selected);
  function toggle(id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }
  return (
    <div className="flex max-h-40 flex-col skin-gap-xs overflow-auto rounded border border-border-default p-2">
      {creators.length === 0 && (
        <span className="text-xs text-foreground-muted">达人库为空</span>
      )}
      {creators.map((c) => (
        <label key={c.id} className="flex items-center skin-gap-sm text-xs text-foreground-secondary">
          <input type="checkbox" checked={set.has(c.id)} onChange={() => toggle(c.id)} />
          <span className="text-foreground-primary">{c.name}</span>
          <span className="text-foreground-muted">{c.handle}</span>
        </label>
      ))}
    </div>
  );
}
