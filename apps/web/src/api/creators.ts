/**
 * 上游达人（Creator / Influencer）接口。
 * 真实环境对接达人库/CRM；数据管理库（`/api/v1/data`）提供可导入的达人库。
 * metrics 为达人自身频道 KPI（Avg Reach/Impressions/Follower Growth/CPM）。
 */
import type { Creator } from '@mediakit/shared';
import { dataApi, type DataRecordDTO } from './dataLibrary';
import { listCreatorPerformance } from './creatorPerformance';
import { getCampaign } from './campaigns';

export type { Creator };

/** 从数据管理库拉取达人列表。 */
export async function listCreators(): Promise<Creator[]> {
  const records = await dataApi.list<Creator>('creator');
  return records.map((r) => r.data);
}

/**
 * 获取 Campaign 下参与合作的达人列表（从 campaign performance 数据提取）。
 * 返回的 Creator 仅含基本信息，不含 channel KPI。
 * v1 限制：对导入的 campaign 返回空（无 campaign↔达人合作明细）。
 */
export async function listCampaignCreators(campaignId: string): Promise<Creator[]> {
  const perfs = await listCreatorPerformance(campaignId);
  return perfs.map((p) => ({
    id: p.creatorId,
    name: p.creatorName,
    handle: p.handle ?? `@${p.creatorName.toLowerCase().replace(/\s+/g, '')}`,
    platform: p.platform,
    tier: p.tier,
    followers: p.summary.totalImpressions,
    engagement: p.summary.avgEngagementRate,
    category: '',
    region: '',
    metrics: [],
  }));
}

/**
 * 取某 campaign 的合作达人列表（按 campaign.creatorIds 从达人库解析）。
 * 孤儿 id（达人已删 / 404）静默跳过。导入 campaign 无 creatorIds → 返回空。
 * 与 listCampaignCreators（creatorPerformance mock 派生，服务 demo 效果展开）解耦。
 */
export async function listCampaignCollaborators(campaignId: string): Promise<Creator[]> {
  const campaign = await getCampaign(campaignId);
  const ids = campaign?.creatorIds ?? [];
  if (ids.length === 0) return [];
  const settled = await Promise.allSettled(ids.map((id) => dataApi.get<Creator>(id)));
  return settled
    .filter((r): r is PromiseFulfilledResult<DataRecordDTO<Creator>> => r.status === 'fulfilled')
    .map((r) => r.value.data);
}
