import type { Campaign, ReportCampaign } from '@mediakit/shared';
import { dataApi } from './dataLibrary';
import { getCampaignAnalytics } from './analytics/campaignAnalytics';
import { campaignsApi, dtoToCampaign } from './campaignsApi';

/**
 * 上游 Campaign 接口。
 * Phase 2: 优先从独立表 /api/v1/campaigns 拉取；失败回退 DataRecord。
 * 真实环境对接投放系统/CRM；数据管理库（`/api/v1/data`）提供可导入的 campaign 库。
 */

/** 从独立表或数据管理库拉取 campaign 列表。 */
export async function listCampaigns(): Promise<Campaign[]> {
  try {
    const dtos = await campaignsApi.list();
    if (dtos.length > 0) return dtos.map(dtoToCampaign);
  } catch {
    // fall through to DataRecord
  }
  const records = await dataApi.list<Campaign>('campaign');
  return records.map((r) => r.data);
}

/** 按 id 取单个 campaign；不存在返回 undefined。 */
export async function getCampaign(id: string): Promise<Campaign | undefined> {
  try {
    const dto = await campaignsApi.get(id);
    return dtoToCampaign(dto);
  } catch {
    // fall through to DataRecord
  }
  try {
    const record = await dataApi.get<Campaign>(id);
    return record.data;
  } catch {
    return undefined;
  }
}

/** Campaign → ReportCampaign，并附带分析数据包（趋势/新老客/洞察）。 */
export function reportCampaignFrom(c: Campaign): ReportCampaign {
  return {
    id: c.id,
    name: c.name,
    advertiser: c.advertiser,
    platform: c.platform,
    platforms: c.platforms,
    startDate: c.startDate,
    endDate: c.endDate,
    budget: c.budget,
    status: c.status,
    metrics: c.metrics,
    analytics: getCampaignAnalytics(c.id),
  };
}
