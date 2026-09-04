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

/** 解析 "slide_count==4" / "has_class pub-ratio" 等 DSL。非法语法返回 null(调用方记为断言配置错误)。 */
function parseAssertion(dsl: string): { op: string; arg: string } | null {
  const s = dsl.trim();
  let m = s.match(/^slide_count\s*==\s*(\d+)$/);
  if (m) return { op: 'slide_count', arg: m[1] };
  m = s.match(/^has_class\s+([A-Za-z0-9_\-:.\\[\]="'() ]+)$/);
  if (m) return { op: 'has_class', arg: m[1].trim() };
  m = s.match(/^no_element\s+([A-Za-z0-9_\-:.\\[\]="'()*# ,>+~]+)$/);
  if (m) return { op: 'no_element', arg: m[1].trim() };
  m = s.match(/^contains_text\s+(.+)$/);
  if (m) return { op: 'contains_text', arg: m[1].trim() };
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
  m = s.match(/^\.([A-Za-z0-9_-]+)$/);
  if (m) return hasCssClass(html, m[1]) ? 1 : 0;
  m = s.match(/^([a-zA-Z][a-zA-Z0-9]*)\.([A-Za-z0-9_-]+)$/);
  if (m) {
    const re = new RegExp(`<${m[1]}\\b[^>]*class="[^"]*\\b${m[2]}\\b[^"]*"`, 'gi');
    return html.match(re)?.length ?? 0;
  }
  // 纯标签
  if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(s)) {
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
    case 'has_class': {
      const got = hasCssClass(html, parsed.arg);
      return { ...base, passed: got, actual: got ? 'found' : 'not found', message: check.message };
    }
    case 'no_element': {
      const n = countSelector(html, parsed.arg);
      if (n < 0) return { ...base, actual: 'unsupported selector', message: check.message ?? '选择器暂不支持' };
      return { ...base, passed: n === 0, actual: `${n} found`, message: check.message };
    }
    case 'contains_text': {
      const got = html.toLowerCase().includes(parsed.arg.toLowerCase());
      return { ...base, passed: got, actual: got ? 'found' : 'not found', message: check.message };
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
