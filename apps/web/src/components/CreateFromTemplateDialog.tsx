import { useEffect, useState } from 'react';
import { templatesApi } from '@/api/templates';
import { Button } from './Button';
import { Input } from './Input';
import { BUSINESS_LINES, SCENARIOS, TEMPLATE_TYPES, SCENARIO_LABELS } from '@/projectsMeta';
import type { Scenario } from '@mediakit/shared';
import type { TemplateSummary } from '@mediakit/shared';
import { getCampaign } from '@/api/campaigns';
import { PeriodPicker } from './period-picker/PeriodPicker';
import { computeDefaultPeriod, earlierDate, validatePeriod, type Period } from './period-picker/periodRange';
import { todayIso } from './period-picker/today';

interface Props {
  open: boolean;
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (values: {
    templateId: string;
    name: string;
    reportPeriod?: { startDate?: string; endDate?: string };
  }) => void;
}

/**
 * 「从模板新建项目」对话框：仅列出已发布模板，选一个 + 可改项目名。
 * 调用方拿 templateId 走 createProjectFromTemplate。
 */
export function CreateFromTemplateDialog({ open, loading, error, onCancel, onSubmit }: Props) {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [fetching, setFetching] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('');
  const [name, setName] = useState('');
  const [period, setPeriod] = useState<Period>({ startDate: '', endDate: '' });
  const [range, setRange] = useState<{ min: string; max: string } | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [periodValid, setPeriodValid] = useState(true);
  const [filterBL, setFilterBL] = useState<string>('');
  const [filterScenario, setFilterScenario] = useState<Scenario | ''>('');
  const [filterTemplateType, setFilterTemplateType] = useState<string>('');

  // 打开或筛选条件变化时拉取已发布模板（USER/ADMIN 均只取 PUBLISHED：草稿无法建项目）。
  // cancelled 标志：deps 变化或对话框关闭/卸载时置 true，丢弃被取代的过期响应，避免竞态覆盖。
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setFetching(true);
    templatesApi
      .list({
        status: 'PUBLISHED',
        ...(filterBL ? { businessLine: filterBL } : {}),
        ...(filterScenario ? { scenario: filterScenario } : {}),
        ...(filterTemplateType ? { templateType: filterTemplateType } : {}),
      })
      .then((list) => {
        if (cancelled) return;
        setTemplates(list);
        setSelectedId(list[0]?.id ?? '');
        setName('');
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, filterBL, filterScenario, filterTemplateType]);

  // 选中 ai-html 报告模版时,拉 Campaign 配置区间作有效窗口,并算推荐默认起止日期。
  // cancelled: deps 变化/卸载时丢弃过期响应,避免竞态覆盖。
  useEffect(() => {
    const t = templates.find((x) => x.id === selectedId);
    const cid = t?.meta?.campaignId;
    const live = (t?.meta?.styleType === 'ai-html' || t?.meta?.renderType === 'html-report') && !!cid;
    if (!live || !cid) {
      setRange(null);
      setPeriod({ startDate: '', endDate: '' });
      return;
    }
    let cancelled = false;
    // 同步清掉上一模板的窗口/日期:fetch 期间不残留 A 的状态供 B 误提交。
    setRange(null);
    setPeriod({ startDate: '', endDate: '' });
    setRangeLoading(true);
    const rp = (t?.meta as { reportPeriod?: { startDate?: string; endDate?: string } } | undefined)?.reportPeriod;
    // 降级:不标区间、不越界校验,但仍保留起≤止+非空校验(PeriodPicker required)。
    const fallback = () => {
      setRange(null);
      setPeriod({ startDate: rp?.startDate ?? '', endDate: rp?.endDate ?? '' });
    };
    getCampaign(cid)
      .then((c) => {
        if (cancelled) return;
        if (!c) {
          // campaign 已不存在(getCampaign 吞错返回 undefined):与失败同路降级。
          fallback();
          return;
        }
        const min = c.startDate;
        const max = earlierDate(c.endDate, todayIso()); // 未来日期无数据
        if (min > max) {
          // 未开始/坏数据 → 窗口为空:按无窗口降级,避免对话框变死胡同。
          fallback();
          return;
        }
        setRange({ min, max });
        const candidate = rp ? { startDate: rp.startDate ?? '', endDate: rp.endDate ?? '' } : null;
        const initial =
          candidate && validatePeriod(candidate, { min, max }).ok ? candidate : computeDefaultPeriod(min, max);
        setPeriod(initial);
      })
      .catch(() => {
        if (!cancelled) fallback();
      })
      .finally(() => {
        if (!cancelled) setRangeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, templates]);

  if (!open) return null;

  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const isLiveReport =
    !!selected &&
    (selected.meta?.styleType === 'ai-html' || selected.meta?.renderType === 'html-report') &&
    !!selected.meta?.campaignId;
  const canSubmit =
    !!selectedId && !loading && !fetching && (isLiveReport ? periodValid && !rangeLoading : true);

  const submit = () => {
    if (!selected) return;
    // 复核而非只信 periodValid 镜像(后者经 effect 一帧滞后):以 validatePeriod 实时结果为准。
    if (isLiveReport && !validatePeriod(period, { min: range?.min, max: range?.max, required: true }).ok) return;
    onSubmit({
      templateId: selected.id,
      name: name.trim() || selected.name,
      ...(isLiveReport ? { reportPeriod: { startDate: period.startDate, endDate: period.endDate } } : {}),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => !loading && onCancel()}
      role="presentation"
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-surface-primary p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3 className="font-headings text-base font-semibold text-foreground-primary">从模板新建报告</h3>
        <p className="mt-0.5 text-xs text-foreground-muted">选择一个已发布模板，深拷贝其页面/尺寸作为新报告起点。</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-foreground-secondary">
            <span>业务线</span>
            <select
              value={filterBL}
              onChange={(e) => setFilterBL(e.target.value)}
              className="rounded-lg border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-secondary"
            >
              <option value="">全部</option>
              {BUSINESS_LINES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-xs text-foreground-secondary">
            <span>场景</span>
            <select
              value={filterScenario}
              onChange={(e) => {
                setFilterScenario(e.target.value as Scenario | '');
                setFilterTemplateType('');
              }}
              className="rounded-lg border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-secondary"
            >
              <option value="">全部</option>
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
          {filterScenario && (
            <label className="flex items-center gap-1 text-xs text-foreground-secondary">
              <span>模版类型</span>
              <select
                value={filterTemplateType}
                onChange={(e) => setFilterTemplateType(e.target.value)}
                className="rounded-lg border border-border-default bg-surface-primary px-2 py-1 text-xs text-foreground-secondary"
              >
                <option value="">全部</option>
                {TEMPLATE_TYPES[filterScenario].map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="mt-4 min-h-[200px] flex-1 overflow-auto">
          {fetching ? (
            <p className="p-4 text-sm text-foreground-muted">加载模板…</p>
          ) : templates.length === 0 ? (
            <p className="p-4 text-sm text-foreground-muted">暂无已发布模板。</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {templates.map((t) => {
                const active = t.id === selectedId;
                const bl = t.meta?.businessLine ?? '';
                const sc = t.meta?.scenario ? SCENARIO_LABELS[t.meta.scenario] : '';
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`flex flex-col overflow-hidden rounded-lg border text-left transition ${
                      active
                        ? 'border-accent-primary ring-2 ring-accent-primary/20'
                        : 'border-border-default hover:border-border-hover hover:bg-surface-hover'
                    }`}
                  >
                    {/* 缩略图占位区：用业务线/场景色做视觉区分 */}
                    <div
                      className="flex aspect-video items-center justify-center"
                      style={{
                        background: active
                          ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary, #6366f1))'
                          : 'linear-gradient(135deg, #f0f0f0, #e8e8e8)',
                      }}
                    >
                      <span
                        className="text-2xl font-bold"
                        style={{ color: active ? '#fff' : '#bbb' }}
                      >
                        {bl.slice(0, 2).toUpperCase() || 'TPL'}
                      </span>
                    </div>
                    {/* 信息区：只保留名称 + 业务线/场景标签 */}
                    <div className="flex flex-1 flex-col gap-1 p-2.5">
                      <span className="line-clamp-1 text-sm font-medium text-foreground-primary">{t.name}</span>
                      <div className="flex flex-wrap gap-1">
                        {bl && (
                          <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-secondary">
                            {bl}
                          </span>
                        )}
                        {sc && (
                          <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-foreground-secondary">
                            {sc}
                          </span>
                        )}
                        {t.meta?.isDefault && (
                          <span className="rounded bg-accent-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-primary">
                            默认
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selected && (
          <div className="mt-3">
            <Input
              label="报告名称（可选）"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={selected.name}
            />
          </div>
        )}

        {isLiveReport && (
          <>
            <PeriodPicker
              value={period}
              onChange={setPeriod}
              minDate={range?.min}
              maxDate={range?.max}
              required
              onValidityChange={setPeriodValid}
            />
            {rangeLoading && <p className="text-[10px] text-foreground-muted">加载投放区间…</p>}
            <p className="text-[10px] text-foreground-muted">
              HTML 报告会按此时间段生成实时数据；创建后可在编辑器里改周期重算。
            </p>
          </>
        )}

        {error && <p className="mt-3 text-xs text-red">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            取消
          </Button>
          <Button onClick={submit} loading={loading} disabled={!canSubmit}>
            创建报告
          </Button>
        </div>
      </div>
    </div>
  );
}
