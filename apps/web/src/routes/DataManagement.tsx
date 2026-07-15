import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode, type ChangeEvent } from 'react';
import type { Campaign, Creator } from '@mediakit/shared';
import { MOCK_CAMPAIGNS } from '@/api/mock/campaigns';
import { MOCK_CREATORS } from '@/api/mock/creators';
import { dataApi, type DataRecordDTO } from '@/api/dataLibrary';
import { listCampaignCollaborators, listCreators, listCampaignCreators } from '@/api/creators';
import { DataTable } from '@/components/DataTable';
import { CreatorMultiSelect } from '@/editor/components/CreatorMultiSelect';
import { ImportPreviewModal } from '@/editor/components/ImportPreviewModal';
import { RecordFormModal } from '@/editor/components/RecordFormModal';
import { CollaborationDetail } from '@/components/CollaborationDetail';
import { importSeedCollaborations } from '@/api/mock/collaborationSeed';
import {
  buildPreviewFromRows,
  buildPreviewFromObjects,
  downloadTemplate,
  type DataKind,
  type PreviewItem,
} from '@/editor/dataImport';
import { parseFile } from '@/editor/datasource/parse';

export function DataManagement() {
  const [tab, setTab] = useState<DataKind>('campaign');
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-headings text-xl font-semibold text-foreground-primary">数据管理</h1>
      <p className="mt-1 text-sm text-foreground-secondary">
        管理 Campaign 与达人库数据,支持导入。编辑器从本库读取。
      </p>
      <div className="mt-4 flex gap-2 border-b border-border-default">
        {(['campaign', 'creator'] as DataKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${
              tab === k
                ? 'border-accent-primary text-foreground-primary'
                : 'border-transparent text-foreground-secondary hover:text-foreground-primary'
            }`}
          >
            {k === 'campaign' ? 'Campaign' : '达人库'}
          </button>
        ))}
      </div>
      <div className="mt-6"><DataPanel key={tab} kind={tab} /></div>
    </div>
  );
}

function useDataRecords<T>(kind: DataKind) {
  const [records, setRecords] = useState<DataRecordDTO<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRecords(await dataApi.list<T>(kind));
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [kind]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { records, loading, reload };
}

function DataPanel({ kind }: { kind: DataKind }) {
  const { records, loading, reload } = useDataRecords<Campaign & Creator>(kind);
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [editing, setEditing] = useState<DataRecordDTO | null>(null);
  const [adding, setAdding] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const empty = !loading && records.length === 0;
  const headers: string[] =
    kind === 'campaign'
      ? ['Campaign', 'Advertiser', 'Business Line', 'Platform', 'Period', 'Budget', 'Status', 'Owner', '']
      : ['Creator', 'Handle', 'Platform', 'Tier', 'Followers', 'Engagement', 'Category', 'Region', ''];

  const actions = (r: DataRecordDTO): ReactNode => (
    <div className="flex gap-2">
      <button onClick={() => setEditing(r)} className="text-xs text-accent-primary hover:underline">编辑</button>
      <button onClick={() => void del(r.id)} className="text-xs text-red hover:underline">删除</button>
    </div>
  );

  const rows: ReactNode[][] = records.map((r) => {
    const d = r.data as Campaign & Creator;
    if (kind === 'campaign') {
      return [d.name, d.advertiser, d.businessLine, d.platform, `${d.startDate} ~ ${d.endDate}`, d.budget, d.status ?? '—', r.ownerId, actions(r)];
    }
    return [d.name, d.handle, d.platform, d.tier, d.followers, d.engagement, d.category, d.region, actions(r)];
  });

  async function del(id: string) {
    if (!window.confirm('确认删除该条记录?')) return;
    await dataApi.remove(id);
    await reload();
  }
  async function clearAll() {
    if (!window.confirm(`确认清空全部 ${kind === 'campaign' ? 'Campaign' : '达人库'} 记录?此操作不可恢复。`)) return;
    await dataApi.clear(kind);
    await reload();
  }
  async function seed() {
    const items =
      kind === 'campaign'
        ? await Promise.all(
            MOCK_CAMPAIGNS.map(async (c) => ({
              ...c,
              creatorIds: ((await listCampaignCreators(c.id)) ?? []).map((cr) => cr.id),
            })),
          )
        : MOCK_CREATORS;
    const r = await dataApi.importMany(kind, items);
    window.alert(`导入完成:新增 ${r.created},更新 ${r.updated},跳过 ${r.skipped}`);
    await reload();
  }

  async function onCsv(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const sheets = await parseFile(f);
      setPreview(buildPreviewFromRows(kind, sheets[0]?.rows ?? []));
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
      setPreview(buildPreviewFromObjects(kind, arr));
    } catch {
      window.alert('JSON 格式错误');
    }
  }
  async function confirmImport(validItems: Record<string, unknown>[]) {
    setPreview(null);
    const r = await dataApi.importMany(kind, validItems);
    window.alert(`导入完成:新增 ${r.created},更新 ${r.updated},跳过 ${r.skipped}`);
    await reload();
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button onClick={() => csvRef.current?.click()} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary">导入 CSV/XLSX</button>
        <button onClick={() => jsonRef.current?.click()} className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover">导入 JSON</button>
        <button onClick={() => downloadTemplate(kind)} className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover">下载模板</button>
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
      {kind === 'campaign' ? (
        <CampaignList
          records={records as DataRecordDTO<Campaign>[]}
          loading={loading}
          onEdit={setEditing}
          onDelete={(id) => void del(id)}
        />
      ) : (
        <DataTable loading={loading} headers={headers} rows={rows} />
      )}
      {preview && (
        <ImportPreviewModal kind={kind} items={preview} onConfirm={confirmImport} onCancel={() => setPreview(null)} />
      )}
      {adding && (
        <RecordFormModal kind={kind} record={null} onSaved={async () => { setAdding(false); await reload(); }} onCancel={() => setAdding(false)} />
      )}
      {editing && (
        <RecordFormModal kind={kind} record={editing} onSaved={async () => { setEditing(null); await reload(); }} onCancel={() => setEditing(null)} />
      )}
    </div>
  );
}

/** Campaign 可展开列表:行展开 → 合作达人子表;每行带 编辑/删除。 */
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
  const heads = ['Campaign', 'Advertiser', 'Business Line', 'Platform', 'Period', 'Budget', 'Status', 'Owner', ''];
  return (
    <>
      <div className="overflow-auto rounded-lg border border-border-default">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="bg-surface-hover text-left text-xs text-foreground-muted">
              {heads.map((h, i) => (
                <th key={i} className={`px-3 py-2 font-medium ${i === 0 ? '' : 'whitespace-nowrap'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const d = r.data;
              return (
                <tr key={r.id} className="border-t border-border-subtle hover:bg-surface-hover/50">
                  <td className="px-3 py-2 font-medium text-foreground-primary">{d.name}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.advertiser}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.businessLine}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.platform}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.startDate} ~ {d.endDate}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.budget}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{d.status ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground-secondary">{r.ownerId}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
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

/** 右侧滑出浮窗:承载达人合作详情(合作达人子表 + 管理)。浏览器右侧大浮窗,Esc/✕/点遮罩关闭。 */
function CollaboratorDrawer({ record, onClose }: { record: DataRecordDTO<Campaign> | null; onClose: () => void }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!record) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current();
    }
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
          <button
            onClick={onClose}
            aria-label="关闭"
            className="ml-3 shrink-0 rounded p-1 text-foreground-secondary hover:bg-surface-hover hover:text-foreground-primary"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          <CollaboratorPanel record={record} />
        </div>
      </aside>
    </div>
  );
}

/** 展开面板:合作达人子表 + 「管理合作达人」;demo campaign 命中 mock 时达人行二级展开效果。 */
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
        if (cancelled) return;
        setCollaborators(cols);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId, tick]);

  if (loading) return <p className="text-xs text-foreground-muted">加载合作达人…</p>;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-foreground-secondary">合作达人 · {collaborators.length}</span>
        <div className="flex gap-3">
          <button
            onClick={() =>
              void importSeedCollaborations(campaignId, collaborators.map((c) => c.id)).then(() => setTick((t) => t + 1))
            }
            className="text-xs text-accent-primary hover:underline"
          >
            导入演示数据
          </button>
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
          onSaved={() => {
            setManaging(false);
            setTick((t) => t + 1);
          }}
        />
      )}
    </div>
  );
}

/** 管理合作达人:多选达人库 → 整记录重写 creatorIds(服务端 update 校验全量 data)。 */
function ManageCollaboratorsModal({
  campaignId,
  campaignData,
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
      await dataApi.update(campaignId, { ...campaignData, creatorIds: selected });
      onSaved();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-[480px] flex-col gap-3 overflow-auto rounded-xl bg-surface-primary p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
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


