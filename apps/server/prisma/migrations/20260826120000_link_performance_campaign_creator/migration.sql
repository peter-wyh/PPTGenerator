-- 数据闭环（2026-08-26 用户定稿）：订单来自链接，链接来自媒体合作。
-- Campaign 1:N CampaignCreator（媒体合作）1:1 LinkPerformance（链接）1:N CampaignOrder（订单）。
-- campaignCreatorId 直接挂合作行；唯一约束 = 业务规则「1 次合作只有 1 个链接」
-- （MySQL 唯一索引允许多 NULL，未归因存量行可共存）。存量归因由回填脚本补齐。

ALTER TABLE `LinkPerformance`
    ADD COLUMN `campaignCreatorId` VARCHAR(191) NULL COMMENT '归属媒体合作行(闭环 FK;1 合作 1 链接)',
    ADD UNIQUE INDEX `uq_link_performance_campaign_creator`(`campaignCreatorId`),
    ADD CONSTRAINT `LinkPerformance_campaignCreatorId_fkey` FOREIGN KEY (`campaignCreatorId`) REFERENCES `CampaignCreator`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
