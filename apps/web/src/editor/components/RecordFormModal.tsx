import { useState, useEffect, useMemo } from 'react';
import { dataApi, type DataRecordDTO } from '@/api/dataLibrary';
import { lookupApi, type BusinessLineDTO, type AdvertiserDTO } from '@/api/lookup';
import { ImageInput } from '@/components/ImageInput';
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

/** 普通 input 字段（非 select/multi-select）— 已排除 owner/status/startDate/endDate/budget */
const CAMPAIGN_INPUT_FIELDS: FieldDef[] = [
  { key: 'name', label: '名称' },
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

/* ───────── P1-10: Campaign 状态枚举 ───────── */
const CAMPAIGN_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'not_started', label: '未开始' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'paused', label: '已暂停' },
  { value: 'cancelled', label: '已取消' },
];

/* ───────── P1-9: 币种选项 ───────── */
const CURRENCY_OPTIONS: { value: string; symbol: string; label: string }[] = [
  { value: 'CNY', symbol: '¥', label: 'CNY ¥' },
  { value: 'USD', symbol: '$', label: 'USD $' },
  { value: 'EUR', symbol: '€', label: 'EUR €' },
  { value: 'JPY', symbol: '¥', label: 'JPY ¥' },
];

/* ───────── P1-13: 达人库下拉选项 ───────── */
const TIER_OPTIONS = ['S', 'A', 'B', 'C', 'D'];
const CREATOR_PLATFORM_OPTIONS = ['TikTok', 'Instagram', 'YouTube', '小红书', '抖音', '快手', 'B站'];
const CATEGORY_OPTIONS = ['美妆', '服饰', '3C', '食品', '母婴', '家居', '运动', '其他'];

