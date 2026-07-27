/**
 * Campaign 数据管理页面 —— 列表、CRUD。
 * 从 DataManagement.tsx 拆出的独立路由页面（/data/campaigns）。
 * 「查看达人」跳转到合作列表页（/data/campaign-collabs?campaign=xxx）。
 *
 * Phase A: 列表读取走真实 DB Campaign 表（/api/v1/campaigns），不再走 DataRecord。
 * CRUD/导入保留 dataApi 以兼容现有 RecordFormModal。
 */
import { Fragment, useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Campaign, CampaignMetric } from '@mediakit/shared';
import { listCampaigns } from '@/api/campaigns';
import { dataApi, type DataRecordDTO } from '@/api/dataLibrary';
import { ImportPreviewModal } from '@/editor/components/ImportPreviewModal';
import { RecordFormModal } from '@/editor/components/RecordFormModal';
import {
  buildPreviewFromRows,
  buildPreviewFromObjects,
  downloadTemplate,
  type PreviewItem,
} from '@/editor/dataImport';
import { parseFile } from '@/editor/datasource/parse';

export function CampaignPage() {
  const { records, loading, reload } = useCampaignRecords();
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [editing, setEditing] = useState<DataRecordDTO | null>(null);
  const [adding, setAdding] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const empty = !loading && records.length === 0;
  void empty;

  async function del(id: string) {
    if (!window.confirm('确认删除该 Campaign?')) return;
    await dataApi.remove(id);
    await reload();
  }

  async function onCsv(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const sheets = await parseFile(f);
      setPreview(buildPreviewFromRows('campaign', sheets[0]?.rows ?? []));
    } catch {
      window.alert('文件解析失败');
    }
  }

  async function onJson(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const arr = JSON.parse(await f.text());
      if (!Array.isArray(arr)) {
        window.alert('JSON 须为数组');
        return;
      }
      setPreview(buildPreviewFromObjects('campaign', arr));
    } catch {
      window.alert('JSON 格式错误');
    }
  }

  async function confirmImport(validItems: Record<string, unknown>[]) {
    setPreview(null);
    const r = await dataApi.importMany('campaign', validItems);
    window.alert(`导入完成:新增 ${r.created},更新 ${r.updated},跳过 ${r.skipped}`);
    await reload();
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          onClick={() => csvRef.current?.click()}
          className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary"
        >
          导入 CSV/XLSX
        </button>
        <button
          onClick={() => jsonRef.current?.click()}
          className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
        >
          导入 JSON
        </button>
        <button
          onClick={() => downloadTemplate('campaign')}
          className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
        >
          下载模板
        </button>
        <button
          onClick={() => setAdding(true)}
          className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
        >
          新增
        </button>
        <input ref={csvRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onCsv} />
        <input ref={jsonRef} type="file" accept=".json,application/json" className="hidden" onChange={onJson} />
      </div>
      <CampaignList
        records={records}
        loading={loading}
        onEdit={(c) =>
          setEditing({
            id: c.id,
            kind: 'CAMPAIGN' as const,
            ownerId: '',
            data: c as unknown as Record<string, unknown>,
            createdAt: '',
            updatedAt: '',
          })
        }
        onDelete={(id) => void del(id)}
      />
      {preview && (
        <ImportPreviewModal
          kind="campaign"
          items={preview}
          onConfirm={confirmImport}
          onCancel={() => setPreview(null)}
        />
      )}
      {adding && (
        <RecordFormModal
          kind="campaign"
          record={null}
          onSaved={async () => {
            setAdding(false);
            await reload();
          }}
          onCancel={() => setAdding(false)}
        />
      )}
      {editing && (
        <RecordFormModal
          kind="campaign"
          record={editing}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/* ========================= Hooks ========================= */

/** 列表数据走真实 DB Campaign 表（campaignsApi），含 advertiser/businessLine 名。 */
function useCampaignRecords() {
  const [records, setRecords] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRecords(await listCampaigns());
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { records, loading, reload };
}

/* ========================= Campaign List ========================= */

const CAMPAIGN_STATS_PRIORITY = ['GMV', 'ROAS', 'Spend'];
function pickCampaignStats(metrics?: CampaignMetric[]): CampaignMetric[] {
  if (!metrics?.length) return [];
  const picked: CampaignMetric[] = [];
  const used = new Set<string>();
  for (const label of CAMPAIGN_STATS_PRIORITY) {
    const m = metrics.find((x) => x.label === label);
    if (m && !used.has(label)) {
      picked.push(m);
      used.add(label);
    }
    if (picked.length >= 3) return picked;
  }
  for (const m of metrics) {
    if (used.has(m.label)) continue;
    picked.push(m);
    used.add(m.label);
    if (picked.length >= 3) break;
  }
  return picked;
}

function CampaignList({
  records,
  loading,
  onEdit,
  onDelete,
}: {
  records: Campaign[];
  loading: boolean;
  onEdit: (c: Campaign) => void;
  onDelete: (id: string) => void;
}) {
  const navigate = useNavigate();
  if (loading) {
    return (
      <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">
        Loading…
      </p>
    );
  }
  if (records.length === 0) {
    return (
      <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">
        No data
      </p>
    );
  }
  const heads = [
    '#',
    'Campaign',
    'Advertiser',
    'Business Line',
    'Platform',
    'Period',
    'Budget',
    'Stats',
    'Status',
    'Owner',
    '',
  ];
  return (
    <div className="overflow-auto rounded-lg border border-border-default">
      <table className="w-full min-w-[920px] border-collapse text-sm">
        <thead>
          <tr className="bg-surface-hover text-left text-xs text-foreground-muted">
            {heads.map((h, i) => (
              <th
                key={i}
                className={`px-3 py-2 font-medium whitespace-nowrap ${
                  i === 0 ? 'sticky left-0 z-10 bg-surface-hover' : ''
                } ${i === heads.length - 1 ? 'sticky right-0 z-10 bg-surface-hover text-right' : ''}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((d, idx) => {
            const stats = pickCampaignStats(d.metrics);
            return (
              <tr key={d.id} className="border-t border-border-subtle hover:bg-surface-hover/50">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-surface-primary px-3 py-2 font-mono text-xs tabular-nums text-foreground-muted hover:bg-surface-hover/50">
                  {idx + 1}
                </td>
                <td className="px-3 py-2 font-medium text-foreground-primary">{d.name}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.advertiser}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.businessLine}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.platform}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">
                  {d.startDate} ~ {d.endDate}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.budget}</td>
                <td className="px-3 py-2">
                  {stats.length === 0 ? (
                    <span className="text-foreground-muted">—</span>
                  ) : (
                    <div className="whitespace-nowrap text-xs">
                      <div className="font-medium text-foreground-secondary">
                        {stats[0].label} {stats[0].value}
                      </div>
                      {stats.length > 1 && (
                        <div className="text-foreground-muted">
                          {stats.slice(1).map((m, i) => (
                            <Fragment key={m.label}>
                              {i > 0 && ' · '}
                              <span>
                                {m.label} {m.value}
                              </span>
                            </Fragment>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.status ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.owner ?? '—'}</td>
                <td className="sticky right-0 z-10 whitespace-nowrap bg-surface-primary px-3 py-2 text-right hover:bg-surface-hover/50">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => navigate('/data/campaign-collabs', { state: { campaignId: d.id } })}
                      className="text-xs text-accent-primary hover:underline"
                    >
                      查看达人
                    </button>
                    <button onClick={() => onEdit(d)} className="text-xs text-accent-primary hover:underline">
                      编辑
                    </button>
                    <button onClick={() => onDelete(d.id)} className="text-xs text-red hover:underline">
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
