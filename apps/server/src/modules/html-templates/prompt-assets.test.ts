/**
 * S3 字节级等价验证:外置 prompt-assets 拼装后的 SYSTEM_PROMPT 必须与重构前硬编码版本完全一致。
 * 原版快照存 tests/fixtures/system-prompt.before-refactor.txt(git 历史 46 个原始段落,提取 6 段前)。
 * 若本测试失败:提示词内容被意外改动——禁止静默漂移,改动必须显式更新快照并在 PR 说明。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SYSTEM_PROMPT } from './ai-generate.service';

describe('S3 prompt 外置拼装 · 字节级等价', () => {
  // vitest ESM 下 __dirname 不可靠,以 apps/server 为根
  const serverRoot = process.cwd().endsWith('apps/server') ? process.cwd() : join(process.cwd(), 'apps/server');
  const snapshotPath = join(serverRoot, 'tests/fixtures/system-prompt.before-refactor.txt');

  it('拼装产物 == 重构前硬编码 SYSTEM_PROMPT(逐字节)', () => {
    const before = readFileSync(snapshotPath, 'utf-8');
    expect(SYSTEM_PROMPT).toBe(before.replace(/\n$/, ''));
  });

  it('无残留占位符', () => {
    expect(SYSTEM_PROMPT).not.toContain('{{ASSET:');
  });

  it('6 段外置资产各自非空且含段标题', () => {
    for (const name of ['tech-stack', 'tailwind-config', 'css-classes', 'responsive', 'chartjs-rules', 'table-alignment']) {
      const body = readFileSync(join(serverRoot, `src/modules/html-templates/prompt-assets/${name}.md`), 'utf-8');
      expect(body.length).toBeGreaterThan(50);
      expect(body).toContain('═══');
    }
  });
});
