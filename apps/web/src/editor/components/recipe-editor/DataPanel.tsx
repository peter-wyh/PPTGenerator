/**
 * DataPanel — Recipe 数据层(v1)。
 * v1 不做实时数据刷新(无 map 端点),只提供:
 *  - campaignId 输入(默认回显当前绑定值)
 *  - reportPeriod 起止日期
 *  - 「重新生成」按钮 → 调 htmlTemplatesApi.generate({mode:'recipe', campaignId, reportPeriod})
 *    返回全量 HTML,onRegenerated 回调让父组件刷新预览。
 *
 * 重新生成会重新跑 mapCampaign,把 campaign 最新数据拉进 reportContent。
 */
import { useState } from 'react';
import { htmlTemplatesApi } from '@/api/htmlTemplates';

interface Props {
  campaignId?: string;
  reportPeriod?: { startDate?: string; endDate?: string };
  /** 重新生成完成后的回调,父组件收到新 HTML 后刷新预览。 */
  onRegenerated?: (html: string) => void;
  /** 生成失败/进行中状态外抛(可选,父组件可用来禁用其他操作)。 */
}

export function DataPanel({ campaignId: initialCampaignId, reportPeriod: initialPeriod, onRegenerated }: Props) {
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
      const html = await htmlTemplatesApi.generate({
        mode: 'recipe',
        campaignId: campaignId.trim(),
        reportPeriod: { startDate: startDate || undefined, endDate: endDate || undefined },
      });
      onRegenerated?.(html);
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
