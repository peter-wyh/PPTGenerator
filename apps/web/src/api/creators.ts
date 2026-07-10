/**
 * 上游达人（Creator / Influencer）接口（demo 中 mock）。
 * 真实环境对接达人库/CRM；这里返回固定 mock 列表，带模拟延迟。
 * metrics 为跨该达人参与的所有 campaign 的汇总（见 creatorPerformance.rollupCreatorTotals）。
 *
 * mock 数据与 rollup 逻辑已抽离至 ./mock/creators。
 */
import type { CampaignMetric } from '@mediakit/shared';
import { MOCK_CREATORS } from './mock/creators';

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
  /** 跨该达人参与的所有 campaign 的汇总指标（GMV/ROAS/转化/佣金）。 */
  metrics: CampaignMetric[];
}

/** 模拟上游拉取达人列表。 */
export function listCreators(): Promise<Creator[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(MOCK_CREATORS.map((c) => ({ ...c }))), 300);
  });
}
