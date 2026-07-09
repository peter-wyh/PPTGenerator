import { describe, it, expect } from 'vitest';
import { sanitizeRichText } from '@/editor/richText';

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
});
