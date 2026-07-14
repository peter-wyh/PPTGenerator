import { useCallback, useEffect, useRef, useState, type ReactNode, type ChangeEvent } from 'react';
import type { Campaign, Creator } from '@mediakit/shared';
import { MOCK_CAMPAIGNS } from '@/api/mock/campaigns';
import { MOCK_CREATORS } from '@/api/mock/creators';
import { dataApi, type DataRecordDTO } from '@/api/dataLibrary';
import { DataTable } from '@/components/DataTable';
import { ImportPreviewModal } from '@/editor/components/ImportPreviewModal';
import { RecordFormModal } from '@/editor/components/RecordFormModal';
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
    const items = kind === 'campaign' ? MOCK_CAMPAIGNS : MOCK_CREATORS;
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
      <DataTable loading={loading} headers={headers} rows={rows} />
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
