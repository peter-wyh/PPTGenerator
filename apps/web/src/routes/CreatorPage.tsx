/**
 * 达人库数据管理页面 —— 列表、CRUD、达人详情。
 * 从 DataManagement.tsx 拆出的独立路由页面（/data/creators）。
 *
 * Phase A: 列表读取走真实 DB Creator 表（/api/v1/campaigns/creators），
 * 扩展字段（audience/works/stats/bio/tags/contact/rate）从 DB JSON 列直接读取。
 * CRUD/导入保留走 dataApi 以兼容现有功能。
 */
import { useCallback, useEffect, useRef, useState, type ReactNode, type ChangeEvent } from 'react';
import type { Creator } from '@mediakit/shared';
import { listCreators } from '@/api/creators';
import { dataApi, type DataRecordDTO } from '@/api/dataLibrary';
import { campaignsApi } from '@/api/campaignsApi';
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
import { toast } from '../components/Toast';

export function CreatorPage() {
  const { records, loading, reload } = useCreatorRecords();
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [previewKind, setPreviewKind] = useState<'creator' | 'creatorAudience' | 'creatorWorks'>('creator');
  const [editing, setEditing] = useState<DataRecordDTO | null>(null);
  const [adding, setAdding] = useState(false);
  const [detailCreator, setDetailCreator] = useState<Creator | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const audienceCsvRef = useRef<HTMLInputElement>(null);
  const worksCsvRef = useRef<HTMLInputElement>(null);

  const empty = !loading && records.length === 0;
  void empty;
  const headers = ['Creator', 'Handle', 'Platform', 'Tier', 'Followers', 'Engagement', 'Category', 'Region', '近90天作品', '互动中位数', ''];

  const actions = (c: Creator): ReactNode => (
    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() =>
          setEditing({
            id: c.id,
            kind: 'CREATOR' as const,
            ownerId: '',
            data: c as unknown as Record<string, unknown>,
            createdAt: '',
            updatedAt: '',
          })
        }
        className="text-xs text-accent-primary hover:underline"
      >
        编辑
      </button>
      <button onClick={() => void del(c.id)} className="text-xs text-red hover:underline">
        删除
      </button>
    </div>
  );

  const rows: ReactNode[][] = records.map((d) => {
    // recentPostsCount / engagementMedian 在 JSON 列里已有（seed-creator-extension）。
    // 真实数据缺失时显示「—」——禁止前端派生伪造数据（审计 #14/#15）。
    const recentPosts = d.recentPostsCount ?? '—';
    const engMedian = d.engagementMedian ?? '—';
    return [
      (
        <div key="n" className="flex items-center gap-2">
          <CreatorAvatar name={d.name} avatar={d.avatar} size={28} />
          <div className="min-w-0">
            <div>{d.name}</div>
            {d.profileUrl && (
              <a
                href={d.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-[10px] text-accent-primary hover:underline"
              >
                {d.profileUrl}
              </a>
            )}
          </div>
        </div>
      ),
      d.handle,
      d.platform,
      d.tier,
      d.followers,
      d.engagement,
      d.category,
      d.region,
      recentPosts,
      engMedian,
      actions(d),
    ];
  });

  async function del(id: string) {
    if (!window.confirm('确认删除该达人?')) return;
    try {
      await dataApi.remove(id);
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
      setPreviewKind('creator');
      setPreview(buildPreviewFromRows('creator', sheets[0]?.rows ?? []));
    } catch {
      window.alert('文件解析失败');
    }
  }

  async function onCsvAudience(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const sheets = await parseFile(f);
      setPreviewKind('creatorAudience');
      setPreview(buildPreviewFromRows('creatorAudience', sheets[0]?.rows ?? []));
    } catch {
      window.alert('文件解析失败');
    }
  }

  async function onCsvWorks(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const sheets = await parseFile(f);
      setPreviewKind('creatorWorks');
      setPreview(buildPreviewFromRows('creatorWorks', sheets[0]?.rows ?? []));
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
      setPreview(buildPreviewFromObjects('creator', arr));
    } catch {
      window.alert('JSON 格式错误');
    }
  }

  async function confirmImport(validItems: Record<string, unknown>[]) {
    const k = previewKind;
    try {
      if (k === 'creator') {
        const r = await dataApi.importMany('creator', validItems);
        toast.success(`导入完成:新增 ${r.created},更新 ${r.updated},跳过 ${r.skipped}`);
      } else if (k === 'creatorAudience') {
        const r = await campaignsApi.importCreatorAudience(validItems);
        toast.success(`画像导入完成:更新 ${r.updated},跳过 ${r.skipped}`);
      } else if (k === 'creatorWorks') {
        const r = await campaignsApi.importCreatorWorks(validItems);
        toast.success(`作品导入完成:更新 ${r.updated},跳过 ${r.skipped}`);
      }
      setPreview(null);
      await reload();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '导入失败');
      // 不关闭预览 modal，让用户可以重试
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          onClick={() => csvRef.current?.click()}
          className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary"
        >
          导入达人 CSV/XLSX
        </button>
        <button
          onClick={() => audienceCsvRef.current?.click()}
          className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
        >
          导入受众画像
        </button>
        <button
          onClick={() => worksCsvRef.current?.click()}
          className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
        >
          导入达人作品
        </button>
        <button
          onClick={() => jsonRef.current?.click()}
          className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
        >
          导入 JSON
        </button>
        <select
          onChange={(e) => { if (e.target.value) downloadTemplate(e.target.value as 'creator' | 'creatorAudience' | 'creatorWorks'); e.target.value = ''; }}
          className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
          defaultValue=""
        >
          <option value="" disabled>下载模板</option>
          <option value="creator">达人基础模板</option>
          <option value="creatorAudience">受众画像模板</option>
          <option value="creatorWorks">达人作品模板</option>
        </select>
        <button
          onClick={() => setAdding(true)}
          className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
        >
          新增
        </button>
        <input ref={csvRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onCsv} />
        <input ref={audienceCsvRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onCsvAudience} />
        <input ref={worksCsvRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onCsvWorks} />
        <input ref={jsonRef} type="file" accept=".json,application/json" className="hidden" onChange={onJson} />
      </div>
      <DataTable
        loading={loading}
        headers={headers}
        rows={rows}
        onRowClick={(i) => {
          const raw = records[i];
          // DB JSON 列已经有完整扩展字段（audience/works/stats/bio/tags/contact/rate）
          setDetailCreator(raw);
        }}
      />
      {preview && (
        <ImportPreviewModal
          kind={previewKind}
          items={preview}
          onConfirm={confirmImport}
          onCancel={() => setPreview(null)}
        />
      )}
      {adding && (
        <RecordFormModal
          kind="creator"
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
          kind="creator"
          record={editing}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      {detailCreator && (
        <CreatorDetailDrawer creator={detailCreator} onClose={() => setDetailCreator(null)} />
      )}
    </div>
  );
}

/* ========================= Hook ========================= */

/** 列表数据走真实 DB Creator 表（campaignsApi），含所有扩展 JSON 字段。 */
function useCreatorRecords() {
  const [records, setRecords] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRecords(await listCreators());
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
