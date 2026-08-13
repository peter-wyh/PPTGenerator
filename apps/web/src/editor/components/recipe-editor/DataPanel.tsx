/**
 * DataPanel — Recipe 数据层(v1)。
 * v1 提供:
 *  - campaignId 输入(默认回显当前绑定值)
 *  - reportPeriod 起止日期
 *  - 「重新生成」按钮:
 *    - 有 versionId(G2 已接线):调 recomputeRecipe(versionId, period) → 后端按新时间段
 *      重跑 mapCampaign 并落库(覆盖 reportContent/html/meta.reportPeriod),onRecomputed
 *      回调让父组件重载版本,配合 RecipeEditor key 重挂载注入新数据。
 *    - 无 versionId(降级):走 generate({mode:'recipe'}) 全量重跑,返回 HTML,不落库,
 *      onRegenerated 只刷新预览。
 *
 * 有 versionId 时重新生成会持久化;否则只刷新预览。
 */
import { useState } from 'react';
import { htmlTemplatesApi } from '@/api/htmlTemplates';

interface Props {
  campaignId?: string;
  reportPeriod?: { startDate?: string; endDate?: string };
  /** 当前 recipe 版本 id(G2 接线后传入,有值则走 recomputeRecipe 持久化路径)。 */
  versionId?: string;
  /** 有 versionId 时,recompute 成功后回调(父组件重载版本,新 reportContent 注入)。 */
  onRecomputed?: () => void;
  /** 无 versionId 时的降级回调,父组件收到新 HTML 后刷新预览。 */
  onRegenerated?: (html: string) => void;
}

export function DataPanel({ campaignId: initialCampaignId, reportPeriod: initialPeriod, versionId, onRecomputed, onRegenerated }: Props) {
  const [campaignId, setCampaignId] = useState(initialCampaignId ?? '');
  const [startDate, setStartDate] = useState(initialPeriod?.startDate ?? '');
  const [endDate, setEndDate] = useState(initialPeriod?.endDate ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegenerate = async () => {
    if (!campaignId.trim()) {
      setError('请填写 Campaign ID');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (versionId) {
        await htmlTemplatesApi.recomputeRecipe(versionId, {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        });
        onRecomputed?.(); // 父组件重载版本(新 reportContent 注入)
      } else {
        const html = await htmlTemplatesApi.generate({
          mode: 'recipe',
          campaignId: campaignId.trim(),
          reportPeriod: { startDate: startDate || undefined, endDate: endDate || undefined },
        });
        onRegenerated?.(html);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string }; message?: string } }; message?: string };
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          err.message ||
          '重新生成失败',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <fieldset className="rounded-lg border border-border-default p-3">
      <legend className="px-1 text-xs font-medium text-foreground-secondary">📊 数据</legend>
      <label className="mb-1 block text-[11px] text-foreground-secondary">
        Campaign ID
        <input
          aria-label="Campaign ID"
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
          placeholder="如 camp-everyday-bf"
          className="mt-0.5 w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-[11px] text-foreground-primary outline-none focus:border-accent-primary"
        />
      </label>
      <div className="mb-2 grid grid-cols-2 gap-1.5">
        <label className="block text-[11px] text-foreground-secondary">
          起始日期
          <input
            aria-label="起始日期"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-0.5 w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-[11px] text-foreground-primary outline-none focus:border-accent-primary"
          />
        </label>
        <label className="block text-[11px] text-foreground-secondary">
          结束日期
          <input
            aria-label="结束日期"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-0.5 w-full rounded border border-border-default bg-surface-primary px-2 py-1 text-[11px] text-foreground-primary outline-none focus:border-accent-primary"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={handleRegenerate}
        disabled={loading || !campaignId.trim()}
        className="w-full rounded bg-accent-primary px-2 py-1.5 text-[11px] text-foreground-inverse hover:bg-accent-secondary disabled:opacity-50"
      >
        {loading ? '生成中…' : '🔄 重新生成'}
      </button>
      <p className="mt-1 text-[10px] leading-relaxed text-foreground-muted">
        重新生成会从 campaign 拉取最新数据并覆盖当前内容
      </p>
      {error && <p className="mt-1 text-[10px] text-red">{error}</p>}
    </fieldset>
  );
}
