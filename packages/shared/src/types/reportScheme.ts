/**
 * 报告方案类型（ReportScheme）。
 * 报告方案 = 可扩展的报告类型目录（如 DM 双周报、DM 月报等）。
 * 由 ADMIN 维护，用于驱动报告创建入口与默认配置。
 */

export interface ReportScheme {
  id: string;
  /** 方案编码（如 dm-biweekly, dm-monthly），全局唯一。 */
  code: string;
  /** 方案名称。 */
  name: string;
  /** 方案描述。 */
  description: string | null;
  /** 所属业务线 code（如 DM），可空表示通用方案。 */
  businessLineCode: string | null;
  /** 页数。 */
  pageCount: number;
  /** 是否启用。 */
  enabled: boolean;
  /** 排序权重（升序）。 */
  sortOrder: number;
  /** 默认风格预设 ID（对应 STYLE_PRESETS[].key）。 */
  defaultStyle: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

/** 新建方案入参。 */
export interface CreateReportSchemeInput {
  code: string;
  name: string;
  description?: string;
  businessLineCode?: string;
  pageCount?: number;
  enabled?: boolean;
  sortOrder?: number;
  defaultStyle?: string;
}

/** 更新方案入参（全部可选）。 */
export interface UpdateReportSchemeInput {
  code?: string;
  name?: string;
  description?: string | null;
  businessLineCode?: string | null;
  pageCount?: number;
  enabled?: boolean;
  sortOrder?: number;
  defaultStyle?: string | null;
}
