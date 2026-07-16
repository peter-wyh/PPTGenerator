/**
 * 达人库数据管理页面 —— 列表、CRUD、达人详情。
 * 从 DataManagement.tsx 拆出的独立路由页面（/data/creators）。
 */
import { useCallback, useEffect, useRef, useState, type ReactNode, type ChangeEvent } from 'react';
import type { Creator } from '@mediakit/shared';
import { MOCK_CREATORS } from '@/api/mock/creators';
import { dataApi, type DataRecordDTO } from '@/api/dataLibrary';
import { DataTable } from '@/components/DataTable';
import { CreatorAvatar } from '@/components/CreatorAvatar';
import { CreatorDetailDrawer } from '@/editor/components/CreatorDetailDrawer';
import { ImportPreviewModal } from '@/editor/components/ImportPreviewModal';
import { RecordFormModal } from '@/editor/components/RecordFormModal';
import {
  buildPreviewFromRows,
  buildPreviewFromObjects,
  downloadTemplate,
  type PreviewItem,
} from '@/editor/dataImport';
import { parseFile } from '@/editor/datasource/parse';

export function CreatorPage() {
  const { records, loading, reload } = useCreatorRecords();
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [editing, setEditing] = useState<DataRecordDTO | null>(null);
  const [adding, setAdding] = useState(false);
  const [detailCreator, setDetailCreator] = useState<Creator | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const empty = !loading && records.length === 0;
  const headers = ['Creator', 'Handle', 'Platform', 'Tier', 'Followers', 'Engagement', 'Category', 'Region', ''];

  const actions = (r: DataRecordDTO): ReactNode => (
    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setEditing(r)} className="text-xs text-accent-primary hover:underline">编辑</button>
      <button onClick={() => void del(r.id)} className="text-xs text-red hover:underline">删除</button>
    </div>
  );

  const rows: ReactNode[][] = records.map((r) => {
    const d = r.data as Creator;
    return [
      (
        <div key="n" className="flex items-center gap-2">
          <CreatorAvatar name={d.name} avatar={d.avatar} size={28} />
          <span>{d.name}</span>
        </div>
      ),
      d.handle, d.platform, d.tier, d.followers, d.engagement, d.category, d.region, actions(r),
    ];
  });

  async function del(id: string) {
    if (!window.confirm('确认删除该达人?')) return;
    await dataApi.remove(id);
    await reload();
  }
  async function clearAll() {
    if (!window.confirm('确认清空全部达人库记录?此操作不可恢复。')) return;
    await dataApi.clear('creator');
    await reload();
  }
  async function seed() {
    const r = await dataApi.importMany('creator', MOCK_CREATORS);
    window.alert(`导入完成:新增 ${r.created},更新 ${r.updated},跳过 ${r.skipped}`);
    await reload();
  }

  async function onCsv(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const sheets = await parseFile(f);
      setPreview(buildPreviewFromRows('creator', sheets[0]?.rows ?? []));
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
      setPreview(buildPreviewFromObjects('creator', arr));
    } catch {
      window.alert('JSON 格式错误');
    }
  }
  async function confirmImport(validItems: Record<string, unknown>[]) {
    setPreview(null);
    const r = await dataApi.importMany('creator', validItems);
    window.alert(`导入完成:新增 ${r.created},更新 ${r.updated},跳过 ${r.skipped}`);
    await reload();
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button onClick={() => csvRef.current?.click()} className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary">导入 CSV/XLSX</button>
        <button onClick={() => jsonRef.current?.click()} className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover">导入 JSON</button>
        <button onClick={() => downloadTemplate('creator')} className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover">下载模板</button>
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
      <DataTable
        loading={loading}
        headers={headers}
        rows={rows}
        onRowClick={(i) => setDetailCreator(records[i].data as Creator)}
      />
      {preview && (
        <ImportPreviewModal kind="creator" items={preview} onConfirm={confirmImport} onCancel={() => setPreview(null)} />
      )}
      {adding && (
        <RecordFormModal kind="creator" record={null} onSaved={async () => { setAdding(false); await reload(); }} onCancel={() => setAdding(false)} />
      )}
      {editing && (
        <RecordFormModal kind="creator" record={editing} onSaved={async () => { setEditing(null); await reload(); }} onCancel={() => setEditing(null)} />
      )}
      {detailCreator && (
        <CreatorDetailDrawer creator={detailCreator} onClose={() => setDetailCreator(null)} />
      )}
    </div>
  );
}

/* ========================= Hook ========================= */

function useCreatorRecords() {
  const [records, setRecords] = useState<DataRecordDTO<Creator>[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRecords(await dataApi.list<Creator>('creator'));
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { records, loading, reload };
}
