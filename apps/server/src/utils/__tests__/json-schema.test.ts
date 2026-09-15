import { describe, it, expect } from 'vitest';
import { jsonSchema, jsonObjectSchema, jsonTokenOverridesSchema } from '../json-schema';

describe('jsonSchema（0827 审计 #33：受限 JSON 校验器）', () => {
  it('普通对象/数组/标量原样通过（passthrough 语义）', () => {
    const v = { a: 1, b: 'x', c: [1, 2, { d: true }], e: null };
    expect(jsonSchema.parse(v)).toEqual(v);
    expect(jsonSchema.parse('plain')).toBe('plain');
    expect(jsonSchema.parse(42)).toBe(42);
  });

  it('HTML 片段长字符串（<20k）可通过', () => {
    expect(jsonSchema.parse('<div>'.padEnd(500, 'x') + '</div>')).toMatch(/^<div>/);
  });

  it('字符串炸弹（>20k）被拒', () => {
    expect(jsonSchema.safeParse('x'.repeat(20_001)).success).toBe(false);
  });

  it('深度 >12 被拒', () => {
    let deep: unknown = { v: 1 };
    for (let i = 0; i < 13; i++) deep = { nested: deep };
    expect(jsonSchema.safeParse(deep).success).toBe(false);
    // 恰好 12 层通过
    let ok: unknown = { v: 1 };
    for (let i = 0; i < 11; i++) ok = { nested: ok };
    expect(jsonSchema.safeParse(ok).success).toBe(true);
  });

  it('节点数 >2000 被拒', () => {
    const wide = Array.from({ length: 2001 }, (_, i) => ({ i }));
    expect(jsonSchema.safeParse(wide).success).toBe(false);
    const fine = Array.from({ length: 500 }, (_, i) => ({ i }));
    expect(jsonSchema.safeParse(fine).success).toBe(true);
  });

  it('原型污染键（__proto__/constructor/prototype）被拒', () => {
    const evil = JSON.parse('{"__proto__": {"polluted": true}}');
    expect(jsonSchema.safeParse(evil).success).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('非 JSON 值（function 等）被拒', () => {
    expect(jsonSchema.safeParse({ fn: () => 1 }).success).toBe(false);
  });
});

describe('jsonObjectSchema', () => {
  it('只要对象：数组/标量被拒', () => {
    expect(jsonObjectSchema.safeParse({ a: 1 }).success).toBe(true);
    expect(jsonObjectSchema.safeParse([1]).success).toBe(false);
    expect(jsonObjectSchema.safeParse('s').success).toBe(false);
  });
});

describe('jsonTokenOverridesSchema', () => {
  it('string→string 记录通过', () => {
    expect(jsonTokenOverridesSchema.parse({ brandName: 'Digchic', period: 'Q4' })).toEqual({
      brandName: 'Digchic',
      period: 'Q4',
    });
  });
  it('嵌套对象/非字符串值被拒（浅层覆盖表语义）', () => {
    expect(jsonTokenOverridesSchema.safeParse({ a: { b: 1 } }).success).toBe(false);
    expect(jsonTokenOverridesSchema.safeParse({ a: 1 }).success).toBe(false);
  });
});
