import { useEffect, useMemo, useState } from 'react';
import type { ProjectSummary, ReportPeriod, Campaign } from '@mediakit/shared';
import { projectsApi } from '@/api/projects';
import { listCampaigns } from '@/api/campaigns';
import { Button } from './Button';
import { toast } from './Toast';

interface Props {
  project: ProjectSummary;
  onClose: () => void;
  onDone: () => void;
}

/** 日期字符串 +n 天(YYYY-MM-DD)。 */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const fmt = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  return fmt(d);
}

/** 两段 YYYY-MM-DD 区间是否有交集(字典序比较)。 */
function rangesOverlap(aS: string, aE: string, bS: string, bE: string): boolean {
  return aS <= bE && bS <= aE;
}

/** 从 month 字符串推导 startDate/endDate。 */
function monthToRange(month: string): { startDate: string; endDate: string } {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { startDate: fmt(start), endDate: fmt(end) };
}

/**
 * 复制报告弹窗：可选编辑报告周期。
 * 根据源项目的 scenarioSub 显示对应选择器：
 * - monthly / wrap-up → 月份选择
 * - weekly / biweekly → 日期范围
 * - 其他 → 不显示周期（直接复制）
 */
export function DuplicateProjectDialog({ project, onClose, onDone }: Props) {
  const meta = project.meta ?? {};
  const scenarioSub = meta.scenarioSub ?? '';
  const isMonthly = scenarioSub === 'monthly' || scenarioSub === 'wrap-up';
  const isDateRange = scenarioSub === 'weekly' || scenarioSub === 'biweekly';
  const hasPeriod = isMonthly || isDateRange;

  const currentPeriod = (meta.reportPeriod as ReportPeriod | undefined) ?? {};
  const [period, setPeriod] = useState<ReportPeriod>(currentPeriod);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ★ Campaign 换绑：拉取列表，默认选中源 campaign
  const isCampaignReport = !!meta.campaignId;
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState<string>(meta.campaignId ?? '');

  useEffect(() => {
    if (!isCampaignReport) return;
    let cancelled = false;
    listCampaigns()
      .then((list) => {
        if (!cancelled) setCampaigns(list);
      })
      .catch(() => {
        /* 上游不可用时静默：保持只读回显，不阻塞复制 */
      });
    return () => {
      cancelled = true;
    };
  }, [isCampaignReport]);

  // ★ 默认周期从所选 Campaign 投放期推导(而非"当前月"):
  //   monthly/wrap-up → 源月份(在投放期内时),否则投放首月
  //   weekly/biweekly → 源区间(与投放期有交集时),否则投放首周/首双周
  //   换绑 Campaign 时重新推导。
  useEffect(() => {
    if (!hasPeriod) return;
    if (isMonthly) {
      const src = currentPeriod.month;
      let month = src ?? '';
      if (campRange) {
        if (src) {
          const r = monthToRange(src);
          if (!rangesOverlap(r.startDate, r.endDate, campRange.s, campRange.e)) month = '';
        }
        if (!month) month = campRange.s.slice(0, 7);
      }
      if (!month) {
        const now = new Date();
        month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }
      setPeriod((p) => ({ ...p, month }));
    } else {
      const s0 = currentPeriod.startDate ?? '';
      const e0 = currentPeriod.endDate ?? '';
      const srcOk = s0 && e0 && (!campRange || rangesOverlap(s0, e0, campRange.s, campRange.e));
      if (srcOk) {
        setPeriod((p) => ({ ...p, startDate: s0, endDate: e0 }));
      } else if (campRange) {
        const span = scenarioSub === 'biweekly' ? 13 : 6;
        const end = addDays(campRange.s, span);
        setPeriod((p) => ({ ...p, startDate: campRange.s, endDate: end < campRange.e ? end : campRange.e }));
      } else {
        setPeriod((p) => ({ ...p, startDate: s0, endDate: e0 }));
      }
    }
    // currentPeriod/campRange 随 campaigns 加载与换绑变化时重推导
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaigns, campaignId]);

  async function handleConfirm() {
    if (periodError) {
      setError(periodError);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // 构建最终 reportPeriod
      let finalPeriod: ReportPeriod | undefined;
      if (isMonthly && period.month) {
        const range = monthToRange(period.month);
        finalPeriod = { month: period.month, ...range };
      } else if (isDateRange && (period.startDate || period.endDate)) {
        finalPeriod = { startDate: period.startDate, endDate: period.endDate };
      }

      const newProject = await projectsApi.duplicate(project.id, finalPeriod, campaignChanged ? campaignId : undefined);
      toast.success(`已复制为「${newProject.name}」`);
      onDone();
    } catch {
      setError('复制失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }

  function handleQuickCopy() {
    setSubmitting(true);
    setError(null);
    projectsApi
      .duplicate(project.id)
      .then((p) => {
        toast.success(`已复制为「${p.name}」`);
        onDone();
      })
      .catch(() => setError('复制失败，请重试'))
      .finally(() => setSubmitting(false));
  }

  // 是否换了 Campaign（决定提交时是否传 campaignId）
  const campaignChanged = isCampaignReport && campaignId !== '' && campaignId !== (meta.campaignId ?? '');

  // ★ 当前生效 Campaign 的投放期(优先列表实数据,列表不可用时回退源 meta 回显)
  const campRange = useMemo(() => {
    if (!isCampaignReport) return null;
    const c = campaigns.find((x) => x.id === campaignId);
    if (c?.startDate && c?.endDate) return { s: c.startDate, e: c.endDate };
    const info = meta.campaignInfo;
    if (info?.startDate && info?.endDate) return { s: info.startDate, e: info.endDate };
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaigns, campaignId, isCampaignReport]);

  // ★ 周期校验:与 Campaign 投放期必须有交集(完全越界 = 报告无数据,必须拦截)
  const periodError = useMemo(() => {
    if (!isCampaignReport || !campRange) return null;
    if (isMonthly && period.month) {
      const r = monthToRange(period.month);
      if (!rangesOverlap(r.startDate, r.endDate, campRange.s, campRange.e)) {
        return `所选月份不在 Campaign 投放期（${campRange.s} ~ ${campRange.e}）内`;
      }
    }
    if (isDateRange && period.startDate && period.endDate) {
      if (period.startDate > period.endDate) return '结束日期不能早于开始日期';
      if (!rangesOverlap(period.startDate, period.endDate, campRange.s, campRange.e)) {
        return `所选周期与 Campaign 投放期（${campRange.s} ~ ${campRange.e}）无交集`;
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, campRange, isMonthly, isDateRange, isCampaignReport]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-[440px] rounded-xl bg-surface-primary p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold text-foreground-primary">复制报告</h2>

        <div className="mb-4 space-y-2 text-xs text-foreground-secondary">
          <div>
            源报告：<span className="font-medium text-foreground-primary">{project.name}</span>
          </div>
          <div>
            报告类型：<span className="text-foreground-primary">{meta.scenarioSub ?? '—'}</span>
          </div>
          {/* ★ 回显源报告关联的 Campaign（campaignId 存在时才有意义） */}
          {meta.campaignId && (meta.campaignInfo?.campaignName || meta.campaignInfo?.startDate || meta.campaignInfo?.endDate) && (
            <div>
              关联 Campaign：
              <span className="text-foreground-primary">
                {[
                  meta.campaignInfo?.campaignName,
                  meta.campaignInfo?.startDate && meta.campaignInfo?.endDate
                    ? `${meta.campaignInfo.startDate} ~ ${meta.campaignInfo.endDate}`
                    : meta.campaignInfo?.startDate ?? meta.campaignInfo?.endDate,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
          )}
        </div>

        {/* ★ Campaign 换绑选择器（campaign-report 才显示；源回显为只读） */}
        {isCampaignReport && (
          <div className="mb-4 space-y-2">
            <label className="text-xs font-medium text-foreground-secondary">关联 Campaign</label>
            {campaigns.length === 0 ? (
              <p className="text-[11px] text-foreground-muted">
                {meta.campaignInfo?.campaignName ?? '—'}
                {meta.campaignInfo?.startDate && meta.campaignInfo?.endDate
                  ? ` · ${meta.campaignInfo.startDate} ~ ${meta.campaignInfo.endDate}`
                  : ''}
                （Campaign 列表不可用，将保持原关联复制）
              </p>
            ) : (
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="w-full rounded border border-border-default bg-surface-primary px-2 py-1.5 text-sm text-foreground-primary"
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.startDate && c.endDate ? `（${c.startDate} ~ ${c.endDate}）` : ''}
                  </option>
                ))}
              </select>
            )}
            {campaignChanged && (
              <p className="text-[10px] text-foreground-muted">
                换绑后副本将用新 Campaign 的数据重新渲染 HTML（data-field → AI → 日期替换三级链）。
              </p>
            )}
          </div>
        )}

        {hasPeriod && (
          <div className="mb-4 space-y-2">
            <label className="text-xs font-medium text-foreground-secondary">报告周期</label>
            {/* ★ 回显源周期（只读），编辑行才是新周期 */}
            {(currentPeriod.startDate || currentPeriod.endDate || currentPeriod.month) && (
              <p className="text-[11px] text-foreground-muted">
                源周期：
                {currentPeriod.month
                  ? currentPeriod.month
                  : `${currentPeriod.startDate ?? '—'} ~ ${currentPeriod.endDate ?? '—'}`}
              </p>
            )}
            {isMonthly ? (
              <input
                type="month"
                value={period.month ?? ''}
                onChange={(e) => setPeriod({ ...period, month: e.target.value })}
                className="w-full rounded border border-border-default bg-surface-primary px-2 py-1.5 text-sm text-foreground-primary"
              />
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={period.startDate ?? ''}
                  onChange={(e) => setPeriod({ ...period, startDate: e.target.value })}
                  className="flex-1 rounded border border-border-default bg-surface-primary px-2 py-1.5 text-sm text-foreground-primary"
                />
                <span className="text-foreground-muted">~</span>
                <input
                  type="date"
                  value={period.endDate ?? ''}
                  onChange={(e) => setPeriod({ ...period, endDate: e.target.value })}
                  className="flex-1 rounded border border-border-default bg-surface-primary px-2 py-1.5 text-sm text-foreground-primary"
                />
              </div>
            )}
            {campRange && (
              <p className="text-[10px] text-foreground-muted">
                Campaign 投放期：{campRange.s} ~ {campRange.e}，报告周期需与之有交集。
              </p>
            )}
            {periodError ? (
              <p className="text-[11px] text-red">{periodError}</p>
            ) : (
              <p className="text-[10px] text-foreground-muted">
                复制后报告中的周期文案、页眉日期将自动更新为新周期。
              </p>
            )}
          </div>
        )}

        {error && <div className="mb-3 text-xs text-red">{error}</div>}

        <div className="flex justify-end gap-2">
          {hasPeriod && (
            <Button variant="ghost" onClick={handleQuickCopy} disabled={submitting}>
              直接复制
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || !!periodError}>
            {submitting ? '复制中…' : hasPeriod ? '复制并更新周期' : '复制'}
          </Button>
        </div>
      </div>
    </div>
  );
}
