/**
 * 内容互动指标拆分比率 + CPS 转化比率（Mock seed 专用）。
 *
 * 以下比率为行业经验估算值，用于生成 demo/seed 数据。
 * 接入真实数据源后，这些常量不再被使用。
 */

/** 互动量（engagement）拆分为各互动类型的比率 */
export const ENGAGEMENT_RATIOS = {
  /** 点赞约占互动量的 56% */
  likes: 0.56,
  /** 评论约占互动量的 11% */
  comments: 0.11,
  /** 转发约占互动量的 18% */
  shares: 0.18,
  /** 收藏约占互动量的 15% */
  saves: 0.15,
} as const;

/** 视频播放量 ≈ 曝光量 × 82% */
export const PLAY_RATE = 0.82;

/** 订单转化比率（基于曝光量） */
export const ORDER_RATE = {
  /** 基准转化率 0.15% */
  base: 0.0015,
  /** 随 creator index 递增的偏移量 */
  perCreatorIndex: 3,
} as const;

/**
 * CPS 挂链转化漏斗（基于曝光量）。
 * 每个指标包含 base 比率和 jitter 步长。
 */
export const CPS_FUNNEL_RATES = {
  clicks:      { base: 0.08, jitterStep: 0.005, jitterMod: 5 },
  orders:      { base: 0.005, jitterStep: 0.001, jitterMod: 3 },
  shares:      { base: 0.003, jitterStep: 0.0008, jitterMod: 3 },
  saves:       { base: 0.02,  jitterStep: 0.003, jitterMod: 4 },
  ordersRaw:   { base: 0.0002, jitterStep: 0.00005, jitterMod: 5 },
} as const;

/** CPS 衍生指标默认值（无真实数据时估算用） */
export const CPS_DEFAULTS = {
  /** 默认 CTR 3–5% */
  ctrBase: 0.04,
  /** 佣金税率/服务费系数 8% */
  commissionTaxRate: 0.08,
  /** 链接点击率（基于曝光）：~3% */
  linkClickRate: 0.03,
  /** 汇总链接点击率（基于总曝光）：~3.8% */
  linkClickRateAggregate: 0.038,
} as const;
