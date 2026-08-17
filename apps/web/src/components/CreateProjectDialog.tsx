import { useEffect, useState } from 'react';
import type { Campaign, ProjectMeta, ReportPeriod, Scenario, ScenarioSub, TemplateSummary } from '@mediakit/shared';
import { Button } from './Button';
import { Input } from './Input';
import {
  isCampaignScenario,
  SCENARIO_LABELS,
  SCENARIOS,
  TEMPLATE_TYPES,
} from '@/projectsMeta';
import { listCampaigns } from '@/api/campaigns';
import { lookupApi } from '@/api/lookup';
import { templatesApi } from '@/api/templates';
import { useAuthStore } from '@/stores/auth';

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

/** 报告时间范围类型。月报→选月，周报/双周报→选日期范围。 */
function isMonthly(sub: string) {
  return sub === 'monthly' || sub === 'wrap-up';
}

/** 从 month 字符串推导 startDate/endDate。 */
function monthToRange(month: string): { startDate: string; endDate: string } {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0); // last day of month
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { startDate: fmt(start), endDate: fmt(end) };
}


/** 解析报告时间范围 → {startDate, endDate}(月报→month 推导;周报/双周报→直接)。无则 null。 */
function resolveReportPeriod(
  p: { month?: string; startDate?: string; endDate?: string } | null,
  sub: string | undefined,
): { startDate: string; endDate: string } | null {
  if (!p || !sub) return null;
  if (isMonthly(sub)) return p.month ? monthToRange(p.month) : null;
  if (sub === 'weekly' || sub === 'biweekly') {
    if (p.startDate && p.endDate) return { startDate: p.startDate, endDate: p.endDate };
  }
  return null;
}

/** 报告时间范围是否在 Campaign 范围内;越界返回错误文案,否则 null(无 Campaign/无日期→跳过)。 */
function reportPeriodRangeError(
  period: { startDate: string; endDate: string } | null,
  campaign: { startDate?: string; endDate?: string } | null,
): string | null {
  if (!period || !campaign) return null;
  const cs = campaign.startDate;
  const ce = campaign.endDate;
  if (!cs || !ce) return null; // Campaign 无日期 → 不校验
  if (period.startDate && period.startDate < cs)
    return `报告开始日期(${period.startDate})早于 Campaign 开始日期(${cs})`;
  if (period.endDate && period.endDate > ce)
    return `报告结束日期(${period.endDate})晚于 Campaign 结束日期(${ce})`;
  return null;
}

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
  onSubmit: (values: { name: string; width: number; height: number; meta: ProjectMeta; templateId?: string }) => void;
}

