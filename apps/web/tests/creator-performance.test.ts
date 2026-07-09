import { describe, it, expect } from 'vitest';
import { listCreatorPerformance } from '@/api/creatorPerformance';

const num = (s: string): number => Number(s.replace(/[^\d.]/g, ''));
/** 解析 compact 格式（"2.4M" / "3.1K" / "567"）为数值。 */
const parseCompact = (s: string): number => {
  const m = s.match(/([\d.]+)\s*([MK]?)/i);
  if (!m) return 0;
  const v = parseFloat(m[1]);
  return /M/i.test(m[2]) ? v * 1e6 : /K/i.test(m[2]) ? v * 1e3 : v;
};

describe('作品数据（多作品 + 基础信息）', () => {
  it('作品数按 tier：头部 4 > 腰部 3 > KOC 2', async () => {
    const list = await listCreatorPerformance('camp-glowlab-q4');
    // glowlab 参与：cre-mia(头部) / cre-sofia(腰部) / cre-tom(KOC)
    const byId = Object.fromEntries(list.map((p) => [p.creatorId, p]));
    expect(byId['cre-mia'].posts.length).toBe(4);
    expect(byId['cre-sofia'].posts.length).toBe(3);
    expect(byId['cre-tom'].posts.length).toBe(2);
  });

  it('每个作品含 platform / cover / url / hashtags（基础信息）', async () => {
    const list = await listCreatorPerformance('camp-glowlab-q4');
    const mia = list.find((p) => p.creatorId === 'cre-mia')!;
    expect(mia.posts.length).toBeGreaterThan(0);
    for (const post of mia.posts) {
      expect(post.platform).toBe('TikTok');
      expect(post.cover).toMatch(/^https:\/\//);
      expect(post.url).toMatch(/^https:\/\//);
      expect(post.hashtags).toBeTruthy();
    }
  });

  it('视频平台作品带 duration/plays，图文平台不带', async () => {
    const video = (await listCreatorPerformance('camp-glowlab-q4'))[0].posts[0]; // TikTok=video
    expect(video.format).toBe('video');
    expect(video.duration).toMatch(/^\d+:\d{2}$/);
    expect(video.plays).toBeTruthy();

    const image = (await listCreatorPerformance('camp-nova-home-618'))[0].posts[0]; // 小红书=image
    expect(image.format).toBe('image');
    expect(image.duration).toBeUndefined();
  });
});

describe('每日数据（daily）', () => {
  it('28 天序列，日期连续递增', async () => {
    const daily = (await listCreatorPerformance('camp-glowlab-q4'))[0].daily;
    expect(daily).toHaveLength(28);
    for (let i = 1; i < daily.length; i++) {
      expect(daily[i].date > daily[i - 1].date).toBe(true);
    }
  });

  it('每条字段格式合法、曝光>0', async () => {
    const daily = (await listCreatorPerformance('camp-glowlab-q4'))[0].daily;
    for (const d of daily) {
      expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(num(d.impressions)).toBeGreaterThan(0);
    }
  });

  it('daily 曝光之和 ≈ summary.totalImpressions（自洽，误差<5%）', async () => {
    const p = (await listCreatorPerformance('camp-glowlab-q4'))[0];
    const sumImpr = p.daily.reduce((s, d) => s + num(d.impressions), 0);
    const totalImpr = parseCompact(p.summary.totalImpressions);
    expect(totalImpr).toBeGreaterThan(0);
    expect(Math.abs(sumImpr - totalImpr) / totalImpr).toBeLessThan(0.05);
  });
});
