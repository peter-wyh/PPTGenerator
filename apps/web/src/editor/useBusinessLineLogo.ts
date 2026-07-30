import { useEffect, useState } from 'react';
import { lookupApi } from '@/api/lookup';
import { BUSINESS_LINE_META } from '@/projectsMeta';

/**
 * 从数据库拉取业务线 logo 映射表 { code → logo }。
 * 数据库 logo 优先于 BUSINESS_LINE_META 硬编码占位。
 * 拉取失败时回退到 BUSINESS_LINE_META。
 */
const _cache: { promise: Promise<Record<string, string>> | null; data: Record<string, string> } = {
  promise: null,
  data: {},
};

function fetchBlLogos(): Promise<Record<string, string>> {
  if (_cache.promise) return _cache.promise;
  _cache.promise = lookupApi
    .listBusinessLines()
    .then((list) => {
      const map: Record<string, string> = {};
      for (const bl of list) {
        if (bl.logo) map[bl.code] = bl.logo;
      }
      _cache.data = map;
      return map;
    })
    .catch(() => {
      _cache.promise = null; // allow retry
      return {};
    });
  return _cache.promise;
}

/** 获取业务线 logo URL（数据库优先 → 硬编码回退）。 */
export function useBusinessLineLogo(businessLineCode: string | undefined): string | undefined {
  const [logo, setLogo] = useState<string | undefined>(() => {
    // 同步初始值：缓存命中或回退到硬编码
    if (businessLineCode) {
      return _cache.data[businessLineCode] ?? BUSINESS_LINE_META[businessLineCode]?.logo;
    }
    return undefined;
  });

  useEffect(() => {
    if (!businessLineCode) {
      setLogo(undefined);
      return;
    }
    let alive = true;
    fetchBlLogos().then((map) => {
      if (!alive) return;
      const dbLogo = map[businessLineCode];
      const fallback = BUSINESS_LINE_META[businessLineCode]?.logo;
      setLogo(dbLogo ?? fallback);
    });
    return () => {
      alive = false;
    };
  }, [businessLineCode]);

  return logo;
}
