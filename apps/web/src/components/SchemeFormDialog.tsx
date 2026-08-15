import { useEffect, useState } from 'react';
import type {
  CreateReportSchemeInput,
  ReportScheme,
  UpdateReportSchemeInput,
} from '@mediakit/shared';
import { Button } from './Button';
import { Input } from './Input';

import { STYLE_PRESETS } from '@mediakit/shared';
import { useBusinessLineCodes } from '@/editor/useBusinessLineLogo';

const selectCls =
  'w-full rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-foreground-primary outline-none focus:border-accent-primary';

export interface SchemeFormInitial {
  code: string;
  name: string;
  description: string;
  businessLineCode: string;
  pageCount: number;
  sortOrder: number;
  defaultStyle: string;
  enabled: boolean;
}

export interface SchemeFormValues {
  code: string;
  name: string;
  description?: string;
  businessLineCode?: string;
  pageCount: number;
  sortOrder: number;
  defaultStyle?: string;
  enabled: boolean;
}

interface Props {
  open: boolean;
  loading?: boolean;
  error?: string | null;
  /** 编辑模式时传入初始值；不传为新建模式。 */
  initial?: SchemeFormInitial | null;
  title?: string;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (values: SchemeFormValues) => void;
}

const EMPTY: SchemeFormInitial = {
  code: '',
  name: '',
  description: '',
  businessLineCode: '',
  pageCount: 8,
  sortOrder: 0,
  defaultStyle: '',
  enabled: true,
};

/** 新建/编辑方案表单。 */
export function SchemeFormDialog({
  open,
  loading,
  error,
  initial,
  title = '新建方案',
  submitLabel = '创建',
  onCancel,
  onSubmit,
}: Props) {
  const BUSINESS_LINES = useBusinessLineCodes(); // 数据库唯一来源
  const [form, setForm] = useState<SchemeFormInitial>(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm(initial ?? EMPTY);
  }, [open, initial]);

  if (!open) return null;

  const update = <K extends keyof SchemeFormInitial>(key: K, value: SchemeFormInitial[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    const values: SchemeFormValues = {
      code: form.code.trim(),
      name: form.name.trim(),
      pageCount: Number(form.pageCount) || 8,
      sortOrder: Number(form.sortOrder) || 0,
      enabled: form.enabled,
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      ...(form.businessLineCode ? { businessLineCode: form.businessLineCode } : {}),
      ...(form.defaultStyle ? { defaultStyle: form.defaultStyle } : {}),
    };
    onSubmit(values);
  };

  const canSubmit = form.code.trim().length > 0 && form.name.trim().length > 0 && !loading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => !loading && onCancel()}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-auto rounded-xl bg-surface-primary p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3 className="font-headings text-base font-semibold text-foreground-primary">{title}</h3>

        <div className="mt-4 space-y-3">
          <Input
            label="方案编码 (code)"
            value={form.code}
            autoFocus
            onChange={(e) => update('code', e.target.value)}
            placeholder="如：dm-biweekly（小写字母/数字/连字符）"
          />
          <Input
            label="方案名称"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="如：DM 双周报"
          />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-foreground-secondary">
              描述（可选）
            </span>
            <textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="方案用途说明"
              rows={2}
              className="w-full resize-none rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-foreground-primary outline-none focus:border-accent-primary"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground-secondary">业务线</span>
              <select
                value={form.businessLineCode}
                onChange={(e) => update('businessLineCode', e.target.value)}
                className={selectCls}
              >
                <option value="">不指定（通用）</option>
                {BUSINESS_LINES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground-secondary">
                默认风格预设
              </span>
              <select
                value={form.defaultStyle}
                onChange={(e) => update('defaultStyle', e.target.value)}
                className={selectCls}
              >
                <option value="">不指定</option>
                {STYLE_PRESETS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name}（{p.key}）
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="页数"
              type="number"
              min={1}
              max={200}
              value={form.pageCount}
              onChange={(e) => update('pageCount', Number(e.target.value))}
            />
            <Input
              label="排序权重"
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(e) => update('sortOrder', Number(e.target.value))}
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => update('enabled', e.target.checked)}
              className="h-4 w-4 rounded border-border-default"
            />
            <span className="text-sm text-foreground-secondary">启用</span>
          </label>
        </div>

        {error && <p className="mt-3 text-xs text-red">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            取消
          </Button>
          <Button onClick={submit} loading={loading} disabled={!canSubmit}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** ReportScheme → 表单初始值。 */
export function toFormInitial(s: ReportScheme): SchemeFormInitial {
  return {
    code: s.code,
    name: s.name,
    description: s.description ?? '',
    businessLineCode: s.businessLineCode ?? '',
    pageCount: s.pageCount,
    sortOrder: s.sortOrder,
    defaultStyle: s.defaultStyle ?? '',
    enabled: s.enabled,
  };
}

/** SchemeFormValues → 创建入参。 */
export function toCreateInput(v: SchemeFormValues): CreateReportSchemeInput {
  return {
    code: v.code,
    name: v.name,
    pageCount: v.pageCount,
    sortOrder: v.sortOrder,
    enabled: v.enabled,
    ...(v.description ? { description: v.description } : {}),
    ...(v.businessLineCode ? { businessLineCode: v.businessLineCode } : {}),
    ...(v.defaultStyle ? { defaultStyle: v.defaultStyle } : {}),
  };
}

/** SchemeFormValues → 更新入参。 */
export function toUpdateInput(v: SchemeFormValues): UpdateReportSchemeInput {
  return {
    code: v.code,
    name: v.name,
    pageCount: v.pageCount,
    sortOrder: v.sortOrder,
    enabled: v.enabled,
    description: v.description || null,
    businessLineCode: v.businessLineCode || null,
    defaultStyle: v.defaultStyle || null,
  };
}
