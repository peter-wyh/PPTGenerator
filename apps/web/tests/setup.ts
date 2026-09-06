import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * 注意：不要在这里 import 业务 store / api —— 会导致真实模块在 vi.mock 生效前被缓存，
 * 使测试文件里的 vi.mock 失效。需要重置 store 的测试在自身 beforeEach 中处理。
 */
afterEach(() => {
  cleanup();
});

/**
 * jsdom 不实现 URL.createObjectURL / revokeObjectURL( Blob 下载、图片裁剪等用到)。
 * 提供空 stub,让 vi.spyOn 可挂载;具体测试如需断言可自行 mockReturnValue。
 */
if (!('createObjectURL' in URL)) {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: () => 'blob:stub',
  });
}
if (!('revokeObjectURL' in URL)) {
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: () => {},
  });
}

/**
 * jsdom 不实现 ResizeObserver（recharts ResponsiveContainer / 组件自适应测量用）。
 * 0905 审计 P1-8：全局轻量 polyfill——observe 触发一次 0 尺寸回调让图表完成首渲染，
 * 不再抛 ReferenceError 炸红 canvas.repro 等组件树测试。业务代码里已有的
 * `typeof ResizeObserver === 'undefined'` 守卫分支不受影响。
 */
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub implements ResizeObserver {
    observe(target: Element) {
      // 首帧回调一次（0 尺寸），驱动 recharts 完成 mount 生命周期
      requestAnimationFrame(() =>
        this.callback(
          [{
            target,
            contentRect: { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0 },
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
            isIntersecting: false,
          } as unknown as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        ),
      );
    }
    unobserve() {}
    disconnect() {}
    private callback: ResizeObserverCallback = () => {};
    constructor(cb?: ResizeObserverCallback) {
      if (cb) this.callback = cb;
    }
  }
  (globalThis as Record<string, unknown>).ResizeObserver = ResizeObserverStub;
}
