import { describe, it, expect } from 'vitest';
import { getTemplate } from '@/editor/templates';

describe('cover-page 模板', () => {
  it('声明 pageTitleIndex=0（首个组件为标题）', () => {
    expect(getTemplate('cover-page')?.pageTitleIndex).toBe(0);
  });
});
