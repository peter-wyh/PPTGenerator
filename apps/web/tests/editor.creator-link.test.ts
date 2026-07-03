import { describe, it, expect } from 'vitest';
import { detectPlatform, parseCreatorLink } from '@/editor/creatorLink';

describe('detectPlatform', () => {
  it('识别四个支持平台的主域', () => {
    expect(detectPlatform('https://www.tiktok.com/@miaglowup')).toBe('tiktok');
    expect(detectPlatform('https://instagram.com/sofialane')).toBe('instagram');
    expect(detectPlatform('https://youtube.com/@leosato')).toBe('youtube');
    expect(detectPlatform('https://youtu.be/abcd1234')).toBe('youtube');
    expect(detectPlatform('https://weibo.com/u/123456')).toBe('weibo');
    expect(detectPlatform('https://m.weibo.cn/status/X')).toBe('weibo');
  });

  it('容忍无协议 / www / m 前缀 / 大小写', () => {
    expect(detectPlatform('tiktok.com/@x')).toBe('tiktok');
    expect(detectPlatform('WWW.TIKTOK.COM/x')).toBe('tiktok');
    expect(detectPlatform('http://m.instagram.com/p/1')).toBe('instagram');
  });

  it('不支持的平台返回 null（含小红书）', () => {
    expect(detectPlatform('https://www.xiaohongshu.com/user/abc')).toBeNull();
    expect(detectPlatform('https://xhslink.com/abc')).toBeNull();
    expect(detectPlatform('https://example.com')).toBeNull();
    expect(detectPlatform('')).toBeNull();
    expect(detectPlatform('not a url at all')).toBeNull();
  });
});

describe('parseCreatorLink', () => {
  it('拒绝不支持的平台', async () => {
    await expect(parseCreatorLink('https://www.xiaohongshu.com/u/a')).rejects.toThrow();
  });

  it('返回约定的字段且 platform 正确', async () => {
    const r = await parseCreatorLink('https://www.tiktok.com/@miaglowup');
    expect(r.platform).toBe('tiktok');
    expect(r.handle).toMatch(/^@/);
    expect(typeof r.name).toBe('string');
    expect(r.name!.length).toBeGreaterThan(0);
    expect(typeof r.followers).toBe('string');
    expect(typeof r.likes).toBe('string');
    expect(r.engagement).toMatch(/%$/);
    expect(r.intro).toContain(r.handle!);
    expect(r.sourceUrl).toBe('https://www.tiktok.com/@miaglowup');
    expect(r.avatar).toContain('dicebear.com');
  });

  it('同一 URL 两次解析结果一致（确定性）', async () => {
    const url = 'https://instagram.com/sofialane';
    const a = await parseCreatorLink(url);
    const b = await parseCreatorLink(url);
    expect(a).toEqual(b);
  });

  it('不同 URL（同平台）派生不同结果', async () => {
    const a = await parseCreatorLink('https://www.tiktok.com/@aaa');
    const b = await parseCreatorLink('https://www.tiktok.com/@bbb');
    expect(a).not.toEqual(b);
  });
});
