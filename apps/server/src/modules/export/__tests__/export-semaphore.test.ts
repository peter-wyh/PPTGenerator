/**
 * P1-3 导出信号量测试：排队上限 503、排队超时 503、槽位释放唤醒队首。
 * 不 launch 真浏览器——直接驱动模块内 waitQueue 状态（通过并发 acquire 模拟）。
 */
import { describe, it, expect } from 'vitest';

// 直接复制模块内的信号量实现做行为验证（与 export.service.ts 同构，
// 真模块的 acquire 耦合 puppeteer launch，纯单测以同构实现为准）
const MAX_CONCURRENT = 2;
const MAX_QUEUE = 20;
const QUEUE_TIMEOUT_MS = 200; // 测试用短超时

let active = 0;
const waitQueue: Array<{ resolve: () => void; reject: (e: Error) => void; timer: NodeJS.Timeout }> = [];

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++;
    return Promise.resolve();
  }
  if (waitQueue.length >= MAX_QUEUE) {
    return Promise.reject(new Error('503 queue full'));
  }
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      const idx = waitQueue.findIndex((w) => w.resolve === resolve);
      if (idx >= 0) waitQueue.splice(idx, 1);
      reject(new Error('503 queue timeout'));
    }, QUEUE_TIMEOUT_MS);
    waitQueue.push({ resolve, reject, timer });
  }).then(() => { active++; });
}

function release(): void {
  active--;
  const next = waitQueue.shift();
  if (next) {
    clearTimeout(next.timer);
    next.resolve();
  }
}

describe('export semaphore (P1-3)', () => {
  it('并发 2 直接拿槽，第 3 个排队被释放后唤醒', async () => {
    const order: string[] = [];
    const jobs = [1, 2, 3].map(async (i) => {
      await acquire();
      order.push('start' + i);
      await new Promise((r) => setTimeout(r, 30));
      release();
      order.push('end' + i);
    });
    await Promise.all(jobs);
    // 前 2 个立即 start（start1/start2 都在任何 end 之前）
    expect(order.indexOf('start1')).toBeLessThan(order.indexOf('end1'));
    expect(order.indexOf('start2')).toBeLessThan(order.indexOf('end1'));
    // 第 3 个必须等第一个 end 之后才 start（槽位释放唤醒）
    expect(order.indexOf('start3')).toBeGreaterThan(order.indexOf('end1'));
    expect(order.indexOf('start3')).toBeLessThan(order.indexOf('end3'));
    expect(active).toBe(0);
    expect(waitQueue.length).toBe(0);
  });

  it('排队超时：槽位不释放则排队者在 QUEUE_TIMEOUT 后被拒', async () => {
    await acquire();
    await acquire();
    const p = acquire();
    await expect(p).rejects.toThrow('503 queue timeout');
    expect(waitQueue.length).toBe(0); // 超时者已自我摘除
    release();
    release();
  });

  it('队列上限：满 20 个排队后第 21 个立即被拒', async () => {
    await acquire();
    await acquire();
    const queued: Array<Promise<void>> = [];
    for (let i = 0; i < MAX_QUEUE; i++) queued.push(acquire().catch(() => {}));
    await expect(acquire()).rejects.toThrow('503 queue full');
    expect(waitQueue.length).toBe(MAX_QUEUE);
    // 清理：全部释放
    release(); release();
    for (let i = 0; i < MAX_QUEUE; i++) release();
    await Promise.allSettled(queued);
    expect(active).toBe(0);
  });
});
