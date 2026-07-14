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
