import { describe, expect, it } from 'vitest';
import { createGuideSchema, updateGuideSchema, listGuidesQuerySchema } from './guide.schema';

describe('guide schemas', () => {
  it('create: 全字段通过', () => {
    const r = createGuideSchema.safeParse({
      businessLineId: 'bl1', name: 'DG 月报指南', scenario: '月报',
      content: '# 指南\n## 语调与术语\n用「推广」', isDefault: true,
    });
    expect(r.success).toBe(true);
  });
  it('create: scenario 可空,content 必填非空', () => {
    expect(createGuideSchema.safeParse({ businessLineId: 'bl1', name: 'n', content: 'x' }).success).toBe(true);
    expect(createGuideSchema.safeParse({ businessLineId: 'bl1', name: 'n', content: '' }).success).toBe(false);
    expect(createGuideSchema.safeParse({ businessLineId: '', name: 'n', content: 'x' }).success).toBe(false);
  });
  it('update: 全部 optional', () => {
    expect(updateGuideSchema.safeParse({ isDefault: false }).success).toBe(true);
    expect(updateGuideSchema.safeParse({}).success).toBe(true);
  });
  it('list query: businessLineId 可选', () => {
    expect(listGuidesQuerySchema.safeParse({}).success).toBe(true);
    expect(listGuidesQuerySchema.safeParse({ businessLineId: 'bl1' }).success).toBe(true);
  });
});
