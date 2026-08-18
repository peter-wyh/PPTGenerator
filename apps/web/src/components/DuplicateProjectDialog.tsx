import { useEffect, useState } from 'react';
import type { ProjectSummary, ReportPeriod } from '@mediakit/shared';
import { projectsApi } from '@/api/projects';
import { Button } from './Button';
import { toast } from './Toast';

interface Props {
  project: ProjectSummary;
  onClose: () => void;
  onDone: () => void;
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

  // 月份默认取下一个月
  useEffect(() => {
    if (isMonthly && !period.month) {
      const existing = currentPeriod.month;
      if (existing) {
        setPeriod({ ...period, month: existing });
      } else {
        const now = new Date();
        const next = new Date(now.getFullYear(), now.getMonth(), 1);
        const fmt = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
        setPeriod({ ...period, month: fmt });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConfirm() {
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

      const newProject = await projectsApi.duplicate(project.id, finalPeriod);
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
            <p className="text-[10px] text-foreground-muted">
              复制后报告中的周期文案、页眉日期将自动更新为新周期。
            </p>
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
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? '复制中…' : hasPeriod ? '复制并更新周期' : '复制'}
          </Button>
        </div>
      </div>
    </div>
  );
}
