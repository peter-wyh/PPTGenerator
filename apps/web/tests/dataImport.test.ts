import { describe, it, expect, vi } from 'vitest';
import { buildPreviewFromRows, buildPreviewFromObjects, downloadTemplate, CAMPAIGN_REQUIRED, CREATOR_REQUIRED, CAMPAIGN_FIELDS } from '@/editor/dataImport';

describe('dataImport · 字段定义', () => {
  it('Campaign 必填含 id/name/advertiser/businessLine/platform/startDate/endDate/budget', () => {
    expect(CAMPAIGN_REQUIRED).toEqual(['id', 'name', 'advertiser', 'businessLine', 'platform', 'startDate', 'endDate', 'budget']);
  });
  it('Creator 必填含 id/name/handle/platform/tier/followers/engagement/category/region', () => {
    expect(CREATOR_REQUIRED).toEqual(['id', 'name', 'handle', 'platform', 'tier', 'followers', 'engagement', 'category', 'region']);
  });
});

describe('dataImport · buildPreviewFromRows(CSV/XLSX)', () => {
  it('必填齐全 → valid', () => {
    const rows = [{ id: 'c1', name: 'C', advertiser: 'A', businessLine: 'FT', platform: 'TikTok', startDate: '2026-01-01', endDate: '2026-01-31', budget: '$100K' }];
    const r = buildPreviewFromRows('campaign', rows);
    expect(r[0].valid).toBe(true);
    expect(r[0].data.id).toBe('c1');
  });
  it('缺 budget → invalid,error 列出缺失字段', () => {
    const rows = [{ id: 'c1', name: 'C', advertiser: 'A', businessLine: 'FT', platform: 'TikTok', startDate: '2026-01-01', endDate: '2026-01-31' }];
    const r = buildPreviewFromRows('campaign', rows);
    expect(r[0].valid).toBe(false);
    expect(r[0].error).toContain('budget');
  });
  it('空行(无必填)→ invalid', () => {
    expect(buildPreviewFromRows('creator', [{}])[0].valid).toBe(false);
  });
});

describe('dataImport · buildPreviewFromObjects(JSON)', () => {
  it('保留完整对象(含 metrics/platforms),只校验必填', () => {
    const items = [{ id: 'c1', name: 'C', advertiser: 'A', businessLine: 'FT', platform: 'TikTok', startDate: '2026-01-01', endDate: '2026-01-31', budget: '$100K', metrics: [{ label: 'GMV', value: '$1', compare: '+1%' }] }];
    const r = buildPreviewFromObjects('campaign', items);
    expect(r[0].valid).toBe(true);
    expect((r[0].data as { metrics: unknown[] }).metrics).toHaveLength(1);
  });
  it('非对象项 → invalid', () => {
    expect(buildPreviewFromObjects('campaign', [null])[0].valid).toBe(false);
  });
});

describe('dataImport · downloadTemplate', () => {
  it('触发 Blob 下载(生成 csv 文件名)', () => {
    const urlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    downloadTemplate('campaign');
    expect(urlSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    urlSpy.mockRestore(); revokeSpy.mockRestore(); clickSpy.mockRestore();
  });
});

describe('dataImport · creatorIds', () => {
  it('CAMPAIGN_FIELDS 含 creatorIds', () => {
    expect(CAMPAIGN_FIELDS).toContain('creatorIds');
  });
  it('buildPreviewFromRows: creatorIds 列分号分隔 → 拆数组', () => {
    const rows = [{ id: 'c1', name: 'C', advertiser: 'A', businessLine: 'FT', platform: 'TikTok', startDate: '2026-01-01', endDate: '2026-01-31', budget: '$100K', creatorIds: 'cre-mia;cre-sofia' }];
    const r = buildPreviewFromRows('campaign', rows);
    expect(r[0].valid).toBe(true);
    expect(r[0].data.creatorIds).toEqual(['cre-mia', 'cre-sofia']);
  });
  it('buildPreviewFromRows: creatorIds 空段过滤', () => {
    const rows = [{ id: 'c1', name: 'C', advertiser: 'A', businessLine: 'FT', platform: 'TikTok', startDate: '2026-01-01', endDate: '2026-01-31', budget: '$100K', creatorIds: 'cre-mia;' }];
    expect(buildPreviewFromRows('campaign', rows)[0].data.creatorIds).toEqual(['cre-mia']);
  });
  it('buildPreviewFromObjects: creatorIds 数组原样保留', () => {
    const items = [{ id: 'c1', name: 'C', advertiser: 'A', businessLine: 'FT', platform: 'TikTok', startDate: '2026-01-01', endDate: '2026-01-31', budget: '$100K', creatorIds: ['cre-mia'] }];
    expect(buildPreviewFromObjects('campaign', items)[0].data.creatorIds).toEqual(['cre-mia']);
  });
});
