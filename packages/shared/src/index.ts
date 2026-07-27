/**
 * MediaKit 共享类型 + 运行时（前后端共享）。
 * 对齐 docs/superpowers/specs/2026-06-30-mediakit-fresh-rewrite-design.md §3.3。
 *
 * 本文件为纯 barrel：按领域拆分到 ./types/* 与 ./theme/*，
 * 此处统一 re-export，保证下游 `from '@mediakit/shared'` 不变。
 */

// ---- 类型定义 ----
export * from './types/auth';
export * from './types/project';
export * from './types/template';
export * from './types/campaign';
export * from './types/theme';
export * from './types/editor';
export * from './types/collaboration';
export * from './types/page';
export * from './types/reportScheme';

// ---- 运行时常量 / 工具函数 ----
export * from './theme/presets';
export * from './theme/utils';