/** 新建/编辑项目表单：场景驱动，campaign 类型从上游接口(mock)选择具体 campaign 并联动填充。 */
export function CreateProjectDialog({
  open,
  loading,
  error,
  initial,
  lockScenario = false,
  title = '新建报告',
  submitLabel = '创建',
  onCancel,
  onSubmit,
}: Props) {
  const [name, setName] = useState('');
  const [scenario, setScenario] = useState<Scenario | ''>('');
  const [scenarioSub, setScenarioSub] = useState<ScenarioSub>('weekly');
  const [creator, setCreator] = useState('');
  const [styleType, setStyleType] = useState<'ppt' | 'single' | 'ai-html'>('ppt');

  // 创建模式：'blank' = 从空白创建，'template' = 从模版创建
  const [createMode, setCreateMode] = useState<'blank' | 'template'>('blank');
  // 已发布模版列表
  const [publishedTemplates, setPublishedTemplates] = useState<TemplateSummary[]>([]);
  const [templatesFetching, setTemplatesFetching] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // campaign（上游 mock）
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignId, setCampaignId] = useState('');

  // 报告时间范围（月报=选月，周报/双周报=选日期范围）
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>({});

  // 业务线(顶层必填;campaign 场景由 campaign 自动回填,可改)
  const [businessLine, setBusinessLine] = useState('');

  // 业务线账号锁定本业务线（ADMIN / 无归属不受限）
  const authUser = useAuthStore((s) => s.user);
  const lockedBusinessLine =
    authUser && authUser.role !== 'ADMIN' ? authUser.businessLineCode ?? null : null;

  useEffect(() => {
    if (open && lockedBusinessLine) setBusinessLine(lockedBusinessLine);
  }, [open, lockedBusinessLine]);
  // 模版类型(场景下细分;campaign-report 与 scenarioSub 同值)
  const [templateType, setTemplateType] = useState<string>('');
  const [mkAdvertiser, setMkAdvertiser] = useState('');

  // 查找表数据（从 API 拉取，数据库唯一来源）
  const [blOptions, setBlOptions] = useState<{ code: string; name: string }[]>([]);
  const [advOptions, setAdvOptions] = useState<{ name: string }[]>([]);

  // 单页面尺寸
  const [singlePresetId, setSinglePresetId] = useState(SINGLE_PRESETS[1].id); // 默认小红书竖图
  const [singleW, setSingleW] = useState(SINGLE_PRESETS[1].w);
  const [singleH, setSingleH] = useState(SINGLE_PRESETS[1].h);
  const isSingle = styleType === 'single';

  // 提交尝试标记：仅在用户点过「创建」后才显示校验错误（避免边填边报错）
  const [submitted, setSubmitted] = useState(false);

  // 拉取已发布模版列表（模版模式下展示）
  useEffect(() => {
    if (!open || createMode !== 'template') return;
    let cancelled = false;
    setTemplatesFetching(true);
    templatesApi
      .list({ status: 'PUBLISHED' })
      .then((list) => {
        if (cancelled) return;
        setPublishedTemplates(list);
        setSelectedTemplateId(list[0]?.id ?? '');
      })
      .catch(() => {
        if (!cancelled) setPublishedTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setTemplatesFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, createMode]);

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
    // 回显业务线:业务线账号锁定优先于历史值(锁定 effect 在前,此处不能清掉锁定的值)
    setBusinessLine(lockedBusinessLine ?? m?.businessLine ?? '');
    setCampaignId(m?.campaignId ?? '');
    setTemplateType(m?.templateType ?? (m?.scenario === 'campaign-report' ? m?.scenarioSub ?? '' : ''));
    setMkAdvertiser(m?.advertiser ?? '');
    // 回显已有的报告时间范围
    setReportPeriod((m?.reportPeriod as ReportPeriod | undefined) ?? {});

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
    } else if ((m?.styleType as string) === 'ppt') {
      // PPT 多页模式：保留实际尺寸用于回显（默认 1920×1080），
      // 尝试匹配预设，否则设为自定义
      const pptPresets = [
        { id: '16-9', w: 1920, h: 1080 },
        { id: '16-10', w: 1920, h: 1200 },
        { id: '4-3', w: 1440, h: 1080 },
        { id: 'a4-h', w: 1754, h: 1240 },
      ];
      const matchedPpt = pptPresets.find((p) => p.w === initW && p.h === initH);
      setSinglePresetId(matchedPpt?.id ?? 'custom-ppt');
      setSingleW(initW || PPT_SIZE.w);
      setSingleH(initH || PPT_SIZE.h);
    } else if (!m) {
      // 新建(无 initial)：PPT 多页默认 16:9(1920×1080)。
      // 修复:singleW/H 初始为单页面预设(小红书 1242×1656),不重置会以竖图尺寸提交。
      setSinglePresetId('16-9');
      setSingleW(PPT_SIZE.w);
      setSingleH(PPT_SIZE.h);
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

  // 拉取查找表数据（业务线/广告主），数据库唯一来源。
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
  // 报告时间范围必须落在所选 Campaign 的 [startDate, endDate] 内
  const reportSubForCheck =
    scenario === 'campaign-report' ? (templateType || scenarioSub) : undefined;
  const dateRangeError = reportPeriodRangeError(
    resolveReportPeriod(reportPeriod, reportSubForCheck),
    selectedCampaign,
  );

  const canSubmit = createMode === 'template'
    ? !!name.trim() && !!selectedTemplateId
    : !!name.trim() && !!businessLine && !dateRangeError;

  // 校验错误文案：提交后逐项显示（name/业务线/模版选择）
  const nameError = submitted && !name.trim() ? '请输入报告名称' : null;
  const businessLineError = submitted && createMode === 'blank' && !businessLine ? '请选择业务线' : null;
  const templateError = submitted && createMode === 'template' && !selectedTemplateId ? '请选择模版' : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const trimmed = name.trim();
    if (!trimmed || !canSubmit) return;

    // 模版模式：直接传 templateId，由父组件调用 createProjectFromTemplate
    if (createMode === 'template' && selectedTemplateId) {
      onSubmit({
        name: trimmed,
        width: PPT_SIZE.w,
        height: PPT_SIZE.h,
        meta: {} as ProjectMeta,
        templateId: selectedTemplateId,
      });
      return;
    }

    // PPT 多页：使用实际值（不再强制覆写为 1920×1080）；
    // 单页面用预设或自定义
    const w = isSingle ? Math.max(200, Math.min(5000, Math.round(singleW))) : singleW || PPT_SIZE.w;
    const h = isSingle ? Math.max(200, Math.min(5000, Math.round(singleH))) : singleH || PPT_SIZE.h;

    // campaign-report 的模版类型取值与 scenarioSub 同集合;报告类型下拉双写两者。
    const reportSub: ScenarioSub | undefined =
      scenario === 'campaign-report' ? ((templateType || scenarioSub) as ScenarioSub) : undefined;

    // 计算 reportPeriod（月报→month 推导 startDate/endDate；周报→直接使用）
    let finalPeriod: ReportPeriod | undefined;
    if (reportSub && isMonthly(reportSub)) {
      if (reportPeriod.month) {
        const range = monthToRange(reportPeriod.month);
        finalPeriod = { month: reportPeriod.month, ...range };
      }
    } else if (reportSub === 'weekly' || reportSub === 'biweekly') {
      if (reportPeriod.startDate || reportPeriod.endDate) {
        finalPeriod = { startDate: reportPeriod.startDate, endDate: reportPeriod.endDate };
      }
    }

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
      // 编辑模式下保留原有 reportPeriod（用户未修改时不清空）
      reportPeriod: finalPeriod ?? preservedFields.reportPeriod,
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

        {/* 创建模式切换：从空白 / 从模版（编辑模式不显示） */}
        {!lockScenario && (
          <div className="mt-3 flex gap-1 rounded-lg bg-surface-hover p-1">
            <button
              type="button"
              onClick={() => setCreateMode('blank')}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                createMode === 'blank'
                  ? 'bg-surface-primary text-foreground-primary shadow-sm'
                  : 'text-foreground-secondary hover:text-foreground-primary'
              }`}
            >
              从空白创建
            </button>
            <button
              type="button"
              onClick={() => setCreateMode('template')}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                createMode === 'template'
                  ? 'bg-surface-primary text-foreground-primary shadow-sm'
                  : 'text-foreground-secondary hover:text-foreground-primary'
              }`}
            >
              从模版创建
            </button>
          </div>
        )}

        {/* ========== 模版模式：选择已发布模版 ========== */}
        {createMode === 'template' && !lockScenario ? (
          <div className="mt-4 space-y-4">
            <Input
              label="报告名称"
              name="name"
              placeholder="输入报告名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={nameError ?? undefined}
              autoFocus
            />
            <div>
              <span className="mb-1.5 block text-sm font-medium text-foreground-secondary">选择模版</span>
              {templatesFetching ? (
                <p className="py-8 text-center text-sm text-foreground-muted">加载模版…</p>
              ) : publishedTemplates.length === 0 ? (
                <div className="rounded-lg border border-border-subtle bg-surface-hover/40 p-4 text-center">
                  <p className="text-sm text-foreground-muted">暂无已发布模版</p>
                  <p className="mt-1 text-xs text-foreground-muted">请在「模版管理」中创建并发布模版</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {publishedTemplates.map((t) => {
                    const active = t.id === selectedTemplateId;
                    const bl = t.meta?.businessLine ?? '';
                    const sc = t.meta?.scenario ? SCENARIO_LABELS[t.meta.scenario as Scenario] : '';
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(t.id)}
                        className={`overflow-hidden rounded-lg border text-left transition ${
                          active
                            ? 'border-accent-primary ring-2 ring-accent-primary/20'
                            : 'border-border-default hover:border-border-hover hover:bg-surface-hover'
                        }`}
                      >
                        <div
                          className="flex aspect-video items-center justify-center text-xl font-bold"
                          style={{
                            background: active
                              ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary, #6366f1))'
                              : 'linear-gradient(135deg, #f0f0f0, #e8e8e8)',
                            color: active ? '#fff' : '#bbb',
                          }}
                        >
                          {(bl || 'TPL').slice(0, 3).toUpperCase()}
                        </div>
                        <div className="p-2">
                          <div className="line-clamp-1 text-xs font-medium text-foreground-primary">{t.name}</div>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {bl && <span className="rounded bg-surface-hover px-1 text-[10px] text-foreground-secondary">{bl}</span>}
                            {sc && <span className="rounded bg-surface-hover px-1 text-[10px] text-foreground-secondary">{sc}</span>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {templateError && <span className="block text-xs text-red">{templateError}</span>}
            </div>
          </div>
        ) : (
        /* ========== 空白模式：原有表单 ========== */
        <div className="mt-4 space-y-4">
          <Input
            label="报告名称"
            name="name"
            placeholder="例如：2026 Q4 增长复盘"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={nameError ?? undefined}
            autoFocus
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
              className={`${selectCls} ${businessLineError ? 'border-red' : ''}`}
              value={businessLine}
              disabled={!!lockedBusinessLine}
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
            {businessLineError && <span className="mt-1 block text-xs text-red">{businessLineError}</span>}
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
                    if (c && !lockedBusinessLine) setBusinessLine(c.businessLine);
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

              {/* 报告时间范围：月报→选月，周报/双周报→选日期范围 */}
              {scenario === 'campaign-report' && (templateType || scenarioSub) && (
                <div className="space-y-2">
                  <span className="block text-sm font-medium text-foreground-secondary">
                    报告时间范围
                  </span>
                  {isMonthly(templateType || scenarioSub) ? (
                    /* 月报/总结：月份选择器 */
                    <input
                      type="month"
                      className={selectCls}
                      value={reportPeriod.month ?? ''}
                      onChange={(e) => setReportPeriod((p: ReportPeriod) => ({ ...p, month: e.target.value }))}
                    />
                  ) : (
                    /* 周报/双周报：日期范围选择器 */
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        className={selectCls}
                        value={reportPeriod.startDate ?? ''}
                        onChange={(e) => setReportPeriod((p: ReportPeriod) => ({ ...p, startDate: e.target.value }))}
                        placeholder="开始日期"
                      />
                      <input
                        type="date"
                        className={selectCls}
                        value={reportPeriod.endDate ?? ''}
                        onChange={(e) => setReportPeriod((p: ReportPeriod) => ({ ...p, endDate: e.target.value }))}
                        placeholder="结束日期"
                      />
                    </div>
                  )}
                  {(() => {
                    const sub = templateType || scenarioSub;
                    const period = reportPeriod;
                    if (isMonthly(sub) && period.month) {
                      const r = monthToRange(period.month);
                      return (
                        <p className="text-[11px] text-foreground-muted">
                          时间范围：{r.startDate} ~ {r.endDate}
                        </p>
                      );
                    }
                    if ((sub === 'weekly' || sub === 'biweekly') && period.startDate && period.endDate) {
                      return (
                        <p className="text-[11px] text-foreground-muted">
                          时间范围：{period.startDate} ~ {period.endDate}
                        </p>
                      );
                    }
                    return (
                      <p className="text-[11px] text-foreground-muted">
                        {isMonthly(sub) ? '请选择报告月份' : '请选择报告起止日期'}
                      </p>
                    );
                  })()}
                  {dateRangeError && (
                    <p className="text-[11px] text-red">{dateRangeError}</p>
                  )}
                </div>
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
              /* PPT 多页模式：默认 16:9 (1920×1080)，支持自定义 */
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {[
                    { id: '16-9', label: '16:9 标准', ratio: '16:9', w: 1920, h: 1080 },
                    { id: '16-10', label: '16:10', ratio: '16:10', w: 1920, h: 1200 },
                    { id: '4-3', label: '4:3', ratio: '4:3', w: 1440, h: 1080 },
                    { id: 'a4-h', label: 'A4 横版', ratio: '√2:1', w: 1754, h: 1240 },
                    { id: 'custom-ppt', label: '自定义', ratio: '—', w: 0, h: 0 },
                  ].map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => {
                        setSinglePresetId(p.id);
                        if (p.id !== 'custom-ppt') {
                          setSingleW(p.w);
                          setSingleH(p.h);
                        }
                      }}
                      className={`rounded-lg border px-3 py-2 text-left transition ${
                        singlePresetId === p.id
                          ? 'border-accent-primary bg-accent-primary/5 text-foreground-primary'
                          : 'border-border-default hover:bg-surface-hover text-foreground-secondary'
                      }`}
                    >
                      <div className="text-sm font-medium">{p.label}</div>
                      {p.id !== 'custom-ppt' && (
                        <div className="text-[11px] text-foreground-muted">{p.ratio} · {p.w}×{p.h}</div>
                      )}
                    </button>
                  ))}
                </div>
                {(singlePresetId === 'custom-ppt' || singlePresetId === 'custom') && (
                  <div className="flex items-center gap-2">
                    <Input name="pptW" type="number" label="宽 (px)" value={singleW} onChange={(e) => { setSingleW(Number(e.target.value)); setSinglePresetId('custom-ppt'); }} />
                    <span className="mt-5 text-foreground-muted">×</span>
                    <Input name="pptH" type="number" label="高 (px)" value={singleH} onChange={(e) => { setSingleH(Number(e.target.value)); setSinglePresetId('custom-ppt'); }} />
                  </div>
                )}
                <p className="text-[11px] text-foreground-muted">当前尺寸：{singleW} × {singleH} px</p>
              </div>
            )}
          </div>
          )}

          {error && <p className="text-sm text-red">{error}</p>}
        </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            取消
          </Button>
          <Button type="submit" loading={loading}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
