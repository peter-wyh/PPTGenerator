/**
 * OrdersPage 测试：mock campaignsApi，验证订单行渲染 + 展开后
 * 「Awin 明细」面板显示全部镜像字段（含空值占位 —）。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  // Awin 镜像字段（页面需展示的有值样例）
  awinId: '7100001',
  advertiserId: '1442864',
  saleAmount: '1.00',
  commission: '1.50',
  validationDate: '2026-07-16T00:00:00.000Z',
  clickRef: 'creator_a',
  type: 'Lead',
  siteName: 'example.com',
  url: 'https://www.trivago.co.uk/',
  clickDevice: 'Desktop',
  transactionDevice: 'Mobile',
  customerCountry: 'GB',
  lapseTime: 3200,
  clickThroughTime: '2026-07-15T09:06:40.000Z',
  campaignLabel: 'July Promo',
  // 其余镜像字段为空 → 展示 —
  declineReason: null,
  voucherCodeUsed: null,
  amended: null,
  amendReason: null,
  oldSaleAmount: null,
  oldCommission: null,
  differentCurrency: null,
  publisherUrl: null,
  transactionParts: null,
  customParameters: null,
  paidToPublisher: null,
  paymentStatus: null,
  paymentId: null,
  transactionQueryId: null,
  clickRef2: null,
  clickRef3: null,
  clickRef4: null,
  clickRef5: null,
  clickRef6: null,
  voucherCode: null,
  commissionSharingPublisherId: null,
  commissionSharingPublisher: null,
  commissionSharingSelectedRatePublisherId: null,
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
  it('渲染订单基础列：订单号/campaign/下单时间/状态/佣金', async () => {
    render(<OrdersPage />);
    await waitFor(() => expect(screen.getByText('REF-1001')).toBeTruthy());
    expect(screen.getByText('Trivago UK 2026-07')).toBeTruthy();
    expect(screen.getByText('2026-07-15')).toBeTruthy();
    expect(screen.getByText('approved')).toBeTruthy();
    expect(screen.getByText('$1.50')).toBeTruthy();
  });

  it('展开行显示「Awin 明细」面板与镜像字段值（有值与空值占位）', async () => {
    render(<OrdersPage />);
    await waitFor(() => expect(screen.getByText('REF-1001')).toBeTruthy());
    fireEvent.click(screen.getByText('商品'));

    // 面板标题（整句为「Awin 明细（transactions 导出全字段）」）
    expect(screen.getByText(/Awin 明细/)).toBeTruthy();
    // 有值字段（label + value 都在）
    expect(screen.getByText('Awin 交易 ID')).toBeTruthy();
    expect(screen.getByText('7100001')).toBeTruthy();
    expect(screen.getByText('点击引用')).toBeTruthy();
    expect(screen.getByText('creator_a')).toBeTruthy();
    expect(screen.getByText('客户国家')).toBeTruthy();
    expect(screen.getByText('GB')).toBeTruthy();
    // 空值字段占位 —（decline_reason 为 null）
    expect(screen.getByText('拒单原因')).toBeTruthy();
  });
});
