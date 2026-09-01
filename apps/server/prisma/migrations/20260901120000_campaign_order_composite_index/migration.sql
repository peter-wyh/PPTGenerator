-- 0828 审计 P1：CampaignOrder 聚合复合索引
-- tracking link 聚合与按日明细的 GROUP BY (campaignId, publisherId, orderDate) 路径

CREATE INDEX `CampaignOrder_campaignId_publisherId_orderDate_idx` ON `CampaignOrder`(`campaignId`, `publisherId`, `orderDate`);
