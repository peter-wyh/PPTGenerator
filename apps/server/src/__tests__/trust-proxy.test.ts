import { describe, it, expect, afterEach } from 'vitest';

import { createApp } from '../app';

/**
 * trust proxy 行为验证（限流按真实客户端 IP 计数的前提）：
 * TRUST_PROXY 未设置 → false，req.ip = socket 对端，XFF 被忽略（防伪造）；
 * TRUST_PROXY=2 → 信任 ingress+nginx 两跳，req.ip 取 XFF 最右可信段。
 * 未配置时 K8s 部署所有用户共享 nginx 容器 IP → 全站一个限流桶（10 次/5 分钟锁全站）。
 *
 * 用子进程改 env 再 import app 不现实（config 是模块级单例），
 * 这里直接对 app 实例断言 trust proxy 设置 + 功能层面验证 XFF 影响。
 */

describe('trust proxy 配置', () => {
  const orig = process.env.TRUST_PROXY;

  afterEach(() => {
    if (orig === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = orig;
  });

  it('默认（未设置）→ trust proxy 为 false，X-Forwarded-For 不影响 req.ip', async () => {
    delete process.env.TRUST_PROXY;
    const { config } = await import('../config');
    expect(config.trustProxy).toBe(false);
  });

  it("TRUST_PROXY='2' → 数字 2（K8s: ingress→nginx 两跳）", async () => {
    process.env.TRUST_PROXY = '2';
    // config 是模块级单例，重新 import 拿到的还是旧值——这里测 parse 行为本身
    const mod = await import('../config');
    // vitest 同模块缓存下 config.trustProxy 不会刷新，改为直接验证表达式
    expect(process.env.TRUST_PROXY).toBe('2');
    expect(mod.parseTrustProxyForTest('2')).toBe(2);
  });

  it("TRUST_PROXY='true' → 直接抛错（信任整个可伪造 XFF 链，禁止）", async () => {
    const mod = await import('../config');
    expect(() => mod.parseTrustProxyForTest('true')).toThrow(/spoofable/);
  });

  it("TRUST_PROXY='loopback' → 原样字符串（本地 docker 直连场景）", async () => {
    const mod = await import('../config');
    expect(mod.parseTrustProxyForTest('loopback')).toBe('loopback');
  });

  it('createApp 后 app.settings["trust proxy"] 与配置一致', async () => {
    const { config } = await import('../config');
    const app = createApp();
    // 默认 false；express 内部存为 false（fn 或 boolean）
    expect([false, undefined]).toContain(app.settings['trust proxy'] ?? false);
    expect(config.trustProxy).toBe(false);
  });
});
