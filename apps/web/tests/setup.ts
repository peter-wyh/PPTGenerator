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
