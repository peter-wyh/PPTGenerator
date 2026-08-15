import { useEffect, useState } from 'react';
import { lookupApi, type BusinessLineDTO } from '@/api/lookup';

/**
 * 业务线查找表缓存（数据库唯一数据源）。
 * 模块级 Promise 缓存:同 session 多组件共享一次请求;失败清缓存允许重试。
 * 从 projectsMeta 硬编码 mock 迁移而来(2026-08),mock 已删除。
 */

const _cache: {
  promise: Promise<BusinessLineDTO[]> | null;
  data: BusinessLineDTO[];
} = { promise: null, data: [] };

function fetchBusinessLines(): Promise<BusinessLineDTO[]> {
  if (_cache.promise) return _cache.promise;
  _cache.promise = lookupApi
    .listBusinessLines()
    .then((list) => {
      _cache.data = list;
      return list;
    })
    .catch(() => {
      _cache.promise = null; // allow retry
      return [];
    });
  return _cache.promise;
}

/** 拉取全部业务线(含 logo/颜色/名称)。数据库为唯一来源;加载中/失败返回已缓存(可能为空)。 */
export function useBusinessLines(): { businessLines: BusinessLineDTO[]; loading: boolean } {
  const [list, setList] = useState<BusinessLineDTO[]>(_cache.data);
  const [loading, setLoading] = useState(!_cache.promise);

  useEffect(() => {
    let alive = true;
    fetchBusinessLines().then((bls) => {
      if (!alive) return;
      setList(bls);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { businessLines: list, loading };
}

/** 业务线 code 列表(替代原 BUSINESS_LINES 常量;加载中/失败为空数组)。 */
export function useBusinessLineCodes(): string[] {
  const { businessLines } = useBusinessLines();
  return businessLines.map((b) => b.code);
}

/**
 * 单条业务线信息(替代原 BUSINESS_LINE_META[code])。
 * 返回完整 BusinessLineDTO(含 logo/color/designMd/id 等);未加载/无此 code 时为 undefined。
 */
export function useBusinessLineInfo(code: string | undefined): BusinessLineDTO | undefined {
  const { businessLines } = useBusinessLines();
  if (!code) return undefined;
  return businessLines.find((b) => b.code === code);
}

/** 获取业务线 logo URL(数据库唯一来源)。 */
export function useBusinessLineLogo(businessLineCode: string | undefined): string | undefined {
  return useBusinessLineInfo(businessLineCode)?.logo;
}
