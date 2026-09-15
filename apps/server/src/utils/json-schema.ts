import { z } from 'zod';

/**
 * 0827 审计二轮 #33：Prisma Json 字段曾经的 z.any() 逃逸 → 受限 JSON 校验器。
 *
 * 为什么不用 z.lazy 递归 schema：恶意/意外的深嵌套 JSON 会同步递归解析打爆栈，
 * 且无法限制总节点数。这里显式栈遍历，硬上限：
 *   - 深度 ≤ 12
 *   - 总节点 ≤ 2000
 *   - 单字符串 ≤ 20000 字符（HTML 片段等仍可通过，纯文本炸弹挡掉）
 * 通过校验的值原样返回（passthrough 语义：不裁剪未知字段——DB Json 列本就自由形状，
 * 这里只做「形状守门」防巨 payload / 栈炸弹，不做业务字段白名单）。
 */

const MAX_DEPTH = 12;
const MAX_NODES = 2000;
const MAX_STR = 20_000;

class JsonShapeError extends Error {}

function walk(value: unknown, depth: number, budget: { n: number }): unknown {
  if (budget.n-- <= 0) throw new JsonShapeError(`JSON 节点数超上限 ${MAX_NODES}`);
  if (depth > MAX_DEPTH) throw new JsonShapeError(`JSON 嵌套深度超上限 ${MAX_DEPTH}`);
  if (typeof value === 'string') {
    if (value.length > MAX_STR) throw new JsonShapeError(`JSON 字符串超上限 ${MAX_STR}`);
    return value;
  }
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.map((v) => walk(v, depth + 1, budget));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
        throw new JsonShapeError('JSON 含原型污染键');
      }
      if (k.length > 200) throw new JsonShapeError('JSON 键名超上限 200');
      out[k] = walk(v, depth + 1, budget);
    }
    return out;
  }
  // function / symbol / bigint / undefined 等非法 JSON 值
  throw new JsonShapeError(`非法 JSON 值类型: ${typeof value}`);
}

/** 受限 JSON 值（对象/数组/标量皆可），带形状守门。 */
export const jsonSchema = z.unknown().superRefine((v, ctx) => {
  try {
    walk(v, 0, { n: MAX_NODES });
  } catch (e) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: e instanceof Error ? e.message : 'JSON 校验失败',
    });
  }
});

/** 受限 JSON 对象（必须可枚举键的对象）。 */
export const jsonObjectSchema = jsonSchema.superRefine((v, ctx) => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '必须是 JSON 对象' });
  }
});

/** 受限 token 覆盖表（recipe 用：浅层 string→string 记录）。 */
export const jsonTokenOverridesSchema = z.record(z.string().max(200), z.string().max(MAX_STR));
