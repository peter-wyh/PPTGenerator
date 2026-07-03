import { describe, it, expect } from 'vitest';
import { detectPlatform } from '@/editor/creatorLink';

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
