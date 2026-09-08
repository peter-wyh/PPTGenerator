/**
 * OrdersPage 测试：mock campaignsApi，验证订单行渲染（0909 瘦身后 18 列主表）。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { campaignsApi, type OrdersPage as OrdersPageData } from '@/api/campaignsApi';
import OrdersPage from './OrdersPage';

vi.mock('@/api/campaignsApi', () => ({ campaignsApi: { listOrders: vi.fn(), list: vi.fn() } }));

const order = {
  id: 'o1',
  campaignId: 'c1',
  campaign: { id: 'c1', name: 'Trivago UK 2026-07' },
  campaignCreator: null,
  orderId: 'REF-1001',
  orderDate: '2026-07-15T10:00:00.000Z',
  orderStatus: 'approved',
  createdAt: '2026-08-01T00:00:00.000Z',
  items: [
    { id: 'i1', productName: 'Trivago Lead', category: null, sku: null, qty: 1, unitPrice: '1.00', lineTotal: '1.00' },
  ],
  // 平台镜像字段（0909 瘦身后保留的有消费方列：有值样例）
  source: 'awin',
  externalTxnId: '7100001',
  saleAmount: '1.00',
  commission: '1.50',
  validationDate: '2026-07-16T00:00:00.000Z',
  clickRef: 'creator_a',
  siteName: 'example.com',
  clickDevice: 'Desktop',
  customerCountry: 'GB',
  // 空值 → 展示 —
  publisherUrl: null,
  products: null,
  customerAcquisition: null,
} as unknown as OrdersPageData['rows'][number];

const page: OrdersPageData = { rows: [order], total: 1, page: 1, pageSize: 20 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(campaignsApi.listOrders).mockResolvedValue(page);
  vi.mocked(campaignsApi.list).mockResolvedValue([]);
});

describe('OrdersPage', () => {
  it('渲染订单基础列：订单号/campaign/下单时间/状态/佣金（全字段主表）', async () => {
    render(<OrdersPage />);
    await waitFor(() => expect(screen.getByText('REF-1001')).toBeTruthy());
    expect(screen.getByText('Trivago UK 2026-07')).toBeTruthy();
    expect(screen.getByText('2026-07-15')).toBeTruthy();
    expect(screen.getByText('approved')).toBeTruthy();
    // fmtMoney 统一 £ 口径（佣金 1.50 → £1.50）
    expect(screen.getByText('£1.50')).toBeTruthy();
  });

  it('主表罗列保留镜像字段列（点击引用/客户国家/交易ID/来源，空值占位 —）', async () => {
    render(<OrdersPage />);
    await waitFor(() => expect(screen.getByText('REF-1001')).toBeTruthy());

    // 有值字段直接在主表行内
    expect(screen.getByText('creator_a')).toBeTruthy();
    expect(screen.getByText('GB')).toBeTruthy();
    expect(screen.getByText('7100001')).toBeTruthy();
    expect(screen.getByText('awin')).toBeTruthy();
    // 列头（0909 瘦身后 18 列）
    expect(screen.getByText('Click Ref')).toBeTruthy();
    expect(screen.getByText('Country')).toBeTruthy();
    expect(screen.getByText('Txn ID')).toBeTruthy();
    expect(screen.getByText('Source')).toBeTruthy();
  });
});
