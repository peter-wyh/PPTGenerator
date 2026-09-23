/**
 * S2 Agent 四维架构:HTML 校验器——指南 checks 断言的执行器。
 *
 * 设计边界(对应 docs/asset-ownership-matrix.md §8.2):
 *   - 校验器实现 = 平台代码,业务不可改;
 *   - 断言内容(checks) = 指南配置,业务自助维护(下拉模板填参数,非手写 DSL)。
 *
 * 4 类断言模板:
 *   slide_count==N        精确 slide 数(deck 类)
 *   has_class <name>      必含 CSS 类(pub-ratio / kpi-card …)
 *   no_element <sel>      禁含元素/选择器(nav / script[src*=...] / a[href="#"])
 *   contains_text <text>  必含文案(版权行/报告标题…)
 *
 * severity: report = 只报告; block = 进 fix 循环(重生成)。
 */

export interface GuideCheck {
  assert: string;
  severity: 'report' | 'block';
  message?: string;
}

export interface CheckResult {
  assert: string;
  severity: 'report' | 'block';
  passed: boolean;
  actual: string;
  message?: string;
}

export interface ValidateReport {
  ok: boolean;              // 所有 block 级断言通过
  total: number;
  failed: number;
  blocked: number;          // block 级失败数(>0 触发 fix 循环)
  results: CheckResult[];
}

