/**
 * Campaign 数据管理页面 —— 列表、CRUD、合作达人管理。
 * 从 DataManagement.tsx 拆出的独立路由页面（/data/campaigns）。
 */
import { Fragment, useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { Campaign, CampaignMetric, Creator } from '@mediakit/shared';
import { MOCK_CAMPAIGNS } from '@/api/mock/campaigns';
import { dataApi, type DataRecordDTO } from '@/api/dataLibrary';
import { listCampaignCollaborators, listCreators, listCampaignCreators } from '@/api/creators';
import { campaignsApi } from '@/api/campaignsApi';
import { CreatorMultiSelect } from '@/editor/components/CreatorMultiSelect';
import { ImportPreviewModal } from '@/editor/components/ImportPreviewModal';
import { RecordFormModal } from '@/editor/components/RecordFormModal';
import { CollaborationDetail } from '@/components/CollaborationDetail';
import { importSeedCollaborations } from '@/api/mock/collaborationSeed';
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

  async function del(id: string) {
    if (!window.confirm('确认删除该 Campaign?')) return;
    await dataApi.remove(id);
    await reload();
  }
  async function clearAll() {
    if (!window.confirm('确认清空全部 Campaign 记录?此操作不可恢复。')) return;
    await dataApi.clear('campaign');
    await reload();
  }
  async function seed() {
    const items = await Promise.all(
      MOCK_CAMPAIGNS.map(async (c) => ({
        ...c,
        creatorIds: ((await listCampaignCreators(c.id)) ?? []).map((cr) => cr.id),
      })),
    );
    const r = await dataApi.importMany('campaign', items);
    window.alert(`导入完成:新增 ${r.created},更新 ${r.updated},跳过 ${r.skipped}`);
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
      if (!Array.isArray(arr)) { window.alert('JSON 须为数组'); return; }
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
        <button onClick={() => csvRef.current?.click()} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary">导入 CSV/XLSX</button>
        <button onClick={() => jsonRef.current?.click()} className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover">导入 JSON</button>
        <button onClick={() => downloadTemplate('campaign')} className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover">下载模板</button>
        <button onClick={() => setAdding(true)} className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover">新增</button>
        {empty && (
          <button onClick={() => void seed()} className="rounded border border-accent-primary px-3 py-1 text-xs text-accent-primary hover:bg-accent-primary/10">导入示例数据</button>
        )}
        {!empty && (
          <button onClick={() => void clearAll()} className="rounded border border-border-default px-3 py-1 text-xs text-red hover:bg-surface-hover">清空</button>
        )}
        <input ref={csvRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onCsv} />
        <input ref={jsonRef} type="file" accept=".json,application/json" className="hidden" onChange={onJson} />
      </div>
      <CampaignList records={records} loading={loading} onEdit={setEditing} onDelete={(id) => void del(id)} />
      {preview && (
        <ImportPreviewModal kind="campaign" items={preview} onConfirm={confirmImport} onCancel={() => setPreview(null)} />
      )}
      {adding && (
        <RecordFormModal kind="campaign" record={null} onSaved={async () => { setAdding(false); await reload(); }} onCancel={() => setAdding(false)} />
      )}
      {editing && (
        <RecordFormModal kind="campaign" record={editing} onSaved={async () => { setEditing(null); await reload(); }} onCancel={() => setEditing(null)} />
      )}
    </div>
  );
}

/* ========================= Hooks ========================= */

