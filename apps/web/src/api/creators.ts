/**
 * 上游达人（Creator / Influencer）接口。
 * 真实环境对接达人库/CRM；数据管理库（`/api/v1/data`）提供可导入的达人库。
 * metrics 为达人自身频道 KPI（Avg Reach/Impressions/Follower Growth/CPM）。
 */
import type { Creator } from '@mediakit/shared';
import { dataApi } from './dataLibrary';
import { listCreatorPerformance } from './creatorPerformance';

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
