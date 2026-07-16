import { useState, useEffect } from 'react';
import { dataApi, type DataRecordDTO } from '@/api/dataLibrary';
import { lookupApi, type BusinessLineDTO, type AdvertiserDTO } from '@/api/lookup';
import { PLATFORMS } from '@/projectsMeta';
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

/** 普通 input 字段（非 select/multi-select） */
const CAMPAIGN_INPUT_FIELDS: FieldDef[] = [
  { key: 'name', label: '名称' },
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

const selectCls =
  'w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary disabled:opacity-50 outline-none focus:border-accent-primary';

const inputCls =
  'w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-sm text-foreground-primary disabled:opacity-50';

/** 新增/编辑记录表单。 */
export function RecordFormModal({ kind, record, onSaved, onCancel }: Props) {
  const isCampaign = kind === 'campaign';
  const fields = isCampaign ? CAMPAIGN_INPUT_FIELDS : CREATOR_FORM_FIELDS;
  const initial = (record?.data ?? {}) as Record<string, unknown>;
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const f of fields) o[f.key] = (initial[f.key] as string) ?? '';
    if (!record && kind === 'creator') {
      o.id = `cre-${crypto.randomUUID().slice(0, 8)}`;
    }
    return o;
  });

  // Campaign 专属：业务线/广告主/平台
  const [businessLine, setBusinessLine] = useState((initial.businessLine as string) ?? '');
  const [advertiser, setAdvertiser] = useState((initial.advertiser as string) ?? '');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    Array.isArray(initial.platforms)
      ? (initial.platforms as string[])
      : initial.platform
        ? [initial.platform as string]
        : [],
  );

  // lookup 数据
  const [blOptions, setBlOptions] = useState<BusinessLineDTO[]>([]);
  const [advOptions, setAdvOptions] = useState<AdvertiserDTO[]>([]);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isCampaign) return;
    lookupApi.listBusinessLines().then(setBlOptions).catch(() => {});
  }, [isCampaign]);

  // 业务线变化时拉取对应广告主
  useEffect(() => {
    if (!isCampaign || !businessLine) {
      setAdvOptions([]);
      return;
    }
    const bl = blOptions.find((b) => b.code === businessLine);
    lookupApi
      .listAdvertisers(bl ? { businessLineId: bl.id } : {})
      .then(setAdvOptions)
      .catch(() => setAdvOptions([]));
  }, [isCampaign, businessLine, blOptions]);

  function togglePlatform(p: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  async function save() {
    setBusy(true);
    try {
      const fieldEdits: Record<string, unknown> = {};
      for (const f of fields) {
        const v = vals[f.key];
        if (v !== '') fieldEdits[f.key] = v;
      }
      if (isCampaign) {
        fieldEdits.businessLine = businessLine;
        fieldEdits.advertiser = advertiser;
        // platform 存数组（多选），同时保留单个 platform 字段做向后兼容
        fieldEdits.platforms = selectedPlatforms;
        fieldEdits.platform = selectedPlatforms[0] ?? '';
      }
      const data = record ? { ...(record.data as object), ...fieldEdits } : fieldEdits;
      if (record) await dataApi.update(record.id, data);
      else await dataApi.create(kind, data);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = isCampaign
    ? !!vals.name && !!businessLine && !!advertiser
    : !!vals.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="flex max-h-[90vh] w-[560px] flex-col gap-3 overflow-auto rounded-xl bg-surface-primary p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-headings text-sm font-semibold text-foreground-primary">
          {record ? '编辑' : '新增'} · {isCampaign ? 'Campaign' : '达人库'}
        </div>

        {isCampaign ? (
          /* ─── Campaign 表单 ─── */
          <div className="grid grid-cols-2 gap-2">
            {/* 名称占整行 */}
            <label className="col-span-2 flex flex-col gap-1 text-xs text-foreground-secondary">
              名称
              <input
                value={vals.name ?? ''}
                onChange={(e) => setVals((p) => ({ ...p, name: e.target.value }))}
                className={inputCls}
              />
            </label>

            {/* 业务线 → 选择框 */}
            <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
              业务线
              <select
                value={businessLine}
                onChange={(e) => {
                  setBusinessLine(e.target.value);
                  setAdvertiser('');
                }}
                className={selectCls}
              >
                <option value="">（请选择）</option>
                {blOptions.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.code} · {b.name}
                  </option>
                ))}
              </select>
            </label>

            {/* 广告主 → 选择框（联动业务线） */}
            <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
              广告主
              <select
                value={advertiser}
                onChange={(e) => setAdvertiser(e.target.value)}
                disabled={!businessLine}
                className={selectCls}
              >
                <option value="">{businessLine ? '（请选择）' : '请先选业务线'}</option>
                {advOptions.map((a) => (
                  <option key={a.id} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>

            {/* 平台 → 多选 */}
            <div className="col-span-2 flex flex-col gap-1 text-xs text-foreground-secondary">
              平台（可多选）
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map((p) => {
                  const active = selectedPlatforms.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePlatform(p)}
                      className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
                        active
                          ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                          : 'border-border-default text-foreground-secondary hover:bg-surface-hover'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 普通文本字段 */}
            {fields
              .filter((f) => f.key !== 'name')
              .map((f) => (
                <label key={f.key} className="flex flex-col gap-1 text-xs text-foreground-secondary">
                  {f.label}
                  <input
                    value={vals[f.key] ?? ''}
                    onChange={(e) => setVals((p) => ({ ...p, [f.key]: e.target.value }))}
                    className={inputCls}
                  />
                </label>
              ))}
          </div>
        ) : (
          /* ─── Creator 表单（保持不变） ─── */
          <div className="grid grid-cols-2 gap-2">
            {fields.map((f) => {
              const idReadOnly = f.key === 'id' && !record;
              const autoLabel = f.key === 'id' && !record;
              return (
                <label key={f.key} className="flex flex-col gap-1 text-xs text-foreground-secondary">
                  {f.label}{autoLabel ? '(自动)' : ''}
                  <input
                    value={vals[f.key] ?? ''}
                    disabled={idReadOnly}
                    placeholder={f.key === 'id' && !record ? '保存时自动生成' : undefined}
                    onChange={(e) => setVals((p) => ({ ...p, [f.key]: e.target.value }))}
                    className={inputCls}
                  />
                </label>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded border border-border-default px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
          >
            取消
          </button>
          <button
            disabled={busy || !canSubmit}
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
