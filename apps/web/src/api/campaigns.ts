import type { Campaign, ReportCampaign } from '@mediakit/shared';
import { dataApi } from './dataLibrary';
import { getCampaignAnalytics } from './mock/campaignAnalytics';

/**
 * 上游 Campaign 接口。
 * 真实环境对接投放系统/CRM；数据管理库（`/api/v1/data`）提供可导入的 campaign 库。
 */

/** 从数据管理库拉取 campaign 列表。 */
export async function listCampaigns(): Promise<Campaign[]> {
  const records = await dataApi.list<Campaign>('campaign');
  return records.map((r) => r.data);
}

/** 按 id 取单个 campaign；不存在返回 undefined。 */
export async function getCampaign(id: string): Promise<Campaign | undefined> {
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
