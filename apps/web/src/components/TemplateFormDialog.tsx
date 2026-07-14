import { useEffect, useState } from 'react';
import type { ProjectMeta, Scenario, TemplateStatus } from '@mediakit/shared';
import { Button } from './Button';
import { Input } from './Input';
import { BUSINESS_LINES, SCENARIOS, TEMPLATE_TYPES } from '@/projectsMeta';

interface SizePreset {
  id: string;
  label: string;
  hint: string;
  w: number;
  h: number;
}

const PRESETS: SizePreset[] = [
  { id: '1280x720', label: '1280 × 720', hint: '横版 · 投放报告', w: 1280, h: 720 },
  { id: '1920x1080', label: '1920 × 1080', hint: '宽屏', w: 1920, h: 1080 },
  { id: '1024x768', label: '1024 × 768', hint: '标准 4:3', w: 1024, h: 768 },
  { id: '1080x1920', label: '1080 × 1920', hint: '竖版', w: 1080, h: 1920 },
];

const selectCls =
  'w-full rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-foreground-primary outline-none focus:border-accent-primary';

export interface TemplateFormInitial {
  name: string;
  width: number;
  height: number;
  businessLine?: string;
  scenario?: Scenario;
  templateType?: string;
  note?: string | null;
  status?: TemplateStatus;
}

export interface TemplateFormValues {
  name: string;
  width: number;
  height: number;
  meta: ProjectMeta;
  note?: string;
  status?: TemplateStatus;
}

interface Props {
  open: boolean;
  loading?: boolean;
  error?: string | null;
  /** 编辑模式时传入初始值；不传为新建模式（新建固定 DRAFT，不显示状态）。 */
  initial?: TemplateFormInitial | null;
  title?: string;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (values: TemplateFormValues) => void;
}

/** 新建/编辑模板表单：名称 + 尺寸预设 + 业务线/场景分类 + 设计师备注（+ 状态，仅编辑）。 */
export function TemplateFormDialog({
  open,
  loading,
  error,
  initial,
  title = '新建模板',
  submitLabel = '创建',
  onCancel,
  onSubmit,
}: Props) {
  const editMode = !!initial;
  const [name, setName] = useState('');
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [businessLine, setBusinessLine] = useState('');
  const [scenario, setScenario] = useState<Scenario | ''>('');
  const [templateType, setTemplateType] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<TemplateStatus>('DRAFT');

  // 打开或切换初始值时同步本地表单。
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      const matched = PRESETS.find((p) => p.w === initial.width && p.h === initial.height);
      setPresetId(matched?.id ?? 'custom');
      setBusinessLine(initial.businessLine ?? '');
      setScenario(initial.scenario ?? '');
      setTemplateType(initial.templateType ?? '');
      setNote(initial.note ?? '');
      setStatus(initial.status ?? 'DRAFT');
    } else {
      setName('');
      setPresetId(PRESETS[0].id);
      setBusinessLine('');
      setScenario('');
      setTemplateType('');
      setNote('');
      setStatus('DRAFT');
    }
  }, [open, initial]);

  if (!open) return null;

  const submit = () => {
    const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
    const meta: ProjectMeta = {};
    if (businessLine) meta.businessLine = businessLine;
    if (scenario) meta.scenario = scenario as Scenario;
    if (templateType) meta.templateType = templateType;
    onSubmit({
      name: name.trim(),
      width: preset.w,
      height: preset.h,
      meta,
      note: note.trim() || undefined,
      // 新建固定 DRAFT（后端忽略 status）；编辑透传状态。
      ...(editMode ? { status } : {}),
    });
  };

  const canSubmit = name.trim().length > 0 && !loading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => !loading && onCancel()}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-xl bg-surface-primary p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3 className="font-headings text-base font-semibold text-foreground-primary">{title}</h3>

        <div className="mt-4 space-y-3">
          <Input
            label="模板名称"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="如：投放周报 · 通用模板"
          />

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-foreground-secondary">尺寸</span>
            <select value={presetId} onChange={(e) => setPresetId(e.target.value)} className={selectCls}>
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} · {p.hint}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground-secondary">业务线</span>
              <select value={businessLine} onChange={(e) => setBusinessLine(e.target.value)} className={selectCls}>
                <option value="">不指定</option>
                {BUSINESS_LINES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground-secondary">场景</span>
              <select
                value={scenario}
                onChange={(e) => {
                  setScenario(e.target.value as Scenario | '');
                  setTemplateType('');
                }}
                className={selectCls}
              >
                <option value="">不指定</option>
                {SCENARIOS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {scenario && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground-secondary">模版类型</span>
              <select
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value)}
                className={selectCls}
              >
                <option value="">不指定</option>
                {TEMPLATE_TYPES[scenario].map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-foreground-secondary">
              设计师备注（可选）
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="仅管理后台可见，如适用场景说明"
              rows={2}
              className={`w-full resize-none rounded-lg border border-border-default bg-surface-primary px-3 py-2 text-sm text-foreground-primary outline-none focus:border-accent-primary`}
            />
          </label>

          {editMode && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground-secondary">状态</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TemplateStatus)}
                className={selectCls}
              >
                <option value="DRAFT">草稿（仅 ADMIN 可见）</option>
                <option value="PUBLISHED">已发布（BD 可基于此创建项目）</option>
              </select>
            </label>
          )}
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
