import { useEffect, useState } from 'react';
import type { Campaign } from '@mediakit/shared';
import { listCampaigns } from '@/api/campaigns';
import { listCreators, type Creator } from '@/api/creators';

/** Mock 数据展示页：上游接口（campaign / 达人）的 mock 数据一览。 */
export function MockData() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loadingCamps, setLoadingCamps] = useState(true);
  const [loadingCreators, setLoadingCreators] = useState(true);

  useEffect(() => {
    listCampaigns()
      .then(setCampaigns)
      .finally(() => setLoadingCamps(false));
    listCreators()
      .then(setCreators)
      .finally(() => setLoadingCreators(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-headings text-xl font-semibold text-foreground-primary">Mock 数据</h1>
      <p className="mt-1 text-sm text-foreground-secondary">
        上游接口的 mock 数据展示（campaign / 达人）。真实环境对接投放系统与达人库。
      </p>

      {/* Campaign 数据 */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          Campaign 数据 · {campaigns.length}
        </h2>
        <DataTable
          loading={loadingCamps}
          headers={['Campaign', '广告主', '业务线', '平台', '周期', '预算', '状态', '负责人']}
          rows={campaigns.map((c) => [
            c.name,
            c.advertiser,
            c.businessLine,
            c.platform,
            `${c.startDate} ~ ${c.endDate}`,
            c.budget,
            c.status ?? '—',
            c.owner ?? '—',
          ])}
        />
      </section>

      {/* 达人数据 */}
      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          达人数据 · {creators.length}
        </h2>
        <DataTable
          loading={loadingCreators}
          headers={['达人', 'Handle', '平台', '层级', '粉丝', '互动率', '类目', '地区']}
          rows={creators.map((c) => [
            c.name,
            c.handle,
            c.platform,
            c.tier,
            c.followers,
            c.engagement,
            c.category,
            c.region,
          ])}
        />
      </section>
    </div>
  );
}

function DataTable({
  loading,
  headers,
  rows,
}: {
  loading: boolean;
  headers: string[];
  rows: string[][];
}) {
  if (loading) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">加载中…</p>;
  }
  if (rows.length === 0) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">暂无数据</p>;
  }
  return (
    <div className="overflow-auto rounded-lg border border-border-default">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="bg-surface-hover text-left text-xs text-foreground-muted">
            {headers.map((h, i) => (
              <th key={i} className={`px-3 py-2 font-medium ${i === 0 ? '' : 'whitespace-nowrap'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-t border-border-subtle hover:bg-surface-hover/50">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-3 py-2 ${
                    ci === 0
                      ? 'font-medium text-foreground-primary'
                      : 'whitespace-nowrap text-foreground-secondary'
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
