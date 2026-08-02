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

/** PPT 多页固定 16:9（1920×1080），不支持自定义。 */
const PPT_SIZE = { w: 1920, h: 1080 };

interface SinglePreset {
  id: string;
  label: string;
  ratio: string;
  w: number;
  h: number;
}

/** 单页面预设尺寸（参考 Canva 逻辑），第一个为自定义。 */
const SINGLE_PRESETS: SinglePreset[] = [
  { id: 'custom', label: '自定义', ratio: '—', w: 0, h: 0 },
  { id: 'xhs', label: '小红书竖图', ratio: '3:4', w: 1242, h: 1656 },
  { id: 'ig-story', label: 'Instagram Story', ratio: '9:16', w: 1080, h: 1920 },
  { id: 'ig-square', label: 'Instagram 正方形', ratio: '1:1', w: 1080, h: 1080 },
  { id: 'wechat-header', label: '公众号头图', ratio: '2.35:1', w: 900, h: 383 },
  { id: 'a4-landscape', label: '报告 A4 横版', ratio: '√2:1', w: 1754, h: 1240 },
  { id: 'a4-portrait', label: '报告 A4 竖版', ratio: '1:√2', w: 1240, h: 1754 },
];

/** 创建人建议列表（可自由输入）。 */
const CREATOR_SUGGESTIONS = ['alex', 'stella', 'reese', 'stacey'];

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

  // 单页面尺寸
  const [singlePresetId, setSinglePresetId] = useState(SINGLE_PRESETS[1].id); // 默认小红书竖图
  const [singleW, setSingleW] = useState(SINGLE_PRESETS[1].w);
  const [singleH, setSingleH] = useState(SINGLE_PRESETS[1].h);
  const isSingle = styleType === 'single';

  const isCampaign = isCampaignScenario(scenario as Scenario);
  const selectedCampaign = campaigns.find((c) => c.id === campaignId) ?? null;
  // campaign 按已选业务线过滤；未选业务线时不展示（业务线为必填前置）
  const visibleCampaigns = businessLine
    ? campaigns.filter((c) => c.businessLine === businessLine)
    : [];

  useEffect(() => {
    if (!open) return;
    const m = initial?.meta;
    const initW = initial?.width ?? PPT_SIZE.w;
    const initH = initial?.height ?? PPT_SIZE.h;

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

    // 单页模式：尝试匹配已有预设，否则设为自定义
    if ((m?.styleType as string) === 'single') {
      const matched = SINGLE_PRESETS.find((p) => p.w === initW && p.h === initH);
      if (matched) {
        setSinglePresetId(matched.id);
      } else {
        setSinglePresetId('custom');
      }
      setSingleW(initW);
      setSingleH(initH);
    }
  }, [open, initial]);

  // Campaign 现为可选绑定：进入 campaign 场景时主动触发一次懒加载（失败不报错）。
  useEffect(() => {
    if (open && isCampaign && campaigns.length === 0 && !campaignsLoading) {
      setCampaignsLoading(true);
      listCampaigns()
        .then(setCampaigns)
        .catch(() => { /* 上游接口不可用时静默，Campaign 选填不阻塞 */ })
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

  function pickSinglePreset(p: SinglePreset) {
    setSinglePresetId(p.id);
    if (p.id !== 'custom') {
      setSingleW(p.w);
      setSingleH(p.h);
    }
  }

  // Campaign 现为可选绑定：不再要求 campaign 场景必须选择 Campaign。
  // 仅校验项目名 + 业务线必填。
  const canSubmit = !!name.trim() && !!businessLine;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !canSubmit) return;

    // PPT 固定 1920×1080；单页面用预设或自定义
    const w = isSingle ? Math.max(200, Math.min(5000, Math.round(singleW))) : PPT_SIZE.w;
    const h = isSingle ? Math.max(200, Math.min(5000, Math.round(singleH))) : PPT_SIZE.h;

    // campaign-report 的模版类型取值与 scenarioSub 同集合;报告类型下拉双写两者。
    const reportSub: ScenarioSub | undefined =
      scenario === 'campaign-report' ? ((templateType || scenarioSub) as ScenarioSub) : undefined;
    // 编辑模式：保留现有 meta 的所有字段，仅覆盖对话框管理的字段。
    const preservedFields = initial?.meta ? { ...initial.meta } : {};
    const meta: ProjectMeta = {
      ...preservedFields,
      creator: creator || undefined,
      businessLine: businessLine || undefined,
      scenario: (scenario || undefined) as Scenario | undefined,
      templateType: (templateType || reportSub) || undefined,
      scenarioSub: reportSub,
      styleType,
    };

    // campaign-report 场景：仅在用户确实选择了 Campaign 时覆盖 campaignId 等字段。
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

          {/* campaign 类型：选具体 campaign（上游接口，可选绑定） */}
          {isCampaign && (
            <div className="space-y-2 rounded-lg border border-border-subtle bg-surface-hover/40 p-3">
              <label className="block text-sm text-foreground-secondary">
                <span className="mb-1 block font-medium">
                  Campaign <span className="text-foreground-muted">（可选 · 来自上游接口）</span>
                </span>
                <select
                  className={selectCls}
                  value={campaignId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setCampaignId(id);
                    const c = campaigns.find((x) => x.id === id);
                    if (c) setBusinessLine(c.businessLine);
                  }}
                  disabled={campaignsLoading}
                >
                  <option value="">
                    {campaignsLoading
                      ? '加载中…'
                      : visibleCampaigns.length === 0
                        ? '该业务线暂无可选 Campaign（可不绑定）'
                        : '（可选 · 选择 Campaign）'}
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

              {/* campaign 报告：报告类型 */}
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

          {/* media-kit:广告主(选填) */}
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

          {/* 创建人（通用，可自由输入，提供常用建议） */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground-secondary">创建人</label>
            <input
              className={selectCls}
              list="creator-suggestions"
              value={creator}
              onChange={(e) => setCreator(e.target.value)}
              placeholder="输入创建人姓名"
            />
            <datalist id="creator-suggestions">
              {CREATOR_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          {/* 画布尺寸（AI HTML 类型不需要设定尺寸） */}
          {styleType !== 'ai-html' && (
          <div>
            <span className="mb-1.5 block text-sm font-medium text-foreground-secondary">画布尺寸</span>

            {isSingle ? (
              /* 单页面模式：预设卡片 + 自定义宽高 */
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {SINGLE_PRESETS.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => pickSinglePreset(p)}
                      className={`rounded-lg border px-3 py-2 text-left transition ${
                        singlePresetId === p.id
                          ? 'border-accent-primary bg-accent-primary/5 text-foreground-primary'
                          : 'border-border-default hover:bg-surface-hover text-foreground-secondary'
                      }`}
                    >
                      <div className="text-sm font-medium">{p.label}</div>
                      {p.id !== 'custom' && (
                        <div className="text-[11px] text-foreground-muted">{p.ratio} · {p.w}×{p.h}</div>
                      )}
                    </button>
                  ))}
                </div>
                {singlePresetId === 'custom' && (
                  <div className="flex items-center gap-2">
                    <Input name="singleW" type="number" label="宽 (px)" value={singleW} onChange={(e) => setSingleW(Number(e.target.value))} />
                    <span className="mt-5 text-foreground-muted">×</span>
                    <Input name="singleH" type="number" label="高 (px)" value={singleH} onChange={(e) => setSingleH(Number(e.target.value))} />
                  </div>
                )}
                <p className="text-[11px] text-foreground-muted">当前尺寸：{singleW} × {singleH} px</p>
              </div>
            ) : (
              /* PPT 多页模式：固定 16:9 (1920×1080)，无尺寸选择 */
              <div className="rounded-lg border border-border-subtle bg-surface-hover/40 px-4 py-3 text-sm text-foreground-secondary">
                固定 16:9 · <span className="font-medium text-foreground-primary">1920 × 1080 px</span>
              </div>
            )}
          </div>
          )}

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
