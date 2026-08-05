// narrative.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fillActionable } from './narrative';
import type { CampaignReportContent } from './schema';

const content = {
  header: { brand: { name: 'B', logoText: 'b' }, merchant: { name: 'M', logoText: 'M' }, period: { start: 's', end: 'e', display: 'd' } },
  kpis: [{ label: 'Total Revenues', value: '$876,360' }],
  trend: { labels: ['a'], revenue: [1], clicks: [1], orders: [1] },
  publishers: [{ name: 'Mia', type: { label: 'Creator', kind: 'creator' }, screenshotUrl: 'x', revenue: '$192,000', clicks: '1', orders: '1' }],
  actionable: [],
} as unknown as CampaignReportContent;

function okJson(obj: unknown) {
  return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(obj) } }] }) } as any;
}

beforeEach(() => { delete process.env.DEEPSEEK_API_KEY; process.env.DEEPSEEK_API_KEY = 'test-key'; vi.clearAllMocks(); });

describe('fillActionable', () => {
  it('合法 JSON → 解析 + Zod 通过,返回 5 卡', async () => {
    const cards = [{ icon: 'trophy', color: 'green', title: 'Top Performers', items: [{ text: 'Mia', sub: '(ROAS 4.10)' }], footer: 'Scale.' }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson(cards)));
    const out = await fillActionable(content);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Top Performers');
  });

  it('模型返回带 ```json 代码块 → 剥离后解析', async () => {
    const cards = [{ icon: 'star', color: 'blue', title: 'Best Placement', items: [{ text: 'Story' }], footer: 'x' }];
    const wrapped = '```json\n' + JSON.stringify(cards) + '\n```';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: wrapped } }] }) } as any));
    const out = await fillActionable(content);
    expect(out[0].title).toBe('Best Placement');
  });

  it('非法 JSON → 重试 1 次仍失败 → 降级返回 []', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: 'not json' } }] }) } as any));
    const out = await fillActionable(content);
    expect(out).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(2); // 初试 + 重试 1 次
  });

  it('HTTP 非 200 → 降级 []', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'err' } as any));
    const out = await fillActionable(content);
    expect(out).toEqual([]);
  });

  it('prompt 不含完整 HTML,只含数字摘要 + JSON 输出指令', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson([])));
    await fillActionable(content);
    const body = (fetch as any).mock.calls[0][1].body;
    expect(body).toContain('Total Revenues');
    expect(body).toMatch(/JSON|json/);
    expect(body).not.toContain('<html');
  });
});
