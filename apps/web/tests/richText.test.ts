import { describe, it, expect } from 'vitest';
import { sanitizeRichText } from '@/editor/richText';
import { renderHtmlWithHighlights } from '@/editor/richText';

describe('sanitizeRichText', () => {
  it('纯文本原样返回', () => {
    expect(sanitizeRichText('focus on tips')).toBe('focus on tips');
  });

  it('保留白名单标签', () => {
    expect(sanitizeRichText('<b>bold</b>')).toBe('<b>bold</b>');
    expect(sanitizeRichText('<i>i</i><strong>s</strong><em>e</em>')).toBe('<i>i</i><strong>s</strong><em>e</em>');
    expect(sanitizeRichText('<ul><li>a</li></ul>')).toBe('<ul><li>a</li></ul>');
    expect(sanitizeRichText('<p>p</p>')).toBe('<p>p</p>');
  });

  it('移除白名单标签上的所有属性', () => {
    expect(sanitizeRichText('<b style="color:red" class="x">b</b>')).toBe('<b>b</b>');
    expect(sanitizeRichText('<p class="c" data-x="1">p</p>')).toBe('<p>p</p>');
  });

  it('非白名单标签 unpack（保留文本，丢标签）', () => {
    expect(sanitizeRichText('<a href="x">click</a>')).toBe('click');
    expect(sanitizeRichText('<span style="color:red">s</span>')).toBe('s');
  });

  it('div（contentEditable 换行产物）unpack 并补 <br> 保留换行', () => {
    expect(sanitizeRichText('<div>line1<br>line2</div>')).toBe('line1<br>line2<br>');
  });

  it('危险标签连同内容整体移除', () => {
    expect(sanitizeRichText('<script>alert(1)</script>safe')).toBe('safe');
    expect(sanitizeRichText('<style>body{}</style>ok')).toBe('ok');
  });

  it('嵌套：外层非白名单、内层白名单', () => {
    expect(sanitizeRichText('<div><b>x</b></div>')).toBe('<b>x</b><br>');
  });

  it('空输入返回空字符串', () => {
    expect(sanitizeRichText('')).toBe('');
  });

  it('保留 <mark> 高亮标签（去属性）', () => {
    expect(sanitizeRichText('<mark>tips</mark>')).toBe('<mark>tips</mark>');
    expect(sanitizeRichText('<mark class="x" style="color:red">tips</mark>')).toBe('<mark>tips</mark>');
  });
});

describe('renderHtmlWithHighlights', () => {
  it('无高亮词 → 仅清洗', () => {
    expect(renderHtmlWithHighlights('<b>x</b>', '')).toBe('<b>x</b>');
    expect(renderHtmlWithHighlights('<a href="x">click</a>')).toBe('click');
  });

  it('纯文本命中 → 包强调 span', () => {
    expect(renderHtmlWithHighlights('focus on tips', 'tips')).toBe(
      'focus on <span class="text-accent-secondary font-medium">tips</span>',
    );
  });

  it('大小写无关命中', () => {
    expect(renderHtmlWithHighlights('Focus on TIPS', 'tips')).toBe(
      'Focus on <span class="text-accent-secondary font-medium">TIPS</span>',
    );
  });

  it('在富文本标签内的文本节点上高亮（不破坏标签）', () => {
    expect(renderHtmlWithHighlights('<b>big tips</b>', 'tips')).toBe(
      '<b>big <span class="text-accent-secondary font-medium">tips</span></b>',
    );
  });

  it('逗号分隔多词（中英文逗号）', () => {
    const out = renderHtmlWithHighlights('beauty and tips', 'beauty，tips');
    expect(out).toBe(
      '<span class="text-accent-secondary font-medium">beauty</span> and <span class="text-accent-secondary font-medium">tips</span>',
    );
  });

  it('先清洗后高亮：script 被剥离，剩余命中', () => {
    expect(renderHtmlWithHighlights('<script>x</script>tips', 'tips')).toBe(
      '<span class="text-accent-secondary font-medium">tips</span>',
    );
  });
});