/** Combobox — 可输入+可选的下拉（P1-7, P1-13） */
function Combobox({
  value,
  onChange,
  options,
  placeholder,
  allowFree,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  allowFree?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(filter.toLowerCase())),
    [options, filter],
  );
  const showCustom = allowFree && filter && !options.some((o) => o.toLowerCase() === filter.toLowerCase());
  return (
    <div className="relative">
      <input
        value={value || filter}
        placeholder={placeholder}
        onChange={(e) => {
          setFilter(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setFilter(value);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={inputCls}
      />
      {open && (
        <div className="absolute z-50 mt-0.5 max-h-48 w-full overflow-auto rounded border border-border-default bg-surface-primary shadow-lg">
          {filtered.map((o) => (
            <button
              key={o}
              type="button"
              className={`flex w-full items-center px-2 py-1 text-left text-sm hover:bg-surface-hover ${
                value === o ? 'font-medium text-accent-primary' : 'text-foreground-primary'
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(o);
                setFilter('');
                setOpen(false);
              }}
            >
              {o}
            </button>
          ))}
          {showCustom && (
            <button
              type="button"
              className="flex w-full items-center px-2 py-1 text-left text-sm text-accent-primary hover:bg-surface-hover"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(filter);
                setOpen(false);
              }}
            >
              + 添加「{filter}」
            </button>
          )}
          {filtered.length === 0 && !showCustom && (
            <span className="block px-2 py-1 text-xs text-foreground-muted">无匹配项</span>
          )}
        </div>
      )}
    </div>
  );
}

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

  // Campaign 专属：业务线/广告主/平台/状态/日期/预算/币种
  const [businessLine, setBusinessLine] = useState((initial.businessLine as string) ?? '');
  const [advertiser, setAdvertiser] = useState((initial.advertiser as string) ?? '');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(() => {
    // P1-7: 支持自定义平台（来自 platforms 数组，可能含非预设值）
    const raw = Array.isArray(initial.platforms)
      ? (initial.platforms as string[])
      : initial.platform
        ? [initial.platform as string]
        : [];
    return raw;
  });
  const [customPlatform, setCustomPlatform] = useState(''); // P1-7
  const [status, setStatus] = useState((initial.status as string) ?? ''); // P1-10
  const [startDate, setStartDate] = useState((initial.startDate as string) ?? ''); // P1-8
  const [endDate, setEndDate] = useState((initial.endDate as string) ?? ''); // P1-8
  const [budgetAmount, setBudgetAmount] = useState(() => { // P1-9
    const raw = (initial.budget as string) ?? '';
    return raw.replace(/^[\$\¥€£]/, '').replace(/^(CNY|USD|EUR|JPY)\s*/, '').trim();
  });
  const [currency, setCurrency] = useState(() => { // P1-9
    const raw = (initial.budget as string) ?? '';
    if (/^\$/.test(raw)) return 'USD';
    if (/^€/.test(raw)) return 'EUR';
    if (/^¥/.test(raw)) return 'CNY';
    if (/^CNY/i.test(raw)) return 'CNY';
    if (/^USD/i.test(raw)) return 'USD';
    if (/^EUR/i.test(raw)) return 'EUR';
    if (/^JPY/i.test(raw)) return 'JPY';
    return 'CNY';
  });
  const [owner, setOwner] = useState((initial.owner as string) ?? ''); // P1-11

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

  function addCustomPlatform() {
    const v = customPlatform.trim();
    if (!v || selectedPlatforms.includes(v)) return;
    setSelectedPlatforms((prev) => [...prev, v]);
    setCustomPlatform('');
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
        // P1-8: 日期
        fieldEdits.startDate = startDate;
        fieldEdits.endDate = endDate;
        // P1-9: 预算（币种+金额）
        const sym = CURRENCY_OPTIONS.find((c) => c.value === currency)?.symbol ?? '';
        fieldEdits.budget = budgetAmount ? `${sym}${budgetAmount}` : '';
        fieldEdits.budgetCurrency = currency;
        // P1-10: 状态
        fieldEdits.status = status;
        // P1-11: 归属者
        fieldEdits.owner = owner;
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

            {/* P1-7: 平台 → 多选预设 + 可手动添加 */}
            <div className="col-span-2 flex flex-col gap-1 text-xs text-foreground-secondary">
              平台（可多选，支持手动新增）
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
                {/* 自定义平台 chip（非预设的已选中平台） */}
                {selectedPlatforms
                  .filter((p) => !PLATFORMS.includes(p))
                  .map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePlatform(p)}
                      className="rounded-full border border-accent-primary bg-accent-primary/10 px-2.5 py-0.5 text-xs text-accent-primary"
                    >
                      {p} ✕
                    </button>
                  ))}
              </div>
              {/* 手动添加平台 */}
              <div className="mt-1 flex gap-1">
                <input
                  value={customPlatform}
                  onChange={(e) => setCustomPlatform(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomPlatform();
                    }
                  }}
                  placeholder="输入新平台名后按回车"
                  className={`${inputCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={addCustomPlatform}
                  className="shrink-0 rounded border border-border-default px-2 py-1 text-xs text-foreground-secondary hover:bg-surface-hover"
                >
                  + 添加
                </button>
              </div>
            </div>

            {/* P1-8: 开始日期 → DatePicker */}
            <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
              开始日期
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputCls}
              />
            </label>

            {/* P1-8: 结束日期 → DatePicker */}
            <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
              结束日期
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputCls}
              />
            </label>

            {/* P1-9: 预算 + 币种 */}
            <div className="col-span-2 flex gap-1">
              <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
                币种
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className={`${selectCls} w-28`}
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-1 flex-col gap-1 text-xs text-foreground-secondary">
                预算金额
                <input
                  type="number"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  placeholder="如 300000"
                  className={inputCls}
                />
              </label>
            </div>

            {/* P1-10: 状态 → 枚举下拉 */}
            <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
              状态
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={selectCls}
              >
                <option value="">（请选择）</option>
                {CAMPAIGN_STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            {/* P1-11: 归属者 */}
            <label className="flex flex-col gap-1 text-xs text-foreground-secondary">
              归属者
              <input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="如 alex"
                className={inputCls}
              />
            </label>
          </div>
        ) : (
          /* ─── Creator 表单 ─── */
          <div className="grid grid-cols-2 gap-2">
            {CREATOR_FORM_FIELDS.map((f) => {
              // avatar 用 ImageInput（文本 + 上传 + 裁剪），占整行。
              if (f.key === 'avatar') {
                return (
                  <label key={f.key} className="col-span-2 flex flex-col gap-1 text-xs text-foreground-secondary">
                    {f.label}
                    <ImageInput
                      value={vals[f.key] ?? ''}
                      onChange={(url) => setVals((p) => ({ ...p, [f.key]: url }))}
                      aspect={1}
                    />
                  </label>
                );
              }
              // P1-13: 层级 → 下拉
              if (f.key === 'tier') {
                return (
                  <label key={f.key} className="flex flex-col gap-1 text-xs text-foreground-secondary">
                    {f.label}
                    <Combobox
                      value={vals[f.key] ?? ''}
                      onChange={(v) => setVals((p) => ({ ...p, tier: v }))}
                      options={TIER_OPTIONS}
                      placeholder="S / A / B / C / D"
                    />
                  </label>
                );
              }
              // P1-13: 平台 → 下拉（可手动新增）
              if (f.key === 'platform') {
                return (
                  <label key={f.key} className="flex flex-col gap-1 text-xs text-foreground-secondary">
                    {f.label}
                    <Combobox
                      value={vals[f.key] ?? ''}
                      onChange={(v) => setVals((p) => ({ ...p, platform: v }))}
                      options={CREATOR_PLATFORM_OPTIONS}
                      placeholder="选择或输入平台"
                      allowFree
                    />
                  </label>
                );
              }
              // P1-13: 品类 → 下拉（可手动新增）
              if (f.key === 'category') {
                return (
                  <label key={f.key} className="flex flex-col gap-1 text-xs text-foreground-secondary">
                    {f.label}
                    <Combobox
                      value={vals[f.key] ?? ''}
                      onChange={(v) => setVals((p) => ({ ...p, category: v }))}
                      options={CATEGORY_OPTIONS}
                      placeholder="选择或输入品类"
                      allowFree
                    />
                  </label>
                );
              }
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
