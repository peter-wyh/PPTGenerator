/**
 * 上游达人（Creator / Influencer）接口（demo 中 mock）。
 * 真实环境对接达人库/CRM；这里返回固定 mock 列表，带模拟延迟。
 * metrics 为达人自身频道 KPI（Avg Reach/Impressions/Follower Growth/CPM，见 mock/creators.buildChannelMetrics）。
 *
 * mock 数据与频道指标生成逻辑已抽离至 ./mock/creators。
 */
import type { CampaignMetric } from '@mediakit/shared';
import { MOCK_CREATORS } from './mock/creators';
import { listCreatorPerformance } from './creatorPerformance';

export interface Creator {
  id: string;
  name: string;
  handle: string;
  platform: string;
  tier: string; // mega / macro / micro
  followers: string;
  engagement: string;
  category: string;
  region: string;
  /** 达人自身频道 KPI 指标（Avg Reach/Impressions/Follower Growth/CPM）。 */
  metrics: CampaignMetric[];
}

/** 模拟上游拉取达人列表。 */
export function listCreators(): Promise<Creator[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(MOCK_CREATORS.map((c) => ({ ...c }))), 300);
  });
}

/**
 * 获取 Campaign 下参与合作的达人列表（从 campaign performance 数据提取）。
 * 返回的 Creator 对象仅含基本信息（id/name/platform/tier），不含 channel KPI。
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
