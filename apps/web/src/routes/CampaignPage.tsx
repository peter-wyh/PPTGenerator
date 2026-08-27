/**
 * Campaign 数据管理页面 —— 列表、CRUD。
 * 从 DataManagement.tsx 拆出的独立路由页面（/data/campaigns）。
 * 「查看数据」跳转到合作列表页（/data/campaign-collabs?campaign=xxx）。
 *
 * Phase A: 列表读取走真实 DB Campaign 表（/api/v1/campaigns），不再走 DataRecord。
 * CRUD/导入保留 dataApi 以兼容现有 RecordFormModal。
 */
import { Fragment, useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Campaign, CampaignMetric, ProjectMeta } from '@mediakit/shared';
import { listCampaigns } from '@/api/campaigns';
import { campaignsApi } from '@/api/campaignsApi';
import { projectsApi } from '@/api/projects';
import { dataApi, type DataRecordDTO } from '@/api/dataLibrary';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { ImportPreviewModal } from '@/editor/components/ImportPreviewModal';
import { RecordFormModal } from '@/editor/components/RecordFormModal';
import {
  buildPreviewFromRows,
  buildPreviewFromObjects,
  downloadTemplate,
  type PreviewItem,
} from '@/editor/dataImport';
import { parseFile } from '@/editor/datasource/parse';
import { toast } from '../components/Toast';

export function CampaignPage() {
  const { records, loading, reload } = useCampaignRecords();
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [editing, setEditing] = useState<DataRecordDTO | null>(null);
  const [adding, setAdding] = useState(false);

  // ⚡生成HTML 流程：step1 = 先创建报告（CreateProjectDialog 预填），step2 = AI 生成
  const [genHtmlFor, setGenHtmlFor] = useState<Campaign | null>(null);
  const [genHtmlCreating, setGenHtmlCreating] = useState(false);
  const [genHtmlError, setGenHtmlError] = useState<string | null>(null);
  /** 报告创建成功后，持有 projectId + campaignId 进入 AI 生成 overlay */
  const [genHtmlOverlay, setGenHtmlOverlay] = useState<{ projectId: string; campaignId: string; campaignName: string } | null>(null);

  const csvRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const empty = !loading && records.length === 0;
  void empty;

  async function del(id: string) {
    if (!window.confirm('确认删除该 Campaign?')) return;
    try {
      // 新表优先；旧 DataRecord 兼容清理（Phase 4 前创建的记录仍存于 DataRecord）
      try {
        await campaignsApi.remove(id);
      } catch {
        await dataApi.remove(id);
      }
      toast.success('删除成功');
      await reload();
    } catch {
      toast.error('删除失败');
    }
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
        onGenerateHtml={(c) => setGenHtmlFor(c)}
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
      {/* ⚡生成HTML — Step 1: 先创建报告（预填 campaign 数据） */}
      {genHtmlFor && (
        <CreateProjectDialog
          open
          loading={genHtmlCreating}
          error={genHtmlError}
          title="新建报告 — 生成 HTML"
          submitLabel="创建并生成"
          initial={{
            name: `${genHtmlFor.name} — 投放结案报告`,
            width: 1280,
            height: 800,
            meta: {
              scenario: 'campaign-report',
              scenarioSub: 'wrap-up',
              styleType: 'ai-html',
              businessLine: genHtmlFor.businessLine || undefined,
              advertiser: genHtmlFor.advertiser || undefined,
              campaignId: genHtmlFor.id,
              campaignInfo: {
                campaignName: genHtmlFor.name,
                platform: genHtmlFor.platform,
                startDate: genHtmlFor.startDate,
                endDate: genHtmlFor.endDate,
                budget: genHtmlFor.budget,
              },
            } as ProjectMeta,
          }}
          onCancel={() => {
            setGenHtmlFor(null);
            setGenHtmlError(null);
          }}
          onSubmit={async (values) => {
            setGenHtmlCreating(true);
            setGenHtmlError(null);
            try {
              const { project } = await projectsApi.create(values.name, values.width, values.height, values.meta);
              // 报告创建成功 → 进入 Step 2: AI 生成 overlay
              setGenHtmlFor(null);
              setGenHtmlOverlay({
                projectId: project.id,
                campaignId: genHtmlFor.id,
                campaignName: genHtmlFor.name,
              });
            } catch (err: unknown) {
              const e = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
              setGenHtmlError(e.response?.data?.error?.message ?? e.message ?? '报告创建失败，请重试');
            } finally {
              setGenHtmlCreating(false);
            }
          }}
        />
      )}

      {/* ⚡生成HTML — Step 2: 跳转到沉浸式 AI HTML 工作台 */}
      {genHtmlOverlay && (
        <NavigateToHtmlStudio
          projectId={genHtmlOverlay.projectId}
          onDone={() => setGenHtmlOverlay(null)}
        />
      )}
    </div>
  );
}

/* ========================= Helpers ========================= */

/** 创建报告成功后，立即跳转到沉浸式 AI HTML 工作台。 */
function NavigateToHtmlStudio({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const navigate = useNavigate();
  useEffect(() => {
    toast.success('报告已创建，正在进入 AI HTML 工作台…');
    onDone();
    navigate(`/projects/${projectId}/html-studio`);
  }, [projectId, navigate, onDone]);
  return null;
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
  onGenerateHtml,
}: {
  records: Campaign[];
  loading: boolean;
  onEdit: (c: Campaign) => void;
  onDelete: (id: string) => void;
  onGenerateHtml: (c: Campaign) => void;
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
                      onClick={() => onGenerateHtml(d)}
                      className="rounded bg-accent-primary/10 px-2 py-1 text-xs font-medium text-accent-primary hover:bg-accent-primary/20"
                      title="根据此 Campaign 数据生成 HTML 报告"
                    >
                      ⚡生成HTML
                    </button>
                    <button
                      onClick={() => navigate('/data/campaign-collabs', { state: { campaignId: d.id } })}
                      className="text-xs text-accent-primary hover:underline"
                    >
                      查看数据
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
