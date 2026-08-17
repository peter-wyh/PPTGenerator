import { ApiError } from './ApiError';
import type { AuthPayload } from '../types/express';

/**
 * 业务线一致性守卫：业务线账号(USER + businessLineCode)不得创建/改写成其他业务线的数据。
 * code 缺省（undefined/空串）时不拦——兼容不含业务线字段的旧载荷。
 */
export function assertBusinessLine(viewer: AuthPayload, code: unknown): void {
  if (viewer.role === 'ADMIN' || !viewer.businessLineCode) return;
  if (typeof code === 'string' && code && code !== viewer.businessLineCode) {
    throw ApiError.forbidden('不能创建或修改其他业务线的数据');
  }
}

/** 软校验（批量导入用）：不抛错，返回 false 计入 skipped。 */
export function assertBusinessLineSoft(viewer: AuthPayload, code: unknown): boolean {
  try {
    assertBusinessLine(viewer, code);
    return true;
  } catch {
    return false;
  }
}
