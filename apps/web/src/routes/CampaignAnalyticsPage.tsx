import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { campaignsApi } from '@/api/campaignsApi';
import { CampaignAnalyticsEditor } from '@/editor/components/CampaignAnalyticsEditor';

/**
 * Campaign 分析数据独立页（0918 从合作列表 tab 分拆）。
 * 分析数据是 Campaign 级素材（新客/AOV/品类/竞品声量/资源位截图），与达人级合作关系分属两层，
 * 原先藏在合作列表页 tab 里入口反直觉——分拆后与「⚡生成HTML」形成 补录素材→生成 动线。
 * 编辑器复用 CampaignAnalyticsEditor（独立组件，自带加载/保存）。
 */
export function CampaignAnalyticsPage() {
  const [params, setParams] = useSearchParams();
  const campaignId = params.get('campaignId') ?? '';
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    campaignsApi.list().then((list) => {
      setCampaigns((list ?? []).map((c) => ({ id: c.id, name: c.name })));
    }).catch(() => setCampaigns([]));
  }, []);

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-foreground-muted">选择 Campaign:</span>
        <select
          value={campaignId}
          onChange={(e) => {
            const next = e.target.value;
            if (next) setParams({ campaignId: next });
            else setParams({});
          }}
          className="rounded border border-border-subtle bg-surface-primary px-2 py-1 text-sm"
        >
          <option value="">— 选择 —</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-foreground-muted">
          报告生成素材的手工补录（Campaign 级整体表现），未录模块生成时自动省略
        </span>
      </div>
      {campaignId ? (
        <CampaignAnalyticsEditor
          key={campaignId}
          campaignId={campaignId}
          campaignName={campaigns.find((c) => c.id === campaignId)?.name}
        />
      ) : (
        <p className="py-8 text-center text-sm text-foreground-muted">请选择一个 Campaign 以编辑分析数据</p>
      )}
    </div>
  );
}
