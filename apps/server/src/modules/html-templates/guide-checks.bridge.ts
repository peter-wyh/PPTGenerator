/**
 * S2 Agent 四维架构:指南 checks ↔ 生成链路的桥接。
 *
 * 职责边界(对应 docs/asset-ownership-matrix.md §8.5 运行时解析链):
 *   - 断言内容 = 指南(active revision)配置,业务自助维护;
 *   - 断言执行器 = html-validator(平台代码);
 *   - 本模块只做:取 revision → 解析 checks → 调校验器 → 返回报告。
 *
 * 失败语义:指南/revision/checks 任一环失败都静默降级为"无断言"——
 * 校验是增强不是依赖,生成永不因 checks 而失败(与指南注入同语义)。
 */
import type { Guide } from '@prisma/client';
import { guideService } from '../guides/guide.service';
import { validateHtml, lintChecks } from '../guides/html-validator';
import type { GuideCheck, ValidateReport } from '../guides/html-validator';

/** 结构指南的 active revision checks;无指南/无 revision/checks 非法 → 空数组。 */
export async function extractGuideChecks(structural: Guide | null): Promise<GuidCheck[]> {
  if (!structural) return [];
  try {
    const rev = await guideService.ensureActiveRevision(structural);
    const raw = Array.isArray(rev.checks) ? (rev.checks as unknown[]) : [];
    const checks = raw.filter(
      (c): c is GuideCheck =>
        Boolean(c) && typeof c === 'object' && typeof (c as GuideCheck).assert === 'string',
    );
    // 语法非法的断言跳过(保存时 dry-run 已挡,这里是运行时兜底)
    const bad = new Set(lintChecks(checks).map((l) => l.assert));
    return checks.filter((c) => !bad.has(c.assert));
  } catch (e) {
    console.warn('[guide-checks] 装配失败,降级为无断言:', (e as Error)?.message ?? e);
    return [];
  }
}

/** 对生成 HTML 执行断言。checks 为空返回 null(调用方不附报告)。 */
export function runGuideChecks(html: string, checks: GuidCheck[]): ValidateReport | null {
  if (!checks?.length) return null;
  try {
    return validateHtml(html, checks);
  } catch (e) {
    console.warn('[guide-checks] 执行异常,跳过报告:', (e as Error)?.message ?? e);
    return null;
  }
}

type GuidCheck = GuideCheck;