/** 解析 "slide_count==4" / "count_class==4 .glass-kpi" 等 DSL。非法语法返回 null(调用方记为断言配置错误)。 */
function parseAssertion(dsl: string): { op: string; arg: string; num?: number; nums?: number[] } | null {
  const s = dsl.trim();
  let m = s.match(/^slide_count\s*==\s*(\d+)$/);
  if (m) return { op: 'slide_count', arg: m[1] };
  // ★ B4: 数量级断言 count_class==N(.cls 精确 / tag.cls / .cls1.cls2 复合)
  m = s.match(/^count_class\s*==\s*(\d+)\s+([\w\-.#]+)$/);
  if (m) return { op: 'count_class', arg: m[2], num: Number(m[1]) };
  // ★ 可选章节数量范围:count_class in [5,6,7] .badge → 命中集合内任一数即过
  m = s.match(/^count_class\s+in\s+\[([\d,\s]+)\]\s+([\w\-.#]+)$/);
  if (m) return { op: 'count_class_in', arg: m[2], nums: m[1].split(',').map((x) => Number(x.trim())) };
  // ★ h2 含文断言(可选章节场景,不锁顺序):h2_contains Monthly Performance Trend
  m = s.match(/^h2_contains\s+(.+)$/);
  if (m) return { op: 'h2_contains', arg: m[1].trim() };
  m = s.match(/^has_class\s+([A-Za-z0-9_\-:.\\[\]="'() ]+)$/);
  if (m) return { op: 'has_class', arg: m[1].trim() };
  m = s.match(/^no_element\s+([A-Za-z0-9_\-:.\\[\]="'()*# ,>+~]+)$/);
  if (m) return { op: 'no_element', arg: m[1].trim() };
  m = s.match(/^contains_text\s+(.+)$/);
  if (m) return { op: 'contains_text', arg: m[1].trim() };
  // ★ 0922: 反向包含断言 not_contains X → 全文(含 style/script 文本)不含 X 即过;severity:block 用于硬拦编造口径(如 SOV mentions)
  m = s.match(/^not_contains\s+(.+)$/);
  if (m) return { op: 'not_contains', arg: m[1].trim() };
  // ★ 章节标题序列契约:h2_texts == ['A','B','C'] → 文档 h2 文本须与序列完全一致(顺序+数量)
  m = s.match(/^h2_texts\s*==\s*\[(.+)\]$/);
  if (m) return { op: 'h2_texts', arg: m[1].trim() };
  return null;
}

function countSlides(html: string): number {
  // deck 约定:section[data-slide] / .slide / class 含 slide- 前缀容器
  const byAttr = html.match(/data-slide=/g)?.length ?? 0;
  if (byAttr) return byAttr;
  const byClass = html.match(/class="[^"]*\bslide(-\w+)?\b[^"]*"/g)?.length ?? 0;
  return byClass;
}

/** 提取 class 属性中是否含指定类(简单分词,支持 BEM 复合类名)。 */
function hasCssClass(html: string, cls: string): boolean {
  const classes = html.match(/class="([^"]*)"/g) ?? [];
  const target = cls.trim();
  return classes.some((attr) =>
    attr
      .slice(7, -1)
      .split(/\s+/)
      .includes(target),
  );
}

function countSelector(html: string, selector: string): number {
  // 轻量选择器支持:tag / .class / tag.class / #id / [attr*=v] / a[href="#"]
  // 完整 DOM 解析成本高,按常见断言形态用正则近似(校验器容忍误差,block 前有人工确认)。
  const s = selector.trim();
  let m = s.match(/^([a-zA-Z][a-zA-Z0-9]*)\[([a-zA-Z-]+)(\*?=)"([^"]*)"\]$/);
  if (m) {
    const [, tag, attr, , val] = m;
    const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}\\${m[3]}"[^"]*${val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*"[^>]*>`, 'gi');
    return html.match(re)?.length ?? 0;
  }
  m = s.match(/^\[([a-zA-Z-]+)\]$/);
  if (m) return (html.match(new RegExp(`\\s${m[1]}(=|\\s|>)`, 'gi')) ?? []).length;
  m = s.match(/^#([A-Za-z0-9_-]+)$/);
  if (m) return (html.match(new RegExp(`id="${m[1]}"`, 'gi')) ?? []).length;
  // ★ B4: .cls / .cls1.cls2 → 真实计数(原 0/1 布尔语义升级;no_element 的 n===0 语义不变)
  m = s.match(/^\.([A-Za-z0-9_-]+)(?:\.([A-Za-z0-9_-]+))?$/);
  if (m) {
    const tokens = [m[1], m[2]].filter(Boolean) as string[];
    const attrs = html.match(/class="([^"]*)"/g) ?? [];
    return attrs.filter((attr) => {
      const parts = attr.slice(7, -1).split(/\s+/);
      return tokens.every((t) => parts.includes(t));
    }).length;
  }
  m = s.match(/^([a-zA-Z][a-zA-Z0-9]*)\.([A-Za-z0-9_-]+)$/);
  if (m) {
    const re = new RegExp(`<${m[1]}\\b[^>]*class="[^"]*\\b${m[2]}\\b[^"]*"`, 'gi');
    return html.match(re)?.length ?? 0;
  }
  // 纯标签(含连字符标签名,如 compare-table / custom-card)
  if (/^[a-zA-Z][a-zA-Z0-9-]*$/.test(s)) {
    return (html.match(new RegExp(`<${s}\\b`, 'gi')) ?? []).length;
  }
  return -1; // 无法识别的选择器
}

/** 执行单条断言。 */
function runCheck(html: string, check: GuideCheck): CheckResult {
  const base: CheckResult = { assert: check.assert, severity: check.severity, passed: false, actual: '' };
  const parsed = parseAssertion(check.assert);
  if (!parsed) {
    return { ...base, actual: 'invalid assertion syntax', message: check.message ?? '断言语法无法解析(检查模板参数)' };
  }
  switch (parsed.op) {
    case 'slide_count': {
      const want = Number(parsed.arg);
      const got = countSlides(html);
      return { ...base, passed: got === want, actual: `${got} slides`, message: check.message };
    }
    // ★ B4: count_class==N selector —— 复用 countSelector(支持 .cls / tag.cls / .cls1.cls2)
    case 'count_class': {
      const got = countSelector(html, parsed.arg);
      if (got < 0) return { ...base, actual: 'unsupported selector', message: check.message ?? '选择器暂不支持' };
      const want = parsed.num ?? 0;
      return { ...base, passed: got === want, actual: `${got} (want ${want})`, message: check.message };
    }
    // ★ 可选章节数量范围(如 Journey/Competitor 可选时 badge∈[5,6,7])
    case 'count_class_in': {
      const got = countSelector(html, parsed.arg);
      if (got < 0) return { ...base, actual: 'unsupported selector', message: check.message ?? '选择器暂不支持' };
      const want = parsed.nums ?? [];
      return { ...base, passed: want.includes(got), actual: `${got} (want one of [${want.join(',')}])`, message: check.message };
    }
    // ★ h2 含文断言(不锁顺序,可选章节场景)
    case 'h2_contains': {
      const h2s = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((mm) =>
        mm[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      );
      const got = h2s.some((t) => t.toLowerCase().includes(parsed.arg.toLowerCase()));
      return { ...base, passed: got, actual: got ? 'found' : 'not found', message: check.message };
    }
    case 'has_class': {
      const got = hasCssClass(html, parsed.arg);
      return { ...base, passed: got, actual: got ? 'found' : 'not found', message: check.message };
    }
    case 'no_element': {
      const n = countSelector(html, parsed.arg);
      if (n < 0) return { ...base, actual: 'unsupported selector', message: check.message ?? '选择器暂不支持' };
      // 裸 token(如 pgroup / compare-table):除标签外同时扫 class 属性,
      // 防 LLM 写 class="pgroup" 绕过(v4 自创类事故);CSS <style> 文本不算。
      const bare = parsed.arg.match(/^[A-Za-z0-9_-]+$/);
      const clsN = bare
        ? (html.match(new RegExp(`class="[^"]*\\b${bare[0]}\\b[^"]*"`, 'gi')) ?? []).length
        : 0;
      const total = n + clsN;
      return { ...base, passed: total === 0, actual: `${total} found`, message: check.message };
    }
    case 'contains_text': {
      const got = html.toLowerCase().includes(parsed.arg.toLowerCase());
      return { ...base, passed: got, actual: got ? 'found' : 'not found', message: check.message };
    }
    case 'not_contains': {
      const got = html.toLowerCase().includes(parsed.arg.toLowerCase());
      return { ...base, passed: !got, actual: got ? 'found (should be absent)' : 'absent', message: check.message };
    }
    case 'h2_texts': {
      // arg 形如 'A','B','C' → 解析期望序列;提取文档 h2 文本(去内联标签+解码常见实体)比对顺序+数量
      const unescape = (t: string) => t
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      const want = (parsed.arg.match(/'([^']*)'/g) ?? []).map((x) => unescape(x.slice(1, -1)));
      const h2s = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((mm) =>
        unescape(mm[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()),
      );
      const pass = want.length === h2s.length && want.every((w, i) => w === h2s[i]);
      return { ...base, passed: pass, actual: `got [${h2s.join(' | ')}]`, message: check.message };
    }
    default:
      return { ...base, actual: 'unknown op', message: check.message };
  }
}

/** 对 HTML 执行 checks 清单。checks 为空 = 直接通过(无断言不设防)。 */
export function validateHtml(html: string, checks: GuideCheck[]): ValidateReport {
  const results = (checks ?? []).map((c) => runCheck(html, c));
  const failed = results.filter((r) => !r.passed).length;
  const blocked = results.filter((r) => !r.passed && r.severity === 'block').length;
  return { ok: blocked === 0, total: results.length, failed, blocked, results };
}

/** 断言清单静态校验(保存 revision 时干跑,挡住 DSL 语法错误)。 */
export function lintChecks(checks: GuideCheck[]): Array<{ assert: string; error: string }> {
  return (checks ?? [])
    .map((c) => ({ assert: c.assert, error: parseAssertion(c.assert) ? '' : '语法无法解析' }))
    .filter((r) => r.error);
}
