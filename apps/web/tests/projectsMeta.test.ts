import { describe, it, expect } from 'vitest';
import { SCENARIOS, TEMPLATE_TYPES, TEMPLATE_TYPE_LABELS } from '@/projectsMeta';

describe('TEMPLATE_TYPES', () => {
  it('每个场景都有模版类型取值', () => {
    for (const s of SCENARIOS) {
      expect(TEMPLATE_TYPES[s.id].length).toBeGreaterThan(0);
    }
  });

  it('campaign-report 取值与 scenarioSub 对齐', () => {
    const ids = TEMPLATE_TYPES['campaign-report'].map(([id]) => id);
    expect(ids).toEqual(['weekly', 'monthly', 'wrap-up']);
  });

  it('TEMPLATE_TYPE_LABELS 含全部 id', () => {
    const all = TEMPLATE_TYPES['campaign-report'].map(([id]) => id);
    for (const id of all) expect(TEMPLATE_TYPE_LABELS[id]).toBeTruthy();
  });
});
