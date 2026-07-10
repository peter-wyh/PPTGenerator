import { describe, it, expect } from 'vitest';
import { createProjectSchema } from '../src/modules/projects/projects.schema';

const meta = (theme: object) => ({ name: 't', meta: { theme } });

describe('projectThemeSchema v2 字段', () => {
  it('接受合法 v2 主题', () => {
    const r = createProjectSchema.safeParse(
      meta({
        color: { primary: '#FF5C00' },
        font: { text: 'inter' },
        lineHeight: { mode: 'fixed', value: 8 },
        format: { currencySymbol: '$', currencyPosition: 'before', thousandsSep: true, decimals: 0, compact: 'none' },
        chart: { showAxis: true, showGrid: true, legendPosition: 'bottom', barRadius: 4 },
        shadow: 'soft',
      }),
    );
    expect(r.success).toBe(true);
  });

  it('拒绝 barRadius 越界（>16）', () => {
    const r = createProjectSchema.safeParse(
      meta({ chart: { showAxis: true, showGrid: true, legendPosition: 'bottom', barRadius: 99 } }),
    );
    expect(r.success).toBe(false);
  });

  it('拒绝非法 shadow enum', () => {
    const r = createProjectSchema.safeParse(meta({ shadow: 'mega' }));
    expect(r.success).toBe(false);
  });

  it('拒绝非法 currencyPosition', () => {
    const r = createProjectSchema.safeParse(
      meta({ format: { currencySymbol: '$', currencyPosition: 'side', thousandsSep: true, decimals: 0, compact: 'none' } }),
    );
    expect(r.success).toBe(false);
  });

  it('老主题（无 v2 字段）仍合法', () => {
    const r = createProjectSchema.safeParse(meta({ color: { primary: '#FF5C00' } }));
    expect(r.success).toBe(true);
  });
});
