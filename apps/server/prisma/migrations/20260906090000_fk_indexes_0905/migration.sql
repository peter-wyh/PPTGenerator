-- 0905 审计 P1-6：FK 索引补齐
-- 1) cps-source.ts / campaigns.service.ts 的 LEFT JOIN LinkPerformance ON o.linkPerformanceId = lp.id
--    此前无索引走全表扫（订单大表 × 链接表 JOIN）
CREATE INDEX `CampaignOrder_linkPerformanceId_idx` ON `CampaignOrder`(`linkPerformanceId`);

-- 2) CampaignOrderItem.productId：商品主档关联（导入 upsert Product 匹配 / 按商品聚合预留）
CREATE INDEX `CampaignOrderItem_productId_idx` ON `CampaignOrderItem`(`productId`);
