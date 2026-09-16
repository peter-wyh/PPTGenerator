/**
 * P1 指南提炼:从 HTML 样例提炼结构指南草稿(0915 待办)。
 * 独立小模块——不 import ai-generate.service(避免 2700 行巨物牵入)。
 * 输出草稿不入库:返回给前端,用户在指南编辑页修订后自行保存。
 */
import { guideService } from './guide.service';
import { ApiError } from '../../utils/ApiError';

const API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1';
const API_KEY = process.env.DEEPSEEK_API_KEY || '';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

/** HTML 预压缩:去 script/style 内容与注释,截断到安全长度,省 token */
function compressHtml(html: string, maxLen = 60_000): string {
  let h = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, (m) => {
      // style 保留选择器骨架(配色/字号线索),去声明细节
      return m.replace(/\{[^}]*\}/g, '{}');
    })
    .replace(/\s+/g, ' ')
    .trim();
  if (h.length > maxLen) h = h.slice(0, maxLen) + '\n<!-- TRUNCATED -->';
  return h;
}

const SYSTEM_PROMPT = `你是报告结构指南提炼器。输入一份报告 HTML 样例,输出一份 Markdown 结构指南(指南=该类报告的生成规范,AI 生成报告时会按它产出)。

必须包含以下章节(顺序固定):
## 0. 硬约束
- 画布尺寸、字体族、禁止事项(占位图/编造数据等)
## 1. 品牌视觉
- 从 HTML 中提取的配色 token(十六进制)、字体、圆角/阴影风格
## 2. 章节结构
- 逐章列出:章节名、布局(几列几卡)、每章渲染什么数据、无数据时如何降级
## 3. 展示形式偏好
- 图表类型、卡片/表格/截图墙的使用规则
## 4. 语调与术语
- 从文案中归纳的语气(如"专业克制")与术语表(如 Creator 为标准词)

规则:
- 只描述样例中真实存在的结构,不发明样例里没有的模块
- 数据槽位用 {campaign.analytics.trend} 形式的引用标注
- 输出纯 Markdown,不要代码块包裹,不要解释提炼过程`;

export async function distillGuideFromHtml(params: {
  html?: string;
  businessLineId?: string;
  guideName?: string;
}): Promise<{ draft: string; sourceBytes: number; sourceFrom: 'body' | 'recentHtml' }> {
  let html = params.html ?? '';
  let sourceFrom: 'body' | 'recentHtml' = 'body';
  if (!html) {
    html = (await guideService.listRecentGeneratedHtml(params.businessLineId!)) ?? '';
    sourceFrom = 'recentHtml';
  }
  if (!html) {
    throw ApiError.badRequest('未提供 HTML 且该业务线没有最近生成的报告可提炼');
  }

  const compressed = compressHtml(html);
  const userPrompt = `样例报告 HTML(已压缩):\n\n${compressed}\n\n${params.guideName ? `指南名称参考:${params.guideName}` : ''}\n\n请输出结构指南 Markdown。`;

  const res = await fetch(`${API_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 8192,
      stream: false,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`LLM 调用失败 (${res.status}): ${t.slice(0, 300)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  let draft = data.choices?.[0]?.message?.content ?? '';
  if (!draft.trim()) throw new Error('LLM 返回空内容');
  // 剥可能的 markdown 代码块包裹
  draft = draft.replace(/^```(?:markdown|md)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  return { draft, sourceBytes: html.length, sourceFrom };
}
