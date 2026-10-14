import { describe, it, expect } from 'vitest';
import { checkEditIntegrity } from './ai-generate.service';

const chart = (i: number) => `<canvas id="c${i}"></canvas><script>new Chart(document.getElementById('c${i}'), {});</script>`;
const full = (n: number, pad = 0) => `<!DOCTYPE html><html><body>${Array.from({ length: n }, (_, i) => chart(i)).join('')}${'x'.repeat(pad)}</body></html>`;

describe('checkEditIntegrity (1013 编辑完整性守卫)', () => {
  it('无基线（currentHtml 空）→ 放行', () => {
    expect(checkEditIntegrity('', full(3), '改个颜色')).toBeNull();
  });

  it('图表数不变 → 放行', () => {
    expect(checkEditIntegrity(full(3), full(3), '把标题改成红色')).toBeNull();
  });

  it('Chart 实例减少（3→1）→ 拦截', () => {
    const msg = checkEditIntegrity(full(3), full(1), '把标题改成红色');
    expect(msg).toMatch(/丢失图表（原 3 个 Chart 实例，产出仅 1 个）/);
  });

  it('canvas 减少但 Chart 实例数相同 → 拦截', () => {
    const cur = full(3);
    const nw = full(3).replace('<canvas id="c2"></canvas>', '<div id="c2"></div>');
    const msg = checkEditIntegrity(cur, nw, '微调间距');
    expect(msg).toMatch(/丢失图表容器（原 3 个 canvas，产出仅 2 个）/);
  });

  it('大文档长度骤降 >40% → 拦截', () => {
    const cur = full(2, 60_000); // ~60k+
    const nw = full(2);          // 大幅缩水
    const msg = checkEditIntegrity(cur, nw, '改个文案');
    expect(msg).toMatch(/长度骤降/);
  });

  it('指令含删除语义 → 放行（用户主动删模块）', () => {
    expect(checkEditIntegrity(full(3), full(1), '删掉两个图表模块')).toBeNull();
    expect(checkEditIntegrity(full(3), full(1), 'remove the second chart')).toBeNull();
  });

  it('正常小改动（长度小幅波动）→ 放行', () => {
    const cur = full(2, 10_000);
    const nw = full(2, 9_000);
    expect(checkEditIntegrity(cur, nw, '调整字号')).toBeNull();
  });

  it('小文档长度骤降 → 放行（阈值 50k 只防大报告截断）', () => {
    const cur = full(2, 1_000);
    const nw = full(2);
    expect(checkEditIntegrity(cur, nw, '精简内容')).toBeNull();
  });
});
