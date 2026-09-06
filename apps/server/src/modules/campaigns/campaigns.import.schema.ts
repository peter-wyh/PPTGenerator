import { z } from 'zod';

// ─── 批量导入（0905 审计 P1-5：6 个 import 端点原本零校验）──────────────────
// items 上限 5000 行：防误传超大 payload 打爆 express.json(5mb) 前先在 schema 层拦。
const MAX_IMPORT_ROWS = 5000;

/** 单行导入记录：宽松 Record（不同导入类型字段各异），但行数/外层结构受控。 */
function importEnvelope() {
  return z.object({
    items: z.array(z.record(z.unknown())).min(1, 'items 不能为空').max(MAX_IMPORT_ROWS, `单次导入最多 ${MAX_IMPORT_ROWS} 行`),
  });
}

export const importCreatorsSchema = importEnvelope();
export const importCreatorAudienceSchema = importEnvelope();
export const importCreatorWorksSchema = importEnvelope();
export const importCollaborationDailySchema = importEnvelope();
export const importLinkPerformanceSchema = importEnvelope();
export const importOrdersSchema = importEnvelope();

// ─── PUT 端点（原本无校验）───────────────────────────────────────────────────
/** PUT /:campaignId/analytics — body 为分析数据 JSON（结构随业务演化，宽松但限型）。 */
export const updateAnalyticsBodySchema = z.record(z.unknown()).refine(
  (o) => Object.keys(o).length > 0,
  { message: 'body 不能为空' },
);

/** PUT /:campaignId/creators/:creatorId/performance — 行数据字段由 performanceService 逐字段清洗。 */
export const upsertPerformanceBodySchema = z.record(z.unknown()).refine(
  (o) => Object.keys(o).length > 0,
  { message: 'body 不能为空' },
);

/** PUT /:campaignId/creators/:creatorId/collaboration — 行数据字段由 collaborationService 逐字段清洗。 */
export const upsertCollaborationBodySchema = z.record(z.unknown()).refine(
  (o) => Object.keys(o).length > 0,
  { message: 'body 不能为空' },
);
