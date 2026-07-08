import { useEffect, useState } from 'react';
import type { Campaign, CampaignMetric } from '@mediakit/shared';
import { listCampaigns } from '../../api/campaigns';

interface Props {
  /** 默认预选 campaign（如项目已绑定的 projectMeta.campaignId）。 */
  defaultCampaignId?: string;
  /** 注入式数据源，默认 listCampaigns；便于测试「无指标」等分支。 */
  fetchCampaigns?: () => Promise<Campaign[]>;
  onConfirm: (metrics: CampaignMetric[]) => void;
  onCancel: () => void;
}

export function ImportCampaignModal({
  defaultCampaignId,
  fetchCampaigns = listCampaigns,
  onConfirm,
  onCancel,
}: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(defaultCampaignId ?? '');

  useEffect(() => {
    let alive = true;
    setCampaigns(null);
    setFailed(false);
    fetchCampaigns()
      .then((list) => {
        if (!alive) return;
        setCampaigns(list);
        if (!selectedId || !list.some((c) => c.id === selectedId)) {
          setSelectedId(list[0]?.id ?? '');
        }
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
    // 仅首屏拉取；selectedId 初值来自 defaultCampaignId，不放进依赖。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCampaigns]);

  const selected = campaigns?.find((c) => c.id === selectedId) ?? null;
  const metrics = selected?.metrics ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="flex max-h-[90vh] w-[560px] flex-col gap-3 overflow-auto rounded-xl bg-surface-primary p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-headings text-sm font-semibold text-foreground-primary">
          从 Campaign 导入
        </div>

        {failed && <p className="text-xs text-red">加载 Campaign 失败，请重试。</p>}

        {!campaigns && !failed && (
          <p className="text-xs text-foreground-muted">加载中…</p>
        )}

        {campaigns && (
          <>
            <label className="block text-xs text-foreground-secondary">
              <span className="mb-1 block">Campaign</span>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full rounded border border-border-default bg-surface-primary px-2 py-1"
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded border border-border-default p-2">
              <div className="mb-1 text-xs text-foreground-muted">预览（导入到业绩看板）</div>
              {metrics.length > 0 ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-foreground-muted">
                      <th className="text-left font-normal">指标</th>
                      <th className="text-right font-normal">数值</th>
                      <th className="text-right font-normal">对比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((mm) => (
                      <tr key={mm.label}>
                        <td className="text-left">{mm.label}</td>
                        <td className="text-right">{mm.value}</td>
                        <td
                          className="text-right"
                          style={{
                            color: mm.compare.trim().startsWith('-')
                              ? 'var(--color-danger, #dc2626)'
                              : 'var(--color-success, #16a34a)',
                          }}
                        >
                          {mm.compare}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-foreground-muted">该 Campaign 暂无可导入的指标</p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={onCancel}
                className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
              >
                取消
              </button>
              <button
                disabled={metrics.length === 0}
                onClick={() => onConfirm(metrics)}
                className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50"
              >
                确认导入
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
