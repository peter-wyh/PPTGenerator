import { useState } from 'react';
import { dataApi, type DataRecordDTO } from '@/api/dataLibrary';
import type { DataKind } from '../dataImport';

interface Props {
  kind: DataKind;
  record: DataRecordDTO | null;
  onSaved: () => void;
  onCancel: () => void;
}

interface FieldDef {
  key: string;
  label: string;
}

const CAMPAIGN_FORM_FIELDS: FieldDef[] = [
  { key: 'id', label: 'Campaign ID' },
  { key: 'name', label: '名称' },
  { key: 'advertiser', label: '广告主' },
  { key: 'businessLine', label: '业务线' },
  { key: 'platform', label: '平台' },
  { key: 'startDate', label: '开始日期' },
  { key: 'endDate', label: '结束日期' },
  { key: 'budget', label: '预算' },
  { key: 'status', label: '状态' },
  { key: 'owner', label: 'Owner' },
];
const CREATOR_FORM_FIELDS: FieldDef[] = [
  { key: 'id', label: '达人 ID' },
  { key: 'name', label: '名称' },
  { key: 'handle', label: 'Handle' },
  { key: 'platform', label: '平台' },
  { key: 'tier', label: '层级' },
  { key: 'followers', label: '粉丝' },
  { key: 'engagement', label: '互动率' },
  { key: 'category', label: '品类' },
  { key: 'region', label: '地区' },
  { key: 'avatar', label: '头像 URL' },
];

/** 新增/编辑记录表单。新增时自动生成 id(只读)。 */
export function RecordFormModal({ kind, record, onSaved, onCancel }: Props) {
  const fields = kind === 'campaign' ? CAMPAIGN_FORM_FIELDS : CREATOR_FORM_FIELDS;
  const initial = (record?.data ?? {}) as Record<string, string>;
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const f of fields) o[f.key] = initial[f.key] ?? '';
    if (!record) {
      const prefix = kind === 'campaign' ? 'camp-' : 'cre-';
      o.id = `${prefix}${crypto.randomUUID().slice(0, 8)}`;
    }
    return o;
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const data: Record<string, unknown> = {};
      for (const f of fields) {
        const v = vals[f.key];
        if (v !== '') data[f.key] = v;
      }
      if (record) await dataApi.update(record.id, data);
      else await dataApi.create(kind, data);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="flex max-h-[90vh] w-[560px] flex-col gap-3 overflow-auto rounded-xl bg-surface-primary p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-headings text-sm font-semibold text-foreground-primary">
          {record ? '编辑' : '新增'} · {kind === 'campaign' ? 'Campaign' : '达人库'}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {fields.map((f) => {
            const autoId = f.key === 'id' && !record;
            return (
              <label key={f.key} className="flex flex-col gap-1 text-xs text-foreground-secondary">
                {f.label}{autoId ? '(自动)' : ''}
                <input
                  value={vals[f.key] ?? ''}
                  disabled={autoId}
                  onChange={(e) => setVals((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary disabled:opacity-50"
                />
              </label>
            );
          })}
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            取消
          </button>
          <button
            disabled={busy}
            onClick={() => void save()}
            className="rounded bg-accent-primary px-3 py-1 text-xs text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
