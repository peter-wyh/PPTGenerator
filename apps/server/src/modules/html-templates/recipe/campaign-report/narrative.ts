// narrative.ts
import { z } from 'zod';
import type { CampaignReportContent } from './schema';

const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
// KEY 读取延迟到调用时,以便测试在 beforeEach 中覆盖 process.env.DEEPSEEK_API_KEY。
const deepseekApiKey = () => process.env.DEEPSEEK_API_KEY || '';

const ActionableCard = z.object({
  icon: z.string(),
  color: z.string(),
  title: z.string(),
  items: z.array(z.object({ text: z.string(), sub: z.string().optional() })),
  footer: z.string(),
});

const SYSTEM = `You write ONLY the narrative text for an affiliate marketing report's "Actionable Insights" section. You receive numbers; you return insight cards as JSON. Do not write HTML. Do not invent metrics not implied by the data.`;

function buildPrompt(c: CampaignReportContent): string {
  const topPublishers = [...c.publishers].slice(0, 5).map((p) => `${p.name} (${p.type.label}, revenue ${p.revenue}, clicks ${p.clicks}, orders ${p.orders})`);
  const kpis = c.kpis.map((k) => `${k.label}: ${k.value}`).join('; ');
  return `Campaign KPIs: ${kpis}.
Top publishers: ${topPublishers.join(' | ') || 'n/a'}.
Trend points: ${c.trend.labels.length}.

Return a JSON array (5 cards, in this order): "Top Performers", "High Traffic / Low CVR", "Best Performing Placement", "Creative Insight", "Action Required".
Each card: { icon (font-awesome name, e.g. trophy), color (one of: green, orange, blue, purple, red), title, items: [{text, sub?}], footer }.
Output ONLY the JSON array, no markdown fences, no prose.`;
}

function stripFences(s: string): string {
  return s.replace(/```(?:json)?\s*/gi, '').replace(/```\s*$/i, '').trim();
}

async function callDeepSeek(c: CampaignReportContent): Promise<any[]> {
  const res = await fetch(`${DEEPSEEK_API_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepseekApiKey()}` },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: buildPrompt(c) }],
      temperature: 0.5,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
  const data = await res.json() as any;
  const raw = stripFences(data.choices?.[0]?.message?.content ?? '');
  const parsed = JSON.parse(raw); // 抛 SyntaxError 由调用方触发重试/降级
  const arr = z.array(ActionableCard).parse(parsed);
  return arr;
}

/** 填组件 6。失败(网络/非200/非法JSON/Zod)→ 重试 1 次 → 仍失败返回 [](报告照常渲染)。 */
export async function fillActionable(c: CampaignReportContent): Promise<CampaignReportContent['actionable']> {
  if (!deepseekApiKey()) return [];
  try {
    return await callDeepSeek(c);
  } catch {
    try {
      return await callDeepSeek(c); // 重试 1 次
    } catch {
      return []; // 降级
    }
  }
}
