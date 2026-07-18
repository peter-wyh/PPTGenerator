import { describe, it, expect } from 'vitest';
import { buildSeedCollaboration } from '@/api/analytics/collaborationSeed';

describe('buildSeedCollaboration', () => {
  it('每个 deliverable 含全部四槽（screenshots/metrics/wordcloud/audience）', () => {
    const c = buildSeedCollaboration('camp-glowlab-q4', 'cre-mia');
    expect(c.deliverables.length).toBeGreaterThan(0);
    for (const d of c.deliverables) {
      expect(d.screenshots?.length).toBeGreaterThan(0);
      expect(d.metrics?.length).toBeGreaterThan(0);
      expect(d.wordcloud?.length).toBeGreaterThan(0);
      expect(d.audience).toBeTruthy();
      expect(d.audience?.topCities?.length).toBeGreaterThan(0);
      expect(d.audience?.genderSplit?.length).toBeGreaterThan(0);
      expect(d.audience?.ageRange?.length).toBeGreaterThan(0);
    }
  });
});
