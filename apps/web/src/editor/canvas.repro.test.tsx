import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from '@/editor/Canvas';
import { useEditorStore } from '@/editor/store';
import { REGISTRY } from '@/editor/registry';

/**
 * 复现「画布」渲染出错 —— 对 REGISTRY 全部组件类型逐一渲染,
 * 用各类型 defaultData。任何类型炸掉 = 找到真实回归点。
 */
describe('Canvas 回归复现(全组件类型)', () => {
  const types = Object.keys(REGISTRY);
  it('逐类型渲染不抛错', () => {
    const failures: string[] = [];
    for (const t of types) {
      const comp = {
        id: `c-${t}`,
        type: t,
        x: 10, y: 10,
        w: 300, h: 200,
        locked: false,
        data: (REGISTRY as any)[t].defaultData(),
      };
      useEditorStore.getState().loadProject(
        { id: `p-${t}`, name: 'T', width: 1280, height: 720, pages: [{ id: 'pg1', name: '1', components: [comp] }] } as any,
        'T',
      );
      try {
        const { unmount } = render(<Canvas />);
        unmount();
      } catch (e) {
        failures.push(`${t}: ${(e as Error).message}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
