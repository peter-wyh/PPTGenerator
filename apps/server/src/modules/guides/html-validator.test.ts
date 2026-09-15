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

  // ★ B4: count_class 数量断言(FT recap 资产化配套)
  it('count_class==N 单类精确计数:1 个 kpi-card(通过)/==2(失败)', () => {
    const pass = validateHtml(deckHtml, [{ assert: 'count_class==1 .kpi-card', severity: 'block' }]);
    expect(pass.results[0].passed).toBe(true);
    expect(pass.results[0].actual).toBe('1 (want 1)');
    const fail = validateHtml(deckHtml, [{ assert: 'count_class==2 .kpi-card', severity: 'block' }]);
    expect(fail.results[0].passed).toBe(false);
    expect(fail.results[0].actual).toBe('1 (want 2)');
  });

  it('count_class==N 复合类 .slide-2.pub-kpi 交集计数', () => {
    const r = validateHtml(deckHtml, [{ assert: 'count_class==1 .pub-kpi.slide-2', severity: 'block' }]);
    expect(r.results[0].passed).toBe(true);
    const miss = validateHtml(deckHtml, [{ assert: 'count_class==1 .pub-kpi.slide-9', severity: 'block' }]);
    expect(miss.results[0].passed).toBe(false);
    expect(miss.results[0].actual).toBe('0 (want 1)');
  });

  it('count_class==4 逐 slide 计数(data-slide 4 节)', () => {
    const r = validateHtml(deckHtml, [{ assert: 'count_class==4 .slide-1,.slide-2', severity: 'report' }]);
    // .cls1,.cls2 逗号形态不支持(语法不匹配) → invalid;单类逐个测才准
    expect(r.results[0].actual).toBe('invalid assertion syntax');
  });

  it('count_class 不支持的选择器形态 → unsupported selector 而非崩溃', () => {
    const r = validateHtml(deckHtml, [{ assert: 'count_class==1 div > p', severity: 'report' }]);
    expect(r.results[0].passed).toBe(false);
    expect(['unsupported selector', 'invalid assertion syntax']).toContain(r.results[0].actual);
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

  it('no_element 裸 token 连字符标签 + class 属性双扫(防 class="pgroup" 绕过;CSS 文本不算)', () => {
    // 裸 token 出现在 class 属性 → 算命中(即使无对应标签)
    const withCls = deckHtml.replace('<body>', '<body><div class="pgroup">x</div>');
    const failCls = validateHtml(withCls, [{ assert: 'no_element pgroup', severity: 'block' }]);
    expect(failCls.results[0].passed).toBe(false);
    // 连字符标签名(如 compare-table)→ 纯标签分支可识别,无标签且无 class → 通过
    const passHyphen = validateHtml(deckHtml, [{ assert: 'no_element compare-table', severity: 'block' }]);
    expect(passHyphen.results[0].passed).toBe(true);
    // CSS <style> 里的 .compare-table 定义文本 → 不算命中(只扫标签与 class 属性)
    const withCss = deckHtml.replace('<body>', '<body><style>table.compare-table{color:red}</style>');
    const passCss = validateHtml(withCss, [{ assert: 'no_element compare-table', severity: 'block' }]);
    expect(passCss.results[0].passed).toBe(true);
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
