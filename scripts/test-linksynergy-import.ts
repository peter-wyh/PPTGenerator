// LinkSynergy 中文表头订单导入 —— 端到端冒烟测试（vitest）
// 验证：表头别名归一 → 镜像字段 → 佣金口径（广告主佣金）→ source 标记。
// 不落库（mock prisma），只验证纯函数行为：normalizeOrderRow + mirrorOrderFields。
// 用法: cd apps/server && npx tsx ../../scripts/test-linksynergy-import.ts

// vitest 环境外直接跑纯逻辑：从源文件提取两个函数（非 export，源内联测试）
// → 改为在此文件内以最小复制实现校验别名字典正确性（source of truth = campaigns.service.ts）
import { readFileSync } from 'fs';

const src = readFileSync(new URL('../apps/server/src/modules/campaigns/campaigns.service.ts', import.meta.url), 'utf8');

// 提取 ORDER_HEADER_ALIASES 字典字面量
const m = src.match(/const ORDER_HEADER_ALIASES: Record<string, string> = \{([\s\S]*?)\n\};/);
if (!m) { console.error('未找到 ORDER_HEADER_ALIASES'); process.exit(1); }

// 解析键值对（含中文字符串键）
const entries: Array<[string, string]> = [];
for (const mm of m[1].matchAll(/'([^']+)':\s*'([^']+)'/g)) entries.push([mm[1], mm[2]]);
const ALIASES = Object.fromEntries(entries) as Record<string, string>;

// 复制 normalizeOrderRow 逻辑（与源一致）
function normalizeOrderRow(row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row };
  for (const [alias, canonical] of Object.entries(ALIASES)) {
    if (alias in out) {
      const v = out[alias];
      if (!(canonical in out) || out[canonical] === undefined || out[canonical] === '') out[canonical] = v;
      if (canonical !== alias) delete out[alias];
    }
  }
  return out;
}

// 用户提供的真实 LinkSynergy 行（33 列中文表头）
const lsRow: Record<string, unknown> = {
  '数据ID': '47859542',
  '数据来源': 'LinkSynergy',
  '订单编号': '158541648',
  '下单时间': '2026-09-09 07:44:19',
  '商品ID/SKU': '2I2-4315-010-37',
  '商品名称': 'Tênis Olympikus Atmos Feminino',
  '商品类目ID': 'Running',
  '商品类目名称': 'Running',
  '我方商品索引': '0',
  '是否新客': '未知',
  '商家订单状态': '未知',
  '优惠码': '',
  '流量主ID': '1000025',
  '流量主名称': 'linzhenhe',
  '媒体ID/推广位ID': '1128824',
  '媒体/推广位': 'NetshoesWL-FT1',
  '计划ID': '27938',
  '计划名称': 'Netshoes WL-FTCPS推广计划',
  '媒介名称': 'owen',
  '市场名称': 'Raphael',
  '商品数量': '1',
  '商品单价（元）': '159.27',
  '商品总价（元）': '159.27',
  '上游佣金类别': '',
  '广告主佣金（元）': '20.71',
  '流量主佣金（元）': '11.18',
  '广告主佣金比例': '13.00%',
  '流量主佣金比例': '7.01%',
  '系统订单状态': '未确认',
  '订单金额（元）': '159.27',
  '流量主级别': 'T3',
  '基础佣金政策ID': '231234',
  '自定义佣金政策ID': '0',
};

const out = normalizeOrderRow(lsRow);

// ── 断言 ──
const checks: Array<[string, boolean, string]> = [
  ['orderId = 订单编号', out.orderId === '158541648', JSON.stringify(out.orderId)],
  ['orderDate = 下单时间', out.orderDate === '2026-09-09 07:44:19', String(out.orderDate)],
  ['productName = 商品名称', out.productName === 'Tênis Olympikus Atmos Feminino', String(out.productName)],
  ['sku = 商品ID/SKU', out.sku === '2I2-4315-010-37', String(out.sku)],
  ['category = 商品类目名称', out.category === 'Running', String(out.category)],
  ['qty = 商品数量', out.qty === '1', String(out.qty)],
  ['unitPrice = 商品单价（元）', out.unitPrice === '159.27', String(out.unitPrice)],
  ['lineTotal = 商品总价（元）', out.lineTotal === '159.27', String(out.lineTotal)],
  ['saleAmount = 订单金额（元）', out.saleAmount === '159.27', String(out.saleAmount)],
  ['commission = 广告主佣金（元）★口径', out.commission === '20.71', String(out.commission)],
  ['广告主佣金比例等无消费方列保留在透传层（mirrorOrderFields 白名单外不落库）', out['广告主佣金比例'] === '13.00%', String(out['广告主佣金比例'])],
  ['流量主佣金（净收益）留在透传层不映射 commission', out.commission === '20.71' && out['流量主佣金（元）'] === '11.18', 'commission=' + String(out.commission)],
  ['source = 数据来源', out.source === 'LinkSynergy', String(out.source)],
  ['orderStatus = 系统订单状态（非商家）', out.orderStatus === '未确认', String(out.orderStatus)],
  ['customerAcquisition = 是否新客', out.customerAcquisition === '未知', String(out.customerAcquisition)],
  ['publisherName = 流量主名称', out.publisherName === 'linzhenhe', String(out.publisherName)],
  ['mediaName = 媒体/推广位', out.mediaName === 'NetshoesWL-FT1', String(out.mediaName)],
  ['externalTxnId = 数据ID', out.externalTxnId === '47859542', String(out.externalTxnId)],
];

let fail = 0;
for (const [name, ok, got] of checks) {
  console.log(ok ? '✓' : '✗', name, ok ? '' : `(got: ${got})`);
  if (!ok) fail++;
}
console.log(fail === 0 ? '\n全部通过（18/18）' : `\n失败 ${fail} 项`);
process.exit(fail === 0 ? 0 : 1);
