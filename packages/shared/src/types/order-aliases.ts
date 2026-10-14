/**
 * ★ 1013 订单导入表头别名归一（双端共用真源）
 *
 * 背景：平台原始 CSV（Awin 英文 snake_case / LinkSynergy 中文表头）此前只在
 * 服务端导入时归一（campaigns.service.normalizeOrderRow），前端预览校验
 * checkRequired 直接对原始表头判「缺字段」→ 预览满屏红「缺字段: campaignId,
 * orderId, productName」（DG 报告 1013 实锤）。真源抽到 shared：
 *   - 前端 buildPreviewFromRows('orders') 归一后再校验 → 预览与导入一致；
 *   - 服务端 normalizeOrderRow 改引此处 → 单一字典，新平台加别名一处生效。
 */

/** 平台原始表头 → 规范 camelCase 字段。通用 camelCase 直传不在此字典。 */
export const ORDER_HEADER_ALIASES: Record<string, string> = {
  // ── Awin transactions 导出 ──
  id: 'externalTxnId',
  sale_amount: 'saleAmount',
  validation_date: 'validationDate',
  click_ref: 'clickRef',
  site_name: 'siteName',
  click_device: 'clickDevice',
  customer_country: 'customerCountry',
  customer_acquisition: 'customerAcquisition',
  publisher_url: 'publisherUrl',
  // 核心三列（镜像字典外）的 Awin 原始名
  order_reference: 'orderId',
  date: 'orderDate',
  commission_status: 'orderStatus',
  // 商品行常用原始名
  product_name: 'productName',
  unit_price: 'unitPrice',
  line_total: 'lineTotal',
  // ── LinkSynergy 导出（中文表头，2026-09-16 接入）──
  // 佣金口径（用户定稿 0916）：commission = 「广告主佣金」（我方流量主身份的毛收入），
  //   「流量主佣金」是经我方平台分佣后流量主的净收益，不进订单表。
  '数据ID': 'externalTxnId',
  '订单编号': 'orderId',
  '下单时间': 'orderDate',
  '系统订单状态': 'orderStatus',
  '商品ID/SKU': 'sku',
  '商品名称': 'productName',
  '商品类目名称': 'category',
  '商品数量': 'qty',
  '商品单价（元）': 'unitPrice',
  '商品总价（元）': 'lineTotal',
  '订单金额（元）': 'saleAmount',
  '广告主佣金（元）': 'commission',
  '数据来源': 'source',
  '是否新客': 'customerAcquisition',
  '流量主名称': 'publisherName',
  '媒体/推广位': 'mediaName',
};

/** 订单导入行别名归一：原始表头 → camelCase（已有规范 key 不覆盖，别名键删除）。 */
export function normalizeOrderRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  for (const [alias, canonical] of Object.entries(ORDER_HEADER_ALIASES)) {
    if (alias in out) {
      const v = out[alias];
      if (!(canonical in out) || out[canonical] === undefined || out[canonical] === '') {
        out[canonical] = v;
      }
      if (canonical !== alias) delete out[alias];
    }
  }
  return out;
}