function useCampaignRecords() {
  const [records, setRecords] = useState<DataRecordDTO<Campaign>[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRecords(await dataApi.list<Campaign>('campaign'));
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
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
    if (m && !used.has(label)) { picked.push(m); used.add(label); }
    if (picked.length >= 3) return picked;
  }
  for (const m of metrics) {
    if (used.has(m.label)) continue;
    picked.push(m); used.add(m.label);
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
  records: DataRecordDTO<Campaign>[];
  loading: boolean;
  onEdit: (r: DataRecordDTO) => void;
  onDelete: (id: string) => void;
}) {
  const [drawerRecord, setDrawerRecord] = useState<DataRecordDTO<Campaign> | null>(null);
  if (loading) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">Loading…</p>;
  }
  if (records.length === 0) {
    return <p className="rounded-lg border border-border-default bg-surface-primary px-4 py-6 text-sm text-foreground-muted">No data</p>;
  }
  const heads = ['#', 'Campaign', 'Advertiser', 'Business Line', 'Platform', 'Period', 'Budget', 'Stats', 'Status', 'Owner', ''];
  return (
    <>
      <div className="overflow-auto rounded-lg border border-border-default">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="bg-surface-hover text-left text-xs text-foreground-muted">
              {heads.map((h, i) => (
                <th key={i} className={`px-3 py-2 font-medium whitespace-nowrap ${i === 0 ? 'sticky left-0 z-10 bg-surface-hover' : ''} ${i === heads.length - 1 ? 'sticky right-0 z-10 bg-surface-hover text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((r, idx) => {
              const d = r.data;
              const stats = pickCampaignStats(d.metrics);
              return (
                <tr key={r.id} className="border-t border-border-subtle hover:bg-surface-hover/50">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-surface-primary px-3 py-2 font-mono text-xs tabular-nums text-foreground-muted hover:bg-surface-hover/50">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium text-foreground-primary">{d.name}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.advertiser}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.businessLine}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.platform}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.startDate} ~ {d.endDate}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.budget}</td>
                  <td className="px-3 py-2">
                    {stats.length === 0 ? (
                      <span className="text-foreground-muted">—</span>
                    ) : (
                      <div className="whitespace-nowrap text-xs">
                        <div className="font-medium text-foreground-secondary">{stats[0].label} {stats[0].value}</div>
                        {stats.length > 1 && (
                          <div className="text-foreground-muted">
                            {stats.slice(1).map((m, i) => (
                              <Fragment key={m.label}>
                                {i > 0 && ' · '}
                                <span>{m.label} {m.value}</span>
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
                      <button onClick={() => setDrawerRecord(r)} className="text-xs text-accent-primary hover:underline">查看达人</button>
                      <button onClick={() => onEdit(r)} className="text-xs text-accent-primary hover:underline">编辑</button>
                      <button onClick={() => onDelete(r.id)} className="text-xs text-red hover:underline">删除</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <CollaboratorDrawer record={drawerRecord} onClose={() => setDrawerRecord(null)} />
    </>
  );
}

/* ========================= Collaborator Drawer ========================= */

function CollaboratorDrawer({ record, onClose }: { record: DataRecordDTO<Campaign> | null; onClose: () => void }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!record) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCloseRef.current(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [record]);
  if (!record) return null;
  return (
    <div className="fixed inset-0 z-50 animate-fadeIn bg-black/40" onClick={onClose} role="presentation">
      <aside
        className="absolute right-0 top-0 flex h-full w-[640px] max-w-[92vw] animate-slideInRight flex-col bg-surface-primary shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="达人合作详情"
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
          <div className="min-w-0">
            <div className="font-headings text-sm font-semibold text-foreground-primary">达人合作详情</div>
            <div className="truncate text-xs text-foreground-muted">{record.data.name}</div>
          </div>
          <button onClick={onClose} aria-label="关闭" className="ml-3 shrink-0 rounded p-1 text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          <CollaboratorPanel record={record} />
        </div>
      </aside>
    </div>
  );
}

function CollaboratorPanel({ record }: { record: DataRecordDTO<Campaign> }) {
  const campaignId = record.id;
  const [collaborators, setCollaborators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCreator, setExpandedCreator] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const cols = await listCampaignCollaborators(campaignId);
        if (!cancelled) setCollaborators(cols);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [campaignId, tick]);

  if (loading) return <p className="text-xs text-foreground-muted">加载合作达人…</p>;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-foreground-secondary">合作达人 · {collaborators.length}</span>
        <div className="flex gap-3">
          <button
            onClick={() => void importSeedCollaborations(campaignId, collaborators.map((c) => c.id)).then(() => setTick((t) => t + 1))}
            className="text-xs text-accent-primary hover:underline"
          >导入演示数据</button>
          <button onClick={() => setManaging(true)} className="text-xs text-accent-primary hover:underline">管理合作达人</button>
        </div>
      </div>
      {collaborators.length === 0 ? (
        <p className="text-xs text-foreground-muted">暂无合作达人。点「管理合作达人」添加。</p>
      ) : (
        <div className="overflow-auto rounded-lg border border-border-default">
          <table className="w-full min-w-[560px] border-collapse text-xs">
            <thead>
              <tr className="bg-surface-hover text-left text-foreground-muted">
                {['Creator', 'Handle', 'Platform', 'Tier', 'Followers', 'Engagement'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-2 py-1 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {collaborators.map((c) => {
                const open = expandedCreator === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr className="border-t border-border-subtle">
                      <td className="px-2 py-1 font-medium text-foreground-primary">
                        <button className="hover:underline" onClick={() => setExpandedCreator(open ? null : c.id)}>
                          {open ? '▾' : '▸'} {c.name}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 text-foreground-secondary">{c.handle}</td>
                      <td className="whitespace-nowrap px-2 py-1 text-foreground-secondary">{c.platform}</td>
                      <td className="whitespace-nowrap px-2 py-1 text-foreground-secondary">{c.tier}</td>
                      <td className="whitespace-nowrap px-2 py-1 text-foreground-secondary">{c.followers}</td>
                      <td className="whitespace-nowrap px-2 py-1 text-foreground-secondary">{c.engagement}</td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={6} className="bg-surface-primary px-3 py-2">
                          <CollaborationDetail
                            campaignId={campaignId}
                            creatorId={c.id}
                            creatorName={c.name}
                            onChange={() => setTick((t) => t + 1)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {managing && (
        <ManageCollaboratorsModal
          campaignId={campaignId}
          campaignData={record.data}
          currentIds={collaborators.map((c) => c.id)}
          onClose={() => setManaging(false)}
          onSaved={() => { setManaging(false); setTick((t) => t + 1); }}
        />
      )}
    </div>
  );
}

function ManageCollaboratorsModal({
  campaignId,
  currentIds,
  onClose,
  onSaved,
}: {
  campaignId: string;
  campaignData: Campaign;
  currentIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [selected, setSelected] = useState<string[]>(currentIds);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    listCreators().then(setCreators).catch(() => setCreators([]));
  }, []);
  async function save() {
    setBusy(true);
    try {
      const toAdd = selected.filter((id) => !currentIds.includes(id));
      const toRemove = currentIds.filter((id) => !selected.includes(id));
      await Promise.all(toAdd.map((creatorId) => campaignsApi.upsertLink({ campaignId, creatorId }).catch(() => {})));
      if (toRemove.length > 0) {
        try {
          const links = await campaignsApi.listLinks(campaignId);
          await Promise.all(links.filter((l) => toRemove.includes(l.creatorId)).map((l) => campaignsApi.removeLink(l.id).catch(() => {})));
        } catch { /* ignore */ }
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="flex max-h-[80vh] w-[480px] flex-col gap-3 overflow-auto rounded-xl bg-surface-primary p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="font-headings text-sm font-semibold text-foreground-primary">管理合作达人</div>
        <CreatorMultiSelect creators={creators} selected={selected} onChange={setSelected} />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover">取消</button>
          <button disabled={busy} onClick={() => void save()} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50">保存</button>
        </div>
      </div>
    </div>
  );
}
