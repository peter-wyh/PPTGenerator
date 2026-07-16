import { useEffect, useState } from 'react';
import type { Campaign, ProjectMeta, Scenario, ScenarioSub } from '@mediakit/shared';
import { Button } from './Button';
import { Input } from './Input';
import {
  ADVERTISERS,
  BUSINESS_LINES,
  isCampaignScenario,
  SCENARIOS,
  TEMPLATE_TYPES,
} from '@/projectsMeta';
import { listCampaigns } from '@/api/campaigns';
import { lookupApi } from '@/api/lookup';

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

export interface ProjectFormInitial {
  name: string;
  width: number;
  height: number;
  meta?: ProjectMeta;
}

interface Props {
  open: boolean;
  loading?: boolean;
  error?: string | null;
  /** 编辑模式时传入初始值；不传为新建模式。 */
  initial?: ProjectFormInitial | null;
  /** 锁定场景（编辑模式下避免误改已绑定 campaign）。 */
  lockScenario?: boolean;
  title?: string;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (values: { name: string; width: number; height: number; meta: ProjectMeta }) => void;
}

/** 新建/编辑项目表单：场景驱动，campaign 类型从上游接口(mock)选择具体 campaign 并联动填充。 */
export function CreateProjectDialog({
  open,
  loading,
  error,
  initial,
  lockScenario = false,
  title = '新建项目',
  submitLabel = '创建',
  onCancel,
  onSubmit,
}: Props) {
  const [name, setName] = useState('');
  const [scenario, setScenario] = useState<Scenario | ''>('');
  const [scenarioSub, setScenarioSub] = useState<ScenarioSub>('weekly');
  const [creator, setCreator] = useState('');
  const [styleType, setStyleType] = useState<'ppt' | 'single' | 'ai-html'>('ppt');

  // campaign（上游 mock）
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignId, setCampaignId] = useState('');

  // 业务线(顶层必填;campaign 场景由 campaign 自动回填,可改)
  const [businessLine, setBusinessLine] = useState('');
  // 模版类型(场景下细分;campaign-report 与 scenarioSub 同值)
  const [templateType, setTemplateType] = useState<string>('');
  const [mkAdvertiser, setMkAdvertiser] = useState('');

  // 查找表数据（从 API 拉取，失败时回退 mock 常量）
  const [blOptions, setBlOptions] = useState<{ code: string; name: string }[]>(BUSINESS_LINES.map((b) => ({ code: b, name: b })));
  const [advOptions, setAdvOptions] = useState<{ name: string }[]>(ADVERTISERS.map((a) => ({ name: a })));

  // 画布尺寸
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [custom, setCustom] = useState(false);
  const [width, setWidth] = useState(PRESETS[0].w);
  const [height, setHeight] = useState(PRESETS[0].h);

  const isCampaign = isCampaignScenario(scenario as Scenario);
  const selectedCampaign = campaigns.find((c) => c.id === campaignId) ?? null;
  // campaign 按已选业务线过滤；未选业务线时不展示（业务线为必填前置）
  const visibleCampaigns = businessLine
    ? campaigns.filter((c) => c.businessLine === businessLine)
    : [];

  useEffect(() => {
    if (!open) return;
    const m = initial?.meta;
    const initW = initial?.width ?? PRESETS[0].w;
    const initH = initial?.height ?? PRESETS[0].h;
    const matched = PRESETS.find((p) => p.w === initW && p.h === initH);

    setName(initial?.name ?? '');
    setScenario((m?.scenario ?? '') as Scenario | '');
    setScenarioSub(m?.scenarioSub ?? 'weekly');
    setCreator(m?.creator ?? '');
    setStyleType((m?.styleType as 'ppt' | 'single' | 'ai-html') ?? 'ppt');
    setBusinessLine(m?.businessLine ?? '');
    setCampaignId(m?.campaignId ?? '');
    setBusinessLine(m?.businessLine ?? '');
    setTemplateType(m?.templateType ?? (m?.scenario === 'campaign-report' ? m?.scenarioSub ?? '' : ''));
    setMkAdvertiser(m?.advertiser ?? '');
    if (matched) {
      setPresetId(matched.id);
      setCustom(false);
    } else {
      setPresetId(PRESETS[0].id);
      setCustom(true);
    }
    setWidth(initW);
    setHeight(initH);
  }, [open, initial]);

  // 进入 campaign 类型场景时懒加载上游 campaign 列表。
  useEffect(() => {
    if (open && isCampaign && campaigns.length === 0 && !campaignsLoading) {
      setCampaignsLoading(true);
      listCampaigns()
        .then(setCampaigns)
        .finally(() => setCampaignsLoading(false));
    }
  }, [open, isCampaign, campaigns.length, campaignsLoading]);

  // 拉取查找表数据（业务线/广告主），失败时保留 mock 回退。
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.allSettled([
      lookupApi.listBusinessLines(),
      lookupApi.listAdvertisers(),
    ]).then(([blRes, advRes]) => {
      if (cancelled) return;
      if (blRes.status === 'fulfilled' && blRes.value.length > 0) {
        setBlOptions(blRes.value.map((b) => ({ code: b.code, name: `${b.code} · ${b.name}` })));
      }
      if (advRes.status === 'fulfilled' && advRes.value.length > 0) {
        setAdvOptions(advRes.value.map((a) => ({ name: a.name })));
      }
    });
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;

  function pickPreset(p: SizePreset) {
    setPresetId(p.id);
    setCustom(false);
    setWidth(p.w);
    setHeight(p.h);
  }

  const canSubmit =
    !!name.trim() &&
    !!businessLine &&
    (!scenario || !isCampaignScenario(scenario as Scenario) || !!campaignId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !canSubmit) return;
    const w = Math.max(1, Math.min(8192, Math.round(Number(width) || 0)));
    const h = Math.max(1, Math.min(8192, Math.round(Number(height) || 0)));

    // campaign-report 的模版类型取值与 scenarioSub 同集合;报告类型下拉双写两者。
    // reportSub 兜底取 scenarioSub(默认 'weekly'),保证即使用户没动报告类型也带 templateType。
    const reportSub: ScenarioSub | undefined =
      scenario === 'campaign-report' ? ((templateType || scenarioSub) as ScenarioSub) : undefined;
    const meta: ProjectMeta = {
      creator: creator || undefined,
      businessLine: businessLine || undefined,
      scenario: (scenario || undefined) as Scenario | undefined,
      templateType: (templateType || reportSub) || undefined,
      scenarioSub: reportSub,
      styleType,
    };

    if (isCampaignScenario(scenario as Scenario) && selectedCampaign) {
      meta.campaignId = selectedCampaign.id;
      meta.advertiser = selectedCampaign.advertiser;
      meta.campaignInfo = {
        campaignName: selectedCampaign.name,
        platform: selectedCampaign.platform,
        startDate: selectedCampaign.startDate,
        endDate: selectedCampaign.endDate,
        budget: selectedCampaign.budget,
      };
    } else if (scenario === 'media-kit') {
      meta.advertiser = mkAdvertiser || undefined;
    } else {
      meta.businessLine = businessLine || undefined;
    }

    onSubmit({ name: trimmed, width: w, height: h, meta });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
      role="presentation"
    >
      <form
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl bg-surface-primary p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        onSubmit={submit}
      >
        <h3 className="font-headings text-base font-semibold text-foreground-primary">{title}</h3>

        <div className="mt-4 space-y-4">
          <Input
            label="项目名称"
            name="name"
            placeholder="例如：2026 Q4 增长复盘"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />

          {/* 样式类型（第一步选择，决定后续流程） */}
          <div>
            <span className="mb-1.5 block text-sm font-medium text-foreground-secondary">样式类型</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'ppt' as const, label: 'PPT 多页', hint: '多页幻灯片报告' },
                { id: 'single' as const, label: '单页面', hint: '单页长图 / 海报' },
                { id: 'ai-html' as const, label: 'AI 生成 HTML', hint: '跳转 GrapesJS 编辑器' },
              ].map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setStyleType(s.id)}
                  className={`rounded-lg border px-3 py-2 text-left transition ${
                    styleType === s.id
                      ? 'border-accent-primary bg-accent-primary/5'
                      : 'border-border-default hover:bg-surface-hover'
                  }`}
                >
                  <div className="text-sm font-medium text-foreground-primary">{s.label}</div>
                  <div className="text-[11px] text-foreground-muted">{s.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 场景（驱动后续表单） */}
          <label className="block text-sm text-foreground-secondary">
            <span className="mb-1 block font-medium">场景{lockScenario && <span className="ml-1 text-foreground-muted">（已锁定）</span>}</span>
            <select
              className={selectCls}
              value={scenario}
              disabled={lockScenario}
              onChange={(e) => {
                const next = e.target.value as Scenario | '';
                setScenario(next);
                setCampaignId('');
                setTemplateType('');
              }}
            >
              <option value="">（请选择场景）</option>
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          {/* 业务线(必填) */}
          <label className="block text-sm text-foreground-secondary">
            <span className="mb-1 block font-medium">业务线</span>
            <select
              className={selectCls}
              value={businessLine}
              onChange={(e) => {
                setBusinessLine(e.target.value);
                setCampaignId('');
              }}
            >
              <option value="">（请选择业务线）</option>
              {blOptions.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          {/* 模版类型(选了场景且非 campaign-report 才出现;campaign-report 走报告类型) */}
          {scenario && scenario !== 'campaign-report' && (
            <label className="block text-sm text-foreground-secondary">
              <span className="mb-1 block font-medium">模版类型</span>
              <select
                className={selectCls}
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value)}
              >
                <option value="">（请选择模版类型）</option>
                {TEMPLATE_TYPES[scenario as Scenario].map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* campaign 类型：选具体 campaign（上游接口 mock） */}
          {isCampaign && (
            <div className="space-y-2 rounded-lg border border-border-subtle bg-surface-hover/40 p-3">
              <label className="block text-sm text-foreground-secondary">
                <span className="mb-1 block font-medium">
                  Campaign <span className="text-foreground-muted">（来自上游接口）</span>
                </span>
                <select
                  className={selectCls}
                  value={campaignId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setCampaignId(id);
                    // 选 campaign 时回填业务线(用户可再改);edit 模式不触发,保留存量值。
                    const c = campaigns.find((x) => x.id === id);
                    if (c) setBusinessLine(c.businessLine);
                  }}
                  disabled={campaignsLoading}
                >
                  <option value="">
                    {campaignsLoading
                      ? '加载中…'
                      : visibleCampaigns.length === 0
                        ? '该业务线暂无可选 Campaign'
                        : '（选择 Campaign）'}
                  </option>
                  {visibleCampaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.advertiser}
                    </option>
                  ))}
                </select>
              </label>

              {selectedCampaign && (
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-foreground-secondary">
                  <span>广告主：{selectedCampaign.advertiser}</span>
                  <span>业务线：{selectedCampaign.businessLine}</span>
                  <span>平台：{selectedCampaign.platform}</span>
                  <span>预算：{selectedCampaign.budget}</span>
                  <span className="col-span-2">
                    周期：{selectedCampaign.startDate} ~ {selectedCampaign.endDate}
                  </span>
                </div>
              )}

              {/* campaign 报告：报告类型(与模版类型同源,双写 scenarioSub + templateType) */}
              {scenario === 'campaign-report' && (
                <label className="block text-sm text-foreground-secondary">
                  <span className="mb-1 block">报告类型</span>
                  <select
                    className={selectCls}
                    value={templateType || scenarioSub}
                    onChange={(e) => {
                      const v = e.target.value as ScenarioSub;
                      setScenarioSub(v);
                      setTemplateType(v);
                    }}
                  >
                    {TEMPLATE_TYPES['campaign-report'].map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}

          {/* media-kit:广告主(选填);业务线已在上层必填 */}
          {scenario === 'media-kit' && (
            <label className="block text-sm text-foreground-secondary">
              <span className="mb-1 block">广告主</span>
              <select className={selectCls} value={mkAdvertiser} onChange={(e) => setMkAdvertiser(e.target.value)}>
                <option value="">（选填）</option>
                {advOptions.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* 创建人（通用） */}
          <label className="block text-sm text-foreground-secondary">
            <span className="mb-1 block">创建人</span>
            <select className={selectCls} value={creator} onChange={(e) => setCreator(e.target.value)}>
              <option value="">（选填）</option>
              {['alex', 'stella', 'reese', 'stacey'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          {/* 画布尺寸 */}
          <div>
            <span className="mb-1.5 block text-sm font-medium text-foreground-secondary">画布尺寸</span>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => pickPreset(p)}
                  className={`rounded-lg border px-3 py-2 text-left transition ${
                    !custom && presetId === p.id
                      ? 'border-accent-primary bg-accent-primary/5'
                      : 'border-border-default hover:bg-surface-hover'
                  }`}
                >
                  <div className="text-sm font-medium text-foreground-primary">{p.label}</div>
                  <div className="text-[11px] text-foreground-muted">{p.hint}</div>
                </button>
              ))}
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs text-foreground-secondary">
              <input
                type="checkbox"
                checked={custom}
                onChange={(e) => {
                  setCustom(e.target.checked);
                  if (!e.target.checked) {
                    const p = PRESETS.find((x) => x.id === presetId) ?? PRESETS[0];
                    setWidth(p.w);
                    setHeight(p.h);
                  }
                }}
              />
              自定义尺寸
            </label>
            {custom && (
              <div className="mt-2 flex items-center gap-2">
                <Input name="width" type="number" label="宽" value={width} onChange={(e) => setWidth(Number(e.target.value))} />
                <span className="mt-5 text-foreground-muted">×</span>
                <Input name="height" type="number" label="高" value={height} onChange={(e) => setHeight(Number(e.target.value))} />
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            取消
          </Button>
          <Button type="submit" loading={loading} disabled={!canSubmit}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
