import { describe, it, expect } from 'vitest';
import {
  rollupCampaignMetrics,
  listCreatorPerformance,
} from '@/api/creatorPerformance';

/** 把 "¥1,234" / "3.21" / "5.2%" 等格式化值解析为可比较的数值。 */
const num = (s: string): number => Number(s.replace(/[^\d.]/g, ''));

describe('rollupCampaignMetrics · campaign = Σ creators', () => {
  it('9 项合并指标 + 固定英文标签顺序（GMV/Commission/ROAS/Clicks/Conversions/CVR/AOV/Spend/Impressions）', () => {
    const m = rollupCampaignMetrics('camp-glowlab-q4');
    expect(m.map((x) => x.label)).toEqual([
      'GMV', 'Commission', 'ROAS', 'Clicks', 'Conversions', 'CVR', 'AOV', 'Spend', 'Impressions',
    ]);
  });

  it('确定性：同输入同输出', () => {
    expect(rollupCampaignMetrics('camp-glowlab-q4')).toEqual(rollupCampaignMetrics('camp-glowlab-q4'));
  });

  it('campaign GMV = 其下所有达人 cps GMV 之和', async () => {
    const metrics = rollupCampaignMetrics('camp-glowlab-q4');
    const campaignGmv = num(metrics.find((m) => m.label === 'GMV')!.value);
    const perfs = await listCreatorPerformance('camp-glowlab-q4');
    const sumCreatorGmv = perfs.reduce((s, p) => s + num(p.cps.gmv), 0);
    expect(campaignGmv).toBe(sumCreatorGmv);
  });

  it('campaign Conversions(订单) = 其下所有达人订单之和', async () => {
    const metrics = rollupCampaignMetrics('camp-nova-home-618');
    const campaignOrders = num(metrics.find((m) => m.label === 'Conversions')!.value);
    const perfs = await listCreatorPerformance('camp-nova-home-618');
    const sumOrders = perfs.reduce((s, p) => s + num(p.cps.orders), 0);
    expect(campaignOrders).toBe(sumOrders);
  });

  it('ROAS = GMV / Spend（汇总后重算，非加性指标）', () => {
    const metrics = rollupCampaignMetrics('camp-glowlab-q4');
    const gmv = num(metrics.find((m) => m.label === 'GMV')!.value);
    const spend = num(metrics.find((m) => m.label === 'Spend')!.value);
    const roas = num(metrics.find((m) => m.label === 'ROAS')!.value);
    expect(roas).toBeCloseTo(gmv / spend, 1);
  });

  it('未知 campaign 返回全 0 指标（不抛错）', () => {
    const m = rollupCampaignMetrics('camp-nope');
    expect(num(m.find((x) => x.label === 'GMV')!.value)).toBe(0);
  });
});
