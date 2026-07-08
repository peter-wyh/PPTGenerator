import { useEffect, useState } from 'react';
import { templatesApi } from '@/api/templates';
import { Button } from './Button';
import { Input } from './Input';
import { SCENARIO_LABELS } from '@/projectsMeta';
import type { TemplateSummary } from '@mediakit/shared';

interface Props {
  open: boolean;
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (values: { templateId: string; name: string }) => void;
}

/**
 * 「从模板新建项目」对话框：仅列出已发布模板，选一个 + 可改项目名。
 * 调用方拿 templateId 走 createProjectFromTemplate。
 */
export function CreateFromTemplateDialog({ open, loading, error, onCancel, onSubmit }: Props) {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [fetching, setFetching] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('');
  const [name, setName] = useState('');

  // 打开时拉取已发布模板（USER/ADMIN 均只取 PUBLISHED：草稿无法建项目）。
  useEffect(() => {
    if (!open) return;
    setFetching(true);
    templatesApi
      .list({ status: 'PUBLISHED' })
      .then((list) => {
        setTemplates(list);
        setSelectedId(list[0]?.id ?? '');
        setName('');
      })
      .catch(() => setTemplates([]))
      .finally(() => setFetching(false));
  }, [open]);

  if (!open) return null;

  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const canSubmit = !!selectedId && !loading && !fetching;

  const submit = () => {
    if (!selected) return;
    onSubmit({ templateId: selected.id, name: name.trim() || selected.name });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => !loading && onCancel()}
      role="presentation"
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-surface-primary p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3 className="font-headings text-base font-semibold text-foreground-primary">从模板新建项目</h3>
        <p className="mt-0.5 text-xs text-foreground-muted">选择一个已发布模板，深拷贝其页面/尺寸作为新项目起点。</p>

        <div className="mt-4 min-h-[160px] flex-1 overflow-auto rounded-lg border border-border-default">
          {fetching ? (
            <p className="p-4 text-sm text-foreground-muted">加载模板…</p>
          ) : templates.length === 0 ? (
            <p className="p-4 text-sm text-foreground-muted">暂无已发布模板。</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {templates.map((t) => {
                const active = t.id === selectedId;
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => setSelectedId(t.id)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                        active ? 'bg-accent-primary/10' : 'hover:bg-surface-hover'
                      }`}
                    >
                      <span>
                        <span className="font-medium text-foreground-primary">{t.name}</span>
                        <span className="ml-2 text-xs text-foreground-muted">
                          {t.meta?.businessLine ? `${t.meta.businessLine} · ` : ''}
                          {t.meta?.scenario ? SCENARIO_LABELS[t.meta.scenario] : ''}
                          {t.meta?.businessLine || t.meta?.scenario ? ' · ' : ''}
                          {t.width}×{t.height} · {t.pageCount} 页
                        </span>
                      </span>
                      {active && <span className="text-xs font-medium text-accent-primary">已选</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selected && (
          <div className="mt-3">
            <Input
              label="项目名称（可选）"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={selected.name}
            />
          </div>
        )}

        {error && <p className="mt-3 text-xs text-red">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            取消
          </Button>
          <Button onClick={submit} loading={loading} disabled={!canSubmit}>
            创建项目
          </Button>
        </div>
      </div>
    </div>
  );
}
