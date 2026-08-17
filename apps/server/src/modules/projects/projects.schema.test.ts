import { describe, it, expect } from 'vitest';
import { updateProjectSchema, createProjectSchema, fromTemplateSchema } from './projects.schema';

/**
 * 全局页眉/页脚配置存于 Project.meta.headerConfig / footerConfig（参见 shared theme.ts）。
 * 历史回归：服务端 projectMetaFields 曾漏声明这两个字段，Zod 默认 strip 未知键，
 * validate 中间件再把 strip 后的结果 Object.assign 回 req.body —— 字段在落库前被静默丢弃，
 * 表现为「页眉页脚设置保存后刷新即丢失」「页眉背景不透明度不生效」。
 */
describe('projects.schema · meta.headerConfig / footerConfig 持久化', () => {
  it('updateProjectSchema 保留 headerConfig（含 background.opacity）', () => {
    const parsed = updateProjectSchema.parse({
      meta: {
        headerConfig: {
          enabled: true,
          height: 64,
          preset: 'split',
          background: { type: 'color', color: '#1a1a2e', opacity: 0.5 },
          borderColor: '#ebebeb',
        },
      },
    });
    expect(parsed.meta?.headerConfig).toBeDefined();
    expect(parsed.meta?.headerConfig?.enabled).toBe(true);
    expect(parsed.meta?.headerConfig?.background).toMatchObject({
      type: 'color',
      color: '#1a1a2e',
      opacity: 0.5,
    });
  });

  it('updateProjectSchema 保留 footerConfig', () => {
    const parsed = updateProjectSchema.parse({
      meta: {
        footerConfig: {
          enabled: true,
          height: 40,
          leftText: '© 2026 MediaKit',
          rightText: '{page}/{total}',
          background: '#f8f8f8',
        },
      },
    });
    expect(parsed.meta?.footerConfig).toBeDefined();
    expect(parsed.meta?.footerConfig?.leftText).toBe('© 2026 MediaKit');
    expect(parsed.meta?.footerConfig?.background).toBe('#f8f8f8');
  });

  it('headerConfig.background 兼容旧字符串形状', () => {
    const parsed = updateProjectSchema.parse({
      meta: { headerConfig: { enabled: true, background: '#ffffff' } },
    });
    expect(parsed.meta?.headerConfig?.background).toBe('#ffffff');
  });

  it('headerConfig.background.opacity 越界（>1）被拒', () => {
    expect(() =>
      updateProjectSchema.parse({
        meta: {
          headerConfig: { enabled: true, background: { type: 'color', color: '#000', opacity: 1.5 } },
        },
      }),
    ).toThrow();
  });

  it('createProjectSchema 同样保留 headerConfig / footerConfig', () => {
    const parsed = createProjectSchema.parse({
      name: 'demo',
      meta: { headerConfig: { enabled: true }, footerConfig: { enabled: false } },
    });
    expect(parsed.meta?.headerConfig?.enabled).toBe(true);
    expect(parsed.meta?.footerConfig?.enabled).toBe(false);
  });
});

/**
 * 同类回归：ProjectMeta 里还有多个字段（reportPeriod / renderType / aiHtmlStatus）
 * 以及 reportData.campaign.{platforms,analytics} 曾漏声明，被 Zod strip 后保存即丢。
 */
describe('projects.schema · 其它被 strip 的 meta / reportData 字段', () => {
  it('保留 reportPeriod（月报 month / 周报 startDate+endDate）', () => {
    const parsed = updateProjectSchema.parse({
      meta: { reportPeriod: { month: '2026-03' } },
    });
    expect(parsed.meta?.reportPeriod).toEqual({ month: '2026-03' });

    const parsed2 = updateProjectSchema.parse({
      meta: { reportPeriod: { startDate: '2026-03-02', endDate: '2026-03-08' } },
    });
    expect(parsed2.meta?.reportPeriod).toEqual({ startDate: '2026-03-02', endDate: '2026-03-08' });
  });

  it('保留 renderType（multi-page / long-poster / html-report）', () => {
    const parsed = updateProjectSchema.parse({ meta: { renderType: 'long-poster' } });
    expect(parsed.meta?.renderType).toBe('long-poster');
  });

  it('保留 aiHtmlStatus（generated / generating / pending）', () => {
    const parsed = updateProjectSchema.parse({ meta: { aiHtmlStatus: 'generated' } });
    expect(parsed.meta?.aiHtmlStatus).toBe('generated');
  });

  it('aiHtmlStatus 非法值被拒', () => {
    expect(() => updateProjectSchema.parse({ meta: { aiHtmlStatus: 'bogus' } })).toThrow();
  });

  it('保留 reportData.campaign.platforms（多平台多合作形式）', () => {
    const platforms = [
      { platform: 'TikTok', collaborationType: 'Content' },
      { platform: 'Instagram', collaborationType: 'Affiliate' },
    ];
    const parsed = updateProjectSchema.parse({
      meta: { reportData: { campaign: { id: 'c1', name: 'Camp', platforms } } },
    });
    expect(parsed.meta?.reportData?.campaign?.platforms).toEqual(platforms);
  });

  it('保留 reportData.campaign.analytics（自动回填的分析包，原样透传）', () => {
    const analytics = {
      trend: [{ date: '2026-01-01', revenue: 1000, spend: 200, commission: 50, orders: 10, roas: 5 }],
      weeklyTrend: [{ week: 'W1', start: '2026-01-01', revenue: 7000, spend: 1400, orders: 70, roas: 5 }],
      customerSplit: { newCustomers: 60, returningCustomers: 40, newCustomerRate: '60%' },
      insights: [
        {
          kind: 'scale-opportunity',
          severity: 'good',
          subjectType: 'campaign',
          subjectName: 'Camp',
          metrics: [{ label: 'ROAS', value: '5' }],
          rationale: 'r',
          action: 'a',
        },
      ],
      newCustomers: 60,
      aov: '$45',
      topCategories: [{ name: 'Skincare', revenue: 5000, share: '50%' }],
      topProducts: [{ name: 'Serum', revenue: 3000, units: 60 }],
      topMarkets: [{ name: 'US', revenue: 8000, share: '80%' }],
      promotionOffers: [{ name: '15% OFF', type: 'Code', revenue: '$2000', usageCount: 50 }],
    };
    const parsed = updateProjectSchema.parse({
      meta: { reportData: { campaign: { id: 'c1', name: 'Camp', analytics } } },
    });
    expect(parsed.meta?.reportData?.campaign?.analytics).toEqual(analytics);
  });
});


describe('fromTemplateSchema（/from-template 路由 body 校验）', () => {
  it('接受 templateId + name + 可选 reportPeriod', () => {
    const r = fromTemplateSchema.safeParse({
      templateId: 't1',
      name: 'n',
      reportPeriod: { startDate: '2026-01-01', endDate: '2026-01-31' },
    });
    expect(r.success).toBe(true);
  });
  it('reportPeriod 缺省也可', () => {
    expect(fromTemplateSchema.safeParse({ templateId: 't1', name: 'n' }).success).toBe(true);
  });
  it('缺 templateId → 失败', () => {
    expect(fromTemplateSchema.safeParse({ name: 'n' }).success).toBe(false);
  });
  it('templateId 空串 → 失败', () => {
    expect(fromTemplateSchema.safeParse({ templateId: '', name: 'n' }).success).toBe(false);
  });
});
