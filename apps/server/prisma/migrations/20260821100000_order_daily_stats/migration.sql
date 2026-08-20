-- OrderDailyStat: 订单日级统计中间层（recomputeOrderStats 从 CampaignOrder 物化）。
-- 粒度：campaignId × statDate × campaignCreatorId（'' 哨兵 = 该日全 campaign 聚合行，
-- MySQL 唯一索引对 NULL 不去重故用空串）。Revenue = commission 口径（Lead 模式
-- saleAmount 恒 £1 占位，totalSaleAmount 仅存档）。日期 = 订单表已存 UTC 值截断。

CREATE TABLE `OrderDailyStat` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `campaignCreatorId` VARCHAR(191) NOT NULL DEFAULT '',
    `statDate` VARCHAR(191) NOT NULL,
    `totalOrders` INTEGER NOT NULL DEFAULT 0,
    `approvedOrders` INTEGER NOT NULL DEFAULT 0,
    `pendingOrders` INTEGER NOT NULL DEFAULT 0,
    `otherOrders` INTEGER NOT NULL DEFAULT 0,
    `totalCommission` DECIMAL(14,2) NOT NULL DEFAULT 0,
    `approvedCommission` DECIMAL(14,2) NOT NULL DEFAULT 0,
    `pendingCommission` DECIMAL(14,2) NOT NULL DEFAULT 0,
    `totalSaleAmount` DECIMAL(14,2) NOT NULL DEFAULT 0,
    `newCustomerOrders` INTEGER NOT NULL DEFAULT 0,
    `hasNewCustomerTag` BOOLEAN NOT NULL DEFAULT false,
    `topCountries` JSON NULL,
    `recomputedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `OrderDailyStat_campaignId_statDate_campaignCreatorId_key`(`campaignId`, `statDate`, `campaignCreatorId`),
    INDEX `OrderDailyStat_campaignId_statDate_idx`(`campaignId`, `statDate`),
    INDEX `OrderDailyStat_campaignCreatorId_idx`(`campaignCreatorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `OrderDailyStat` ADD CONSTRAINT `OrderDailyStat_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
