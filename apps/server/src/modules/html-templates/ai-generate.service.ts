import { prisma } from '../../prisma';
import { ApiError } from '../../utils/ApiError';

/**
 * AI HTML 报告生成服务。
 * 使用 DeepSeek API（用户已有 key），将 campaign 数据 + 用户提示词生成完整 HTML 报告。
 */

const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

const SYSTEM_PROMPT = `You are a professional marketing report generator. You create beautiful, self-contained HTML reports with inline CSS (no external dependencies).

Rules:
1. Output ONLY valid HTML (<!DOCTYPE html>...</html>), no markdown fences, no explanations.
2. All CSS must be inline (<style> tag in <head>) — no external stylesheets, no CDN links.
3. The report must be a single self-contained HTML file that can be opened directly in any browser.
4. Use modern, clean design with good typography (system fonts only: -apple-system, 'Segoe UI', Roboto, etc.).
5. Include data visualizations using inline SVG or CSS-based bars/charts — no external chart libraries.
6. Use the campaign data provided by the user to fill in real numbers, names, dates.
7. Support both Chinese and English content based on the input language.
8. Include sections: Executive Summary, Key Metrics, Performance Breakdown, Creator Highlights (if applicable), and Recommendations.
9. Use semantic HTML (<section>, <article>, <header>, <footer>).
10. Color scheme: {{THEME}} (dark = dark background with light text; light = clean white with accent colors).`;

const USER_PROMPT_TEMPLATE = `Generate a complete HTML marketing report.

Theme: {{THEME}}
User instruction: {{PROMPT}}

Campaign data (JSON):
{{CAMPAIGN_DATA}}

Generate the full HTML report now. Output ONLY the HTML code, nothing else.`;

/** 当 designGuide 不为空时追加到 user prompt 的额外指令 */
const DESIGN_GUIDE_SUFFIX = `

**IMPORTANT — Brand Design Guide (from business line design.md):**
Follow the design guidelines below strictly. Use the specified colors, fonts, tone, layout preferences, and reporting conventions in your HTML:
{{DESIGN_GUIDE}}`;

export const aiGenerateService = {
  /**
   * Build the campaign context JSON from the database.
   * Selects core fields, desensitizes sensitive data.
   */
  async buildCampaignContext(campaignId: string): Promise<string> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        campaignCreators: {
          include: {
            creator: true,
            performance: true,
            cpsPerformances: true,
          },
        },
        businessLine: true,
        advertiser: true,
      },
    });
    if (!campaign) throw ApiError.notFound('Campaign 不存在');

    // Build a clean context object with core fields
    const context = {
      campaign: {
        name: campaign.name,
        platform: campaign.platform,
        period: `${campaign.startDate} ~ ${campaign.endDate}`,
        budget: campaign.budget,
        status: campaign.status,
        businessLine: campaign.businessLine?.name ?? campaign.businessLineCode,
        advertiser: campaign.advertiser?.name ?? campaign.advertiserName,
        metrics: campaign.metrics,
        analytics: campaign.analytics,
      },
      /** 业务线 design.md（品牌设计规范/报告要求文档） */
      designGuide: campaign.businessLine?.designMd ?? null,
      creators: campaign.campaignCreators.map((cc) => {
        const cpsTotal = cc.cpsPerformances.reduce(
          (acc, cps) => ({
            clicks: acc.clicks + cps.clicks,
            impressions: acc.impressions + cps.impressions,
            orders: acc.orders + cps.orders,
            gmv: acc.gmv + Number(cps.gmv),
            spend: acc.spend + Number(cps.spend),
            commission: acc.commission + Number(cps.commission),
          }),
          { clicks: 0, impressions: 0, orders: 0, gmv: 0, spend: 0, commission: 0 },
        );
        return {
          name: cc.creator?.name ?? 'Unknown',
          tier: cc.creator?.tier ?? '',
          contentType: cc.contentType,
          collabType: cc.collabType,
          totalPrice: cc.totalPrice,
          currency: cc.currency,
          performance: cc.performance?.summary ?? null,
          cps: Object.keys(cpsTotal).length > 0 ? cpsTotal : null,
        };
      }),
    };

    return JSON.stringify(context, null, 2);
  },

  /**
   * Call DeepSeek to generate HTML from campaign data + prompt.
   */
  async generateHtml(params: {
    campaignId?: string;
    prompt: string;
    theme?: 'light' | 'dark';
    designMd?: string;
  }): Promise<string> {
    if (!DEEPSEEK_API_KEY) {
      throw ApiError.internal('DeepSeek API key 未配置（DEEPSEEK_API_KEY）');
    }

    const theme = params.theme ?? 'light';
    const campaignData = params.campaignId
      ? await this.buildCampaignContext(params.campaignId)
      : 'No campaign data provided.';

    // 从 campaign 数据中提取 designGuide（buildCampaignContext 已含此字段）
    // 前端传入的 designMd 优先（用户可能已编辑）
    let designGuide = '';
    try {
      const parsed = JSON.parse(campaignData);
      designGuide = parsed.designGuide ?? '';
    } catch { /* ignore parse errors */ }
    // 前端传来的 designMd 覆盖 DB 值
    if (params.designMd !== undefined) {
      designGuide = params.designMd;
    }

    let userPrompt = USER_PROMPT_TEMPLATE
      .replace('{{THEME}}', theme === 'dark' ? 'dark background with light text' : 'clean white with accent colors')
      .replace('{{PROMPT}}', params.prompt || 'Generate a comprehensive campaign report')
      .replace('{{CAMPAIGN_DATA}}', campaignData);

    // 追加业务线 design.md 规范
    if (designGuide && designGuide.trim()) {
      userPrompt += DESIGN_GUIDE_SUFFIX.replace('{{DESIGN_GUIDE}}', designGuide.trim());
    }

    const response = await fetch(`${DEEPSEEK_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT.replace('{{THEME}}', theme === 'dark' ? 'dark' : 'light') },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      throw ApiError.internal(`DeepSeek API 调用失败 (${response.status}): ${errText}`);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content ?? '';

    // V4 Pro (reasoning model) — content may contain thinking process before the HTML.
    // Strategy: strip markdown fences, then find the first <!DOCTYPE or <html tag.
    let html = content;

    // Strip markdown code fences (```html, ```markdown, ```, etc.)
    html = html.replace(/```(?:html|HTML|markdown|md)?\s*/gi, '').trim();

    // If content doesn't start with <, try to find the HTML start
    if (html && !html.startsWith('<')) {
      const doctypeIdx = html.indexOf('<!DOCTYPE');
      const htmlIdx = html.indexOf('<html');
      const startIdx = doctypeIdx >= 0 ? doctypeIdx : (htmlIdx >= 0 ? htmlIdx : -1);
      if (startIdx >= 0) {
        html = html.substring(startIdx);
      }
    }

    // Remove trailing content after </html>
    const endIdx = html.lastIndexOf('</html>');
    if (endIdx >= 0) {
      html = html.substring(0, endIdx + '</html>'.length);
    }

    if (!html || !html.startsWith('<')) {
      console.error('[AI Generate] HTML parse failed. content length:', content.length, 'first 200 chars:', content.substring(0, 200));
      throw ApiError.internal('AI 生成的 HTML 格式异常');
    }

    return html;
  },
};
