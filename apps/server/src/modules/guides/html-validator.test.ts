import { describe, expect, it } from 'vitest';
import { validateHtml, lintChecks } from './html-validator';

const deckHtml = `
<html><head><link href="tailwind.css" rel="stylesheet"></head>
<body>
<section data-slide="1" class="slide-1 pub-hero">Cover</section>
<section data-slide="2" class="slide-2 pub-kpi"><div class="kpi-card">1.2M</div></section>
<section data-slide="3" class="slide-3 pub-ratio"><table class="data-table">...</table></section>
<section data-slide="4" class="slide-4 pub-package">PACKAGE</section>
<footer class="pub-footer">© viagogo 2026 · Confidential</footer>
</body></html>`;

describe('validateHtml · 4 类断言', () => {
  it('slide_count==4 精确匹配(通过)与 ==3(失败)', () => {
    const pass = validateHtml(deckHtml, [{ assert: 'slide_count==4', severity: 'report' }]);
    expect(pass.results[0].passed).toBe(true);
    expect(pass.results[0].actual).toBe('4 slides');
    const fail = validateHtml(deckHtml, [{ assert: 'slide_count == 3', severity: 'report' }]);
    expect(fail.results[0].passed).toBe(false);
    expect(fail.results[0].actual).toBe('4 slides');
  });

  it('has_class 必含类:存在通过/缺失失败(BEM 复合类名分词)', () => {
    const pass = validateHtml(deckHtml, [{ assert: 'has_class pub-ratio', severity: 'report' }]);
    expect(pass.results[0].passed).toBe(true);
    const fail = validateHtml(deckHtml, [{ assert: 'has_class pub-chart-x', severity: 'report' }]);
    expect(fail.results[0].passed).toBe(false);
  });

  it('no_element 禁含元素:nav 缺失通过/存在失败;tag[attr="v"] 形态', () => {
    const pass = validateHtml(deckHtml, [{ assert: 'no_element nav', severity: 'block' }]);
    expect(pass.results[0].passed).toBe(true);
    expect(pass.ok).toBe(true);
    const withNav = deckHtml.replace('<body>', '<body><nav class="top-nav">x</nav>');
    const fail = validateHtml(withNav, [{ assert: 'no_element nav', severity: 'block' }]);
    expect(fail.results[0].passed).toBe(false);
    expect(fail.blocked).toBe(1);
    expect(fail.ok).toBe(false);
    const noBlankLink = validateHtml(deckHtml, [{ assert: 'no_element a[href="#"]', severity: 'report' }]);
    expect(noBlankLink.results[0].passed).toBe(true);
  });

  it('contains_text 大小写不敏感', () => {
    const pass = validateHtml(deckHtml, [{ assert: 'contains_text CONFIDENTIAL', severity: 'report' }]);
    expect(pass.results[0].passed).toBe(true);
    const fail = validateHtml(deckHtml, [{ assert: 'contains_text watermark', severity: 'report' }]);
    expect(fail.results[0].passed).toBe(false);
  });
});

describe('severity 语义', () => {
  it('report 级失败不破坏 ok;block 级失败置 ok=false', () => {
    const reportOnly = validateHtml(deckHtml, [
      { assert: 'has_class missing-thing', severity: 'report' },
      { assert: 'no_element nav', severity: 'block' },
    ]);
    expect(reportOnly.failed).toBe(1);
    expect(reportOnly.blocked).toBe(0);
    expect(reportOnly.ok).toBe(true);
    const blocked = validateHtml(deckHtml, [
      { assert: 'has_class missing-thing', severity: 'block' },
    ]);
    expect(blocked.ok).toBe(false);
  });

  it('checks 为空 → 直接通过', () => {
    const r = validateHtml('<p>hi</p>', []);
    expect(r.ok).toBe(true);
    expect(r.total).toBe(0);
  });

  it('断言语法非法 → 记失败+提示,不抛异常', () => {
    const r = validateHtml(deckHtml, [{ assert: 'frobnicate 42', severity: 'report' }]);
    expect(r.results[0].passed).toBe(false);
    expect(r.results[0].actual).toContain('invalid');
  });
});

describe('lintChecks · 保存前静态检查', () => {
  it('合法断言全过;非法返回错误清单', () => {
    expect(lintChecks([
      { assert: 'slide_count==4', severity: 'block' },
      { assert: 'has_class pub-hero', severity: 'report' },
      { assert: 'no_element nav', severity: 'block' },
      { assert: 'contains_text © 2026', severity: 'report' },
    ])).toEqual([]);
    const bad = lintChecks([{ assert: 'slide_count > 4', severity: 'block' }]);
    expect(bad).toHaveLength(1);
    expect(bad[0].error).toContain('语法');
  });
});
