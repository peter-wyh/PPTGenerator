-- 媒体维度 / 链接效果 / 商品主档（数据结构升级 2026-08-25）。
-- 概念：订单先归因到链接(publisher_url)，链接属于媒体(publisher)，达人只是媒体类型之一；
-- clicks/impressions/ctr/cvr/epc 全部是链接维度指标。

-- ── Publisher 媒体主档 ─────────────────────────────────────────────────
CREATE TABLE `Publisher` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL COMMENT '媒体名称(site_name 或人工维护)',
    `type` VARCHAR(191) NOT NULL DEFAULT 'media_site' COMMENT 'creator/community/content_site/media_site',
    `domain` VARCHAR(191) NOT NULL COMMENT '归一化域名(小写去www;publisher_url 解析键)',
    `platform` VARCHAR(191) NULL,
    `url` TEXT NULL,
    `creatorId` VARCHAR(191) NULL COMMENT '达人型媒体关联达人主档',
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `Publisher_domain_key`(`domain`),
    INDEX `Publisher_creatorId_idx`(`creatorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── LinkPerformance 链接效果表（Click_References 口径） ─────────────────
CREATE TABLE `LinkPerformance` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `publisherId` VARCHAR(191) NOT NULL,
    `linkUrl` TEXT NULL COMMENT '原始链接 URL(cloak 长链)',
    `linkKey` VARCHAR(191) NOT NULL COMMENT '归一化链接键(click_ref 原值或域名)',
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `impressions` INTEGER NOT NULL DEFAULT 0,
    `orders` INTEGER NOT NULL DEFAULT 0,
    `gmv` DECIMAL(14,2) NOT NULL DEFAULT 0,
    `commission` DECIMAL(14,2) NOT NULL DEFAULT 0,
    `spend` DECIMAL(14,2) NOT NULL DEFAULT 0,
    `daily` JSON NULL COMMENT '每日明细',
    `migratedFromCpsId` VARCHAR(191) NULL COMMENT '溯源 CpsPerformance.id',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `LinkPerformance_campaignId_publisherId_linkKey_key`(`campaignId`,`publisherId`,`linkKey`),
    INDEX `LinkPerformance_campaignId_idx`(`campaignId`),
    INDEX `LinkPerformance_publisherId_idx`(`publisherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── PublisherDailyStat 媒体日统计中间表 ────────────────────────────────
CREATE TABLE `PublisherDailyStat` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `publisherId` VARCHAR(191) NOT NULL,
    `statDate` VARCHAR(191) NOT NULL COMMENT '统计日 YYYY-MM-DD',
    `clicks` INTEGER NOT NULL DEFAULT 0 COMMENT '流量侧(LinkPerformance.daily 合并)',
    `impressions` INTEGER NOT NULL DEFAULT 0,
    `orders` INTEGER NOT NULL DEFAULT 0 COMMENT '成交侧(订单表逐单聚合真源)',
    `gmv` DECIMAL(14,2) NOT NULL DEFAULT 0,
    `commission` DECIMAL(14,2) NOT NULL DEFAULT 0,
    `recomputedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `PublisherDailyStat_campaignId_publisherId_statDate_key`(`campaignId`,`publisherId`,`statDate`),
    INDEX `PublisherDailyStat_campaignId_statDate_idx`(`campaignId`,`statDate`),
    INDEX `PublisherDailyStat_publisherId_idx`(`publisherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── Product 商品主档 ───────────────────────────────────────────────────
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL COMMENT '商品名(导入原名)',
    `sku` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `imageUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `Product_name_idx`(`name`),
    INDEX `Product_sku_idx`(`sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── CampaignOrder：媒体/链接归因列 ─────────────────────────────────────
ALTER TABLE `CampaignOrder`
    ADD COLUMN `publisherId` VARCHAR(191) NULL COMMENT '归因媒体(导入时按 publisherUrl 域名解析)',
    ADD COLUMN `linkPerformanceId` VARCHAR(191) NULL COMMENT '归因链接(LinkPerformance.id)',
    ADD INDEX `CampaignOrder_publisherId_idx`(`publisherId`);

-- ── CampaignOrderItem：商品主档 FK ─────────────────────────────────────
ALTER TABLE `CampaignOrderItem`
    ADD COLUMN `productId` VARCHAR(191) NULL COMMENT '商品主档 FK(导入时自动 upsert 匹配)';

-- ── FK（迁移最后统一加，避免中途引用失败） ─────────────────────────────
ALTER TABLE `Publisher` ADD FOREIGN KEY (`creatorId`) REFERENCES `Creator`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `LinkPerformance` ADD FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LinkPerformance` ADD FOREIGN KEY (`publisherId`) REFERENCES `Publisher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PublisherDailyStat` ADD FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PublisherDailyStat` ADD FOREIGN KEY (`publisherId`) REFERENCES `Publisher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CampaignOrder` ADD FOREIGN KEY (`publisherId`) REFERENCES `Publisher`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `CampaignOrder` ADD FOREIGN KEY (`linkPerformanceId`) REFERENCES `LinkPerformance`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `CampaignOrderItem` ADD FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
