/**
 * ContentPanel — Recipe 内容层(reportContent 字段直填)。
 * v1 暴露最常用的两类字段:
 *  - KPI 卡片:label/value(对应 schema.kpis[])
 *  - 发布方/达人名称:name + handle(对应 schema.publishers[])
 *
 * 其余复杂字段(trend/insights 的数组结构)留待 v2,不在此面板编辑。
 * 所有改动通过 onChange 不可变回写 RecipeEditor 的 content state。
 */
interface Kpi {
  label: string;
  value: string;
  highlight?: boolean;
}
interface Publisher {
  name: string;
  handle?: string;
}

interface Props {
  content: Record<string, unknown> | null;
  onChange: (c: Record<string, unknown>) => void;
}

export function ContentPanel({ content, onChange }: Props) {
  const kpis: Kpi[] = Array.isArray(content?.kpis) ? (content!.kpis as Kpi[]) : [];
  const publishers: Publisher[] = Array.isArray(content?.publishers)
    ? (content!.publishers as Publisher[])
    : [];

  const patchKpi = (idx: number, patch: Partial<Kpi>) => {
    const next = kpis.map((k, i) => (i === idx ? { ...k, ...patch } : k));
    onChange({ ...(content ?? {}), kpis: next });
  };

  const addKpi = () => {
    onChange({
      ...(content ?? {}),
      kpis: [...kpis, { label: '新指标', value: '0' }],
    });
  };

  const removeKpi = (idx: number) => {
    onChange({
      ...(content ?? {}),
      kpis: kpis.filter((_, i) => i !== idx),
    });
  };

  const patchPublisher = (idx: number, patch: Partial<Publisher>) => {
    const next = publishers.map((p, i) => (i === idx ? { ...p, ...patch } : p));
    onChange({ ...(content ?? {}), publishers: next });
  };

  return (
    <fieldset className="rounded-lg border border-border-default p-3">
      <legend className="px-1 text-xs font-medium text-foreground-secondary">📝 内容</legend>

      {/* KPI 表格 */}
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-medium text-foreground-secondary">KPI 卡片</span>
          <button
            type="button"
            onClick={addKpi}
            className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-secondary hover:text-foreground-primary"
          >
            + 添加
          </button>
        </div>
        {kpis.length === 0 ? (
          <p className="rounded bg-surface-hover px-2 py-1.5 text-[10px] text-foreground-muted">
            暂无 KPI(数据从 campaign 自动拉取)
          </p>
        ) : (
          <ul className="space-y-1">
            {kpis.map((k, idx) => (
              <li key={idx} className="flex items-center gap-1">
                <input
                  aria-label={`KPI ${idx + 1} 标签`}
                  value={k.label}
                  onChange={(e) => patchKpi(idx, { label: e.target.value })}
                  placeholder="标签"
                  className="min-w-0 flex-1 rounded border border-border-default bg-surface-primary px-1.5 py-1 text-[11px] outline-none focus:border-accent-primary"
                />
                <input
                  aria-label={`KPI ${idx + 1} 数值`}
                  value={k.value}
                  onChange={(e) => patchKpi(idx, { value: e.target.value })}
                  placeholder="数值"
                  className="w-16 rounded border border-border-default bg-surface-primary px-1.5 py-1 text-[11px] outline-none focus:border-accent-primary"
                />
                <button
                  type="button"
                  onClick={() => removeKpi(idx)}
                  aria-label={`删除 KPI ${idx + 1}`}
                  className="rounded px-1 text-[11px] text-foreground-muted hover:text-red"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 发布方/达人名称 */}
      <div>
        <span className="mb-1 block text-[11px] font-medium text-foreground-secondary">
          发布方 / 达人名称
        </span>
        {publishers.length === 0 ? (
          <p className="rounded bg-surface-hover px-2 py-1.5 text-[10px] text-foreground-muted">
            暂无发布方数据
          </p>
        ) : (
          <ul className="space-y-1">
            {publishers.map((p, idx) => (
              <li key={idx} className="flex items-center gap-1">
                <input
                  aria-label={`发布方 ${idx + 1} 名称`}
                  value={p.name}
                  onChange={(e) => patchPublisher(idx, { name: e.target.value })}
                  placeholder="名称"
                  className="min-w-0 flex-1 rounded border border-border-default bg-surface-primary px-1.5 py-1 text-[11px] outline-none focus:border-accent-primary"
                />
                <input
                  aria-label={`发布方 ${idx + 1} 账号`}
                  value={p.handle ?? ''}
                  onChange={(e) => patchPublisher(idx, { handle: e.target.value })}
                  placeholder="@账号"
                  className="w-20 rounded border border-border-default bg-surface-primary px-1.5 py-1 text-[11px] outline-none focus:border-accent-primary"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </fieldset>
  );
}
