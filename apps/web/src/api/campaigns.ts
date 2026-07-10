import type { Campaign } from '@mediakit/shared';
import { MOCK_CAMPAIGNS } from './mock/campaigns';

/**
 * 上游 Campaign 接口（demo 中 mock）。
 * 真实环境对接投放系统/CRM；这里返回固定 mock 列表，带模拟延迟。
 * campaign 类型场景（报告/提报）从本接口选择具体 campaign。
 *
 * mock 数据与 rollup 逻辑已抽离至 ./mock/campaigns。
 */

/** 模拟上游拉取 campaign 列表。 */
export function listCampaigns(): Promise<Campaign[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(MOCK_CAMPAIGNS.map((c) => ({ ...c }))), 300);
  });
}

/** 按 id 取单个 campaign。 */
export function getCampaign(id: string): Promise<Campaign | undefined> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(MOCK_CAMPAIGNS.find((c) => c.id === id)), 50);
  });
}
