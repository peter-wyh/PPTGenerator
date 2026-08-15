-- 补录 12 张从未进入 migration 链的表（历史 db push 漂移）。
-- 背景:init migration 只建了 User/Project/Template/DataRecord 等早期表,
-- 达人库/HTML 报告/CPS 等表此前只经 prisma db push 进入 dev 库。
-- 本迁移按拓扑序建齐 12 张表,修复断链,使 migrate deploy 可从零建出完整 schema。
-- 依赖的既有表(User/Project)已由更早 migration 创建。

-- CreateTable

CREATE TABLE `Merchant` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `logo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Merchant_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BusinessLine` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `logo` VARCHAR(191) NULL,
    `color` VARCHAR(191) NULL,
    `designMd` TEXT NULL,
    `designMdUrl` VARCHAR(191) NULL,
    `merchantId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BusinessLine_code_key`(`code`),
    INDEX `BusinessLine_merchantId_idx`(`merchantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Advertiser` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `logo` VARCHAR(191) NULL,
    `businessLineId` VARCHAR(191) NOT NULL,
    `merchantId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Advertiser_name_key`(`name`),
    INDEX `Advertiser_businessLineId_idx`(`businessLineId`),
    INDEX `Advertiser_merchantId_idx`(`merchantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Campaign` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `platform` VARCHAR(191) NOT NULL,
    `startDate` VARCHAR(191) NOT NULL,
    `endDate` VARCHAR(191) NOT NULL,
    `budget` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NULL,
    `owner` VARCHAR(191) NULL,
    `businessLineId` VARCHAR(191) NULL,
    `advertiserId` VARCHAR(191) NULL,
    `businessLineCode` VARCHAR(191) NULL,
    `advertiserName` VARCHAR(191) NULL,
    `metrics` JSON NULL,
    `analytics` JSON NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Campaign_ownerId_idx`(`ownerId`),
    INDEX `Campaign_businessLineId_idx`(`businessLineId`),
    INDEX `Campaign_advertiserId_idx`(`advertiserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Creator` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `handle` VARCHAR(191) NOT NULL,
    `platform` VARCHAR(191) NOT NULL,
    `partnerType` VARCHAR(191) NULL DEFAULT 'creator',
    `tier` VARCHAR(191) NOT NULL,
    `followers` VARCHAR(191) NOT NULL,
    `engagement` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `region` VARCHAR(191) NOT NULL,
    `avatar` VARCHAR(191) NULL,
    `metrics` JSON NULL,
    `audience` JSON NULL,
    `works` JSON NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Creator_ownerId_idx`(`ownerId`),
    INDEX `Creator_platform_idx`(`platform`),
    INDEX `Creator_tier_idx`(`tier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CampaignCreator` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `creatorId` VARCHAR(191) NOT NULL,
    `collabType` VARCHAR(191) NULL,
    `status` VARCHAR(191) NULL,
    `contentType` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CampaignCreator_campaignId_idx`(`campaignId`),
    INDEX `CampaignCreator_creatorId_idx`(`creatorId`),
    UNIQUE INDEX `CampaignCreator_campaignId_creatorId_key`(`campaignId`, `creatorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CreatorPerformance` (
    `id` VARCHAR(191) NOT NULL,
    `campaignCreatorId` VARCHAR(191) NOT NULL,
    `summary` JSON NOT NULL,
    `posts` JSON NULL,
    `daily` JSON NULL,
    `placements` JSON NULL,
    `cps` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CreatorPerformance_campaignCreatorId_key`(`campaignCreatorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Collaboration` (
    `id` VARCHAR(191) NOT NULL,
    `campaignCreatorId` VARCHAR(191) NOT NULL,
    `deliverables` JSON NOT NULL,
    `legacyId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Collaboration_campaignCreatorId_key`(`campaignCreatorId`),
    INDEX `Collaboration_legacyId_idx`(`legacyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateForeignKey
ALTER TABLE `BusinessLine` ADD CONSTRAINT `BusinessLine_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Advertiser` ADD CONSTRAINT `Advertiser_businessLineId_fkey` FOREIGN KEY (`businessLineId`) REFERENCES `BusinessLine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Advertiser` ADD CONSTRAINT `Advertiser_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Campaign` ADD CONSTRAINT `Campaign_businessLineId_fkey` FOREIGN KEY (`businessLineId`) REFERENCES `BusinessLine`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Campaign` ADD CONSTRAINT `Campaign_advertiserId_fkey` FOREIGN KEY (`advertiserId`) REFERENCES `Advertiser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Campaign` ADD CONSTRAINT `Campaign_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Creator` ADD CONSTRAINT `Creator_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CampaignCreator` ADD CONSTRAINT `CampaignCreator_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CampaignCreator` ADD CONSTRAINT `CampaignCreator_creatorId_fkey` FOREIGN KEY (`creatorId`) REFERENCES `Creator`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `CreatorPerformance` ADD CONSTRAINT `CreatorPerformance_campaignCreatorId_fkey` FOREIGN KEY (`campaignCreatorId`) REFERENCES `CampaignCreator`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Collaboration` ADD CONSTRAINT `Collaboration_campaignCreatorId_fkey` FOREIGN KEY (`campaignCreatorId`) REFERENCES `CampaignCreator`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
