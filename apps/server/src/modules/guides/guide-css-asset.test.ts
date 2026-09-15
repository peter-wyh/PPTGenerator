import { describe, expect, it } from 'vitest';
import { injectGuideCss, GUIDE_CSS_PLACEHOLDER, type GuideCssBundle } from './guide-css-asset';

const BUNDLE: GuideCssBundle = {
  css: ':root{--color-aubergine:#28223D}',
  refs: [{ kind: 'css', ref: 'ft-recap/base.css', name: 'FT recap base.css' }],
};

const HTML = (head: string) => `<!DOCTYPE html><html><head>${head}</head><body><div class="hero">x</div></body></html>`;

describe('injectGuideCss', () => {
  it('占位符 → 精确替换为 <style> 资产原文', () => {
    const out = injectGuideCss(HTML(GUIDE_CSS_PLACEHOLDER), BUNDLE);
    expect(out).toContain('<style>');
    expect(out).toContain('--color-aubergine:#28223D');
    expect(out).not.toContain(GUIDE_CSS_PLACEHOLDER);
  });

  it('无占位符 → 兜底插 </head> 前(资产仍生效)', () => {
    const out = injectGuideCss(HTML(''), BUNDLE);
    expect(out).toContain('--color-aubergine:#28223D');
    expect(out.indexOf('<style>')).toBeLessThan(out.indexOf('</head>'));
  });

  it('无 head 无 body → 追加尾部', () => {
    const out = injectGuideCss('<div>x</div>', BUNDLE);
    expect(out).toContain('--color-aubergine:#28223D');
  });

  it('bundle=null → 清除残留占位符(编辑流无资产时)', () => {
    const out = injectGuideCss(HTML(GUIDE_CSS_PLACEHOLDER), null);
    expect(out).not.toContain(GUIDE_CSS_PLACEHOLDER);
    expect(out).not.toContain('<style>');
  });

  it('bundle=null 且无占位符 → 原样返回', () => {
    expect(injectGuideCss('<div>x</div>', null)).toBe('<div>x</div>');
  });

  it('多占位符 → 全部替换(LLM 重复输出场景)', () => {
    const out = injectGuideCss(HTML(GUIDE_CSS_PLACEHOLDER + GUIDE_CSS_PLACEHOLDER), BUNDLE);
    expect(out.match(/<style>/g)?.length).toBe(2);
    expect(out).not.toContain(GUIDE_CSS_PLACEHOLDER);
  });
});
