import { describe, it, expect } from 'vitest';
import {
  formatCampaignDate,
  buildWrapUpPeriod,
  buildReportTitle,
  type ProjectMeta,
} from '@mediakit/shared';

const meta = (over: Partial<ProjectMeta> = {}): ProjectMeta => ({
  advertiser: 'GlowLab',
  scenarioSub: 'weekly',
  ...over,
});

describe('formatCampaignDate', () => {
  it('把 ISO 日期格式化为 YYYY.MM.DD', () => {
    expect(formatCampaignDate('2026-10-12')).toBe('2026.10.12');
  });
  it('截取前 10 位（容忍带时间的 ISO）', () => {
    expect(formatCampaignDate('2026-10-12T08:00:00Z')).toBe('2026.10.12');
  });
  it('空/非法返回空串', () => {
    expect(formatCampaignDate(undefined)).toBe('');
    expect(formatCampaignDate('')).toBe('');
    expect(formatCampaignDate('nope')).toBe('');
  });
});

describe('buildWrapUpPeriod', () => {
  it('两端齐全返回区间（半角破折号）', () => {
    expect(
      buildWrapUpPeriod(
        meta({ scenarioSub: 'wrap-up', campaignInfo: { startDate: '2026-10-12', endDate: '2026-11-10' } }),
      ),
    ).toBe('2026.10.12–2026.11.10');
  });
  it('缺一端回落 结案报告', () => {
    expect(buildWrapUpPeriod(meta({ scenarioSub: 'wrap-up', campaignInfo: { startDate: '2026-10-12' } }))).toBe(
      '结案报告',
    );
    expect(buildWrapUpPeriod(meta({ scenarioSub: 'wrap-up' }))).toBe('结案报告');
  });
});

describe('buildReportTitle', () => {
  it('周报', () => {
    expect(buildReportTitle(meta({ scenarioSub: 'weekly' }))).toBe("GlowLab's MEDIA REPORT · 上周");
  });
  it('月报', () => {
    expect(buildReportTitle(meta({ scenarioSub: 'monthly' }))).toBe("GlowLab's MEDIA REPORT · 上月");
  });
  it('结案取 campaign 区间', () => {
    expect(
      buildReportTitle(
        meta({ scenarioSub: 'wrap-up', campaignInfo: { startDate: '2026-10-12', endDate: '2026-11-10' } }),
      ),
    ).toBe("GlowLab's MEDIA REPORT · 2026.10.12–2026.11.10");
  });
  it('advertiser 空去掉前缀', () => {
    expect(buildReportTitle({ scenarioSub: 'weekly' })).toBe('MEDIA REPORT · 上周');
  });
  it('无 scenarioSub 不带周期', () => {
    expect(buildReportTitle({ advertiser: 'GlowLab' })).toBe("GlowLab's MEDIA REPORT");
  });
});
