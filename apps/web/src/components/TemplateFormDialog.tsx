import { useEffect, useState } from 'react';
import type { ProjectMeta, Scenario, TemplateStatus } from '@mediakit/shared';
import { Button } from './Button';
import { Input } from './Input';
import {
  SCENARIOS,
  TEMPLATE_TYPES,
} from '@/projectsMeta';
import { useBusinessLineCodes } from '@/editor/useBusinessLineLogo';

/** P1-15: 渲染类型 — 第一步先选这个，再展示对应配置（2026-08 裁撤长图海报，仅剩两类） */
type RenderType = 'multi-page' | 'html-report';

const RENDER_TYPES: { value: RenderType; label: string; desc: string }[] = [
  { value: 'multi-page', label: '多页 PPT', desc: '16:9 幻灯片，多页编辑' },
  { value: 'html-report', label: 'HTML 报告', desc: '可交互网页，支持嵌入链接' },
];

/** 各渲染类型对应的默认尺寸 */
const RENDER_DEFAULT_SIZE: Record<RenderType, { w: number; h: number }> = {
  'multi-page': { w: 1920, h: 1080 },
  'html-report': { w: 1280, h: 0 }, // h=0 表示自适应高度
};

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

/**
 * 根据宽高推断渲染类型（兼容旧数据——meta 中尚无 renderType 字段的模板）。
 * - 竖版（高>宽）→ HTML 报告（长图海报已裁撤，竖版归入 HTML 报告）
 * - 接近 16:9（宽≥高且 ratio≥1.5）→ 多页 PPT
 * - 其余 → HTML 报告
 */
function inferRenderType(w: number, h: number): RenderType {
  if (h > w) return 'html-report';
  const ratio = w / h;
  if (ratio >= 1.5) return 'multi-page';
  return 'html-report';
}

export interface TemplateFormInitial {
  name: string;
  width: number;
  height: number;
  businessLine?: string;
  scenario?: Scenario;
  templateType?: string;
  renderType?: string;
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
  const BUSINESS_LINES = useBusinessLineCodes(); // 数据库唯一来源
  const [name, setName] = useState('');
  const [renderType, setRenderType] = useState<RenderType | ''>(''); // P1-15
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
      // renderType 优先从 meta 取，为空时根据宽高比推断（兼容旧数据）
      const inferredRT = (initial.renderType as RenderType | '') ?? inferRenderType(initial.width, initial.height);
      setRenderType(inferredRT);
      setBusinessLine(initial.businessLine ?? '');
      setScenario(initial.scenario ?? '');
      setTemplateType(initial.templateType ?? '');
      setNote(initial.note ?? '');
      setStatus(initial.status ?? 'DRAFT');
    } else {
      setName('');
      setRenderType('');
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
    // P1-15: 新建时根据渲染类型确定尺寸（多页固定 16:9，长图用预设，HTML 报告用宽度）
    const renderSize = renderType ? RENDER_DEFAULT_SIZE[renderType] : null;
    const meta: ProjectMeta = {};
    if (businessLine) meta.businessLine = businessLine;
    if (scenario) meta.scenario = scenario as Scenario;
    if (templateType) meta.templateType = templateType;
    if (renderType) meta.renderType = renderType;
    onSubmit({
      name: name.trim(),
      width: renderSize?.w ?? preset.w,
      height: renderSize?.h ?? preset.h,
      meta,
      note: note.trim() || undefined,
      // 新建固定 DRAFT（后端忽略 status）；编辑透传状态。
      ...(editMode ? { status } : {}),
    });
  };

  const canSubmit = name.trim().length > 0 && !!renderType && !loading;

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

          {/* 渲染类型选择器 — 新建和编辑均显示 */}
          <div>
            <span className="mb-2 block text-sm font-medium text-foreground-secondary">渲染类型</span>
            <div className="grid grid-cols-3 gap-2">
              {RENDER_TYPES.map((rt) => (
                <button
                  key={rt.value}
                  type="button"
                  onClick={() => setRenderType(rt.value)}
                  className={`rounded-lg border p-3 text-left transition ${
                    renderType === rt.value
                      ? 'border-accent-primary bg-accent-primary/5'
                      : 'border-border-default hover:border-accent-secondary/50'
                  }`}
                >
                  <div className={`text-sm font-medium ${renderType === rt.value ? 'text-accent-primary' : 'text-foreground-primary'}`}>
                    {rt.label}
                  </div>
                  <div className="mt-1 text-xs text-foreground-muted">{rt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 渲染类型选定后才展示尺寸 / 分类 / 备注 */}
          {renderType && (
            <>
              {renderType === 'multi-page' ? (
                <div className="rounded-lg bg-surface-hover px-3 py-2 text-xs text-foreground-secondary">
                  固定 16:9（1920×1080），多页编辑
                </div>
              ) : (
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
              )}

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
                <option value="PUBLISHED">已发布（BD 可基于此创建报告）</option>
              </select>
            </label>
          )}
            </>
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
