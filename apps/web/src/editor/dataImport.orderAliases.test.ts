import { describe, it, expect } from 'vitest';
import { buildPreviewFromRows } from './dataImport';

describe('buildPreviewFromRows orders 表头别名归一（1013 DG 误报修复）', () => {
  it('Awin 原始表头（snake_case）→ 归一后必填全中，不再误报缺字段', () => {
    const rows = [{
      campaignId: 'c1',
      order_reference: 'AWIN-001',
      date: '2026-10-01',
      commission_status: 'approved',
      product_name: 'Vitamin C Serum',
      sale_amount: '59.9',
      click_ref: 'https://example.com/?utm=ig',
      site_name: 'Example Site',
      customer_country: 'DE',
    }];
    const [p] = buildPreviewFromRows('orders', rows);
    expect(p.valid).toBe(true);
    expect(p.data.orderId).toBe('AWIN-001');
    expect(p.data.productName).toBe('Vitamin C Serum');
    expect(p.data.orderDate).toBe('2026-10-01');
    expect(p.data.saleAmount).toBe('59.9');
    expect(p.data.siteName).toBe('Example Site');
  });

  it('LinkSynergy 中文表头 → 归一后必填全中', () => {
    const rows = [{
      campaignId: 'c1',
      '数据ID': 'LS-100',
      '订单编号': 'ORD-88',
      '下单时间': '2026-10-02 10:00',
      '商品名称': '玻尿酸精华',
      '订单金额（元）': '199',
      '广告主佣金（元）': '15.9',
      '是否新客': '是',
    }];
    const [p] = buildPreviewFromRows('orders', rows);
    expect(p.valid).toBe(true);
    expect(p.data.orderId).toBe('ORD-88');
    expect(p.data.productName).toBe('玻尿酸精华');
    expect(p.data.externalTxnId).toBe('LS-100');
    expect(p.data.saleAmount).toBe('199');
    expect(p.data.commission).toBe('15.9');
    expect(p.data.customerAcquisition).toBe('是');
  });

  it('真缺必填（无 orderId 对应列）→ 仍正确报缺字段', () => {
    const rows = [{ campaignId: 'c1', product_name: 'X' }];
    const [p] = buildPreviewFromRows('orders', rows);
    expect(p.valid).toBe(false);
    expect(p.error).toContain('orderId');
  });

  it('规范 camelCase 表头直传 → 行为不变', () => {
    const rows = [{ campaignId: 'c1', orderId: 'O-1', productName: 'P' }];
    const [p] = buildPreviewFromRows('orders', rows);
    expect(p.valid).toBe(true);
  });

  it('非 orders 类型不走归一（campaign 原始行为不变）', () => {
    const rows = [{ id: 'c1', name: 'N', advertiser: 'A', businessLine: 'FT', platform: 'IG', startDate: '2026-10-01', endDate: '2026-10-31' }];
    const [p] = buildPreviewFromRows('campaign', rows);
    expect(p.valid).toBe(true);
  });
});
