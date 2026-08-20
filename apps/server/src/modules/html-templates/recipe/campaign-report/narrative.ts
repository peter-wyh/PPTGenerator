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

function buildPrompt(c: CampaignReportContent, voice?: string): string {
  const topPublishers = [...c.publishers].slice(0, 5).map((p) => `${p.name} (${p.type.label}, revenue ${p.revenue}, clicks ${p.clicks}, orders ${p.orders})`);
  const kpis = c.kpis.map((k) => `${k.label}: ${k.value}`).join('; ');
  const voiceSection = voice?.trim()
    ? `\nVOICE & TERMINOLOGY (from business line guide — MUST follow for ALL card text):\n${voice.trim()}\n`
    : '';
  return `Campaign KPIs: ${kpis}.
Top publishers: ${topPublishers.join(' | ') || 'n/a'}.
Trend points: ${c.trend.labels.length}.${voiceSection}

Return a JSON array (5 cards, in this order): "Top Performers", "High Traffic / Low CVR", "Best Performing Placement", "Creative Insight", "Action Required".
Each card: { icon (font-awesome name, e.g. trophy), color (one of: green, orange, blue, purple, red), title, items: [{text, sub?}], footer }.
Output ONLY the JSON array, no markdown fences, no prose.`;
}

function stripFences(s: string): string {
  return s.replace(/```(?:json)?\s*/gi, '').replace(/```\s*$/i, '').trim();
}

// 推理模型（glm-5.2 / deepseek-v4 等）推理过程占大量 token，需更大 max_tokens 让 content 有空间（对齐 ai-generate.service.ts）
const isReasoningModel = DEEPSEEK_MODEL.includes('reason') || DEEPSEEK_MODEL.includes('v4') || DEEPSEEK_MODEL.includes('glm');

async function callDeepSeek(c: CampaignReportContent, voice?: string): Promise<any[]> {
  const res = await fetch(`${DEEPSEEK_API_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepseekApiKey()}` },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: buildPrompt(c, voice) }],
      temperature: 0.5,
      max_tokens: isReasoningModel ? 16000 : 8192,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
  const data = await res.json() as any;
  const choice = data.choices?.[0];
  const contentText: string = choice?.message?.content ?? '';
  const reasoning: string = choice?.message?.reasoning_content ?? '';

  // 推理模型 content 可能为空（推理耗尽 token，finish_reason:"length"）：先尝试从 reasoning_content 抠 JSON 数组，抠不到再明确报错
  let raw = stripFences(contentText);
  if (!raw && reasoning) {
    const m = reasoning.match(/\[\s*\{[\s\S]*\}\s*\]/);
    raw = m ? stripFences(m[0]) : '';
  }
  if (!raw) {
    throw new Error(
      `narrative content 为空${reasoning ? `（推理 token 溢出, finish_reason=${choice?.finish_reason ?? 'unknown'}）` : ''}`,
    );
  }
  const parsed = JSON.parse(raw); // 抛 SyntaxError 由调用方触发重试/降级
  return z.array(ActionableCard).parse(parsed);
}

/** 填组件 6。失败(网络/非200/非法JSON/Zod)→ 重试 1 次 → 仍失败返回 [](报告照常渲染)。 */
export async function fillActionable(c: CampaignReportContent, voice?: string): Promise<CampaignReportContent['actionable']> {
  if (!deepseekApiKey()) return [];
  try {
    return await callDeepSeek(c, voice);
  } catch {
    try {
      return await callDeepSeek(c, voice); // 重试 1 次
    } catch (e2) {
      console.warn('[narrative] fillActionable 两次调用均失败，降级为空 actionable：', (e2 as Error)?.message ?? e2);
      return []; // 降级
    }
  }
}
