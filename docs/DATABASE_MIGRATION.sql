-- ============================================================
-- PPTGenerator / MediaKit — 数据库迁移文档
-- 生成日期: 2026-08-06
-- 数据库: MySQL 8 (mediakit @ Docker 3317)
-- ORM: Prisma 5.x (provider: mysql)
-- ============================================================
--
-- 本文档分两部分：
--   A. 已有正式迁移（12 个 migration.sql，按时间排序）
--   B. Schema Drift 补全 SQL（8 张表 + 3 列缺失正式迁移，需在干净 DB 上手动执行）
--
-- 部署新环境时：先按顺序执行 A 部分，再执行 B 部分。
-- ============================================================


-- ██████████████████████████████████████████████████████████████
-- █ A 部分：已有正式迁移（apps/server/prisma/migrations/）       █
-- ██████████████████████████████████████████████████████████████


-- ────────────────────────────────────────────────────────────
-- 迁移 1/12: 20260701000000_init
-- 说明: 初始建表（User + Project）
-- ────────────────────────────────────────────────────────────

CREATE TABLE `User` (
    `id`           VARCHAR(30) NOT NULL,
    `email`        VARCHAR(191) NOT NULL,
    `passwordHash` LONGTEXT NOT NULL,
    `name`         VARCHAR(191) NULL,
    `role`         ENUM('ADMIN', 'USER') NOT NULL DEFAULT 'USER',
    `createdAt`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`    DATETIME(3) NOT NULL,
    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Project` (
    `id`        VARCHAR(30) NOT NULL,
    `ownerId`   VARCHAR(30) NOT NULL,
    `name`      VARCHAR(191) NOT NULL,
    `pages`     LONGTEXT NOT NULL,
    `width`     INTEGER NOT NULL DEFAULT 1280,
    `height`    INTEGER NOT NULL DEFAULT 720,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `Project_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Project` ADD CONSTRAINT `Project_ownerId_fkey`
    FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;


-- ────────────────────────────────────────────────────────────
-- 迁移 2/12: 20260702000000_share_token
-- 说明: Project 加 shareToken（公开分享链接）
-- ────────────────────────────────────────────────────────────

ALTER TABLE `Project` ADD COLUMN `shareToken` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `Project_shareToken_key` ON `Project`(`shareToken`);


-- ────────────────────────────────────────────────────────────
-- 迁移 3/12: 20260703000000_project_meta
-- 说明: Project 加 meta JSON（业务线/创建人/场景/广告主/campaign 信息）
-- ────────────────────────────────────────────────────────────

ALTER TABLE `Project` ADD COLUMN `meta` JSON NULL;


-- ────────────────────────────────────────────────────────────
-- 迁移 4/12: 20260708000000_add_template
-- 说明: PPT 报告模版表
-- ────────────────────────────────────────────────────────────

CREATE TABLE `Template` (
    `id`        VARCHAR(30) NOT NULL,
    `name`      VARCHAR(191) NOT NULL,
    `pages`     LONGTEXT NOT NULL,
    `width`     INTEGER NOT NULL DEFAULT 1280,
    `height`    INTEGER NOT NULL DEFAULT 720,
    `meta`      JSON NULL,
    `status`    ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `note`      VARCHAR(191) NULL,
    `ownerId`   VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `Template_ownerId_idx`(`ownerId`),
    INDEX `Template_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Template` ADD CONSTRAINT `Template_ownerId_fkey`
    FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;


-- ────────────────────────────────────────────────────────────
-- 迁移 5/12: 20260714000001_data_record
-- 说明: 数据管理库（Campaign / Creator 通用 JSON 存储）
-- ────────────────────────────────────────────────────────────

CREATE TABLE `DataRecord` (
    `id`        VARCHAR(30) NOT NULL,
    `kind`      ENUM('CAMPAIGN', 'CREATOR') NOT NULL,
    `ownerId`   VARCHAR(30) NOT NULL,
    `data`      JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `DataRecord_kind_idx`(`kind`),
    INDEX `DataRecord_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DataRecord` ADD CONSTRAINT `DataRecord_ownerId_fkey`
    FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;


-- ────────────────────────────────────────────────────────────
-- 迁移 6/12: 20260715000000_collaboration_kind
-- 说明: DataRecord.kind 加 COLLABORATION 枚举值
-- ────────────────────────────────────────────────────────────

ALTER TABLE `DataRecord` MODIFY COLUMN `kind`
    ENUM('CAMPAIGN', 'CREATOR', 'COLLABORATION') NOT NULL;


-- ────────────────────────────────────────────────────────────
-- 迁移 7/12: 20260716000000_creator_profile_stats
-- 说明: Creator 补 stats + profile 列（drift fix）
-- ────────────────────────────────────────────────────────────

ALTER TABLE `Creator` ADD COLUMN `stats` JSON NULL;
ALTER TABLE `Creator` ADD COLUMN `profile` JSON NULL;


-- ────────────────────────────────────────────────────────────
-- 迁移 8/12: 20260727000001_collab_creator_cps_sync
-- 说明: Schema drift 补全 — CampaignCreator 加 collabId/currency/totalPrice
--       Creator 加 contact/profileUrl/rate，新建 CpsPerformance 表
-- ────────────────────────────────────────────────────────────

ALTER TABLE `CampaignCreator` ADD COLUMN `collabId` VARCHAR(191) NULL,
    ADD COLUMN `currency` VARCHAR(191) NULL DEFAULT 'USD',
    ADD COLUMN `totalPrice` VARCHAR(191) NULL;

ALTER TABLE `Creator` ADD COLUMN `contact` JSON NULL,
    ADD COLUMN `profileUrl` VARCHAR(191) NULL,
    ADD COLUMN `rate` JSON NULL;

CREATE TABLE `CpsPerformance` (
    `id` VARCHAR(191) NOT NULL,
    `campaignCreatorId` VARCHAR(191) NOT NULL,
    `contentType` VARCHAR(191) NOT NULL,
    `linkUrl` VARCHAR(191) NULL,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `impressions` INTEGER NOT NULL DEFAULT 0,
    `orders` INTEGER NOT NULL DEFAULT 0,
    `gmv` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `commission` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `spend` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `daily` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `CpsPerformance_campaignCreatorId_idx`(`campaignCreatorId`),
    UNIQUE INDEX `CpsPerformance_campaignCreatorId_contentType_key`(`campaignCreatorId`, `contentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `CampaignCreator_collabId_idx` ON `CampaignCreator`(`collabId`);

ALTER TABLE `CpsPerformance` ADD CONSTRAINT `CpsPerformance_campaignCreatorId_fkey`
    FOREIGN KEY (`campaignCreatorId`) REFERENCES `CampaignCreator`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;


-- ────────────────────────────────────────────────────────────
-- 迁移 9/12: 20260728000000_report_scheme
-- 说明: 报告方案表（DM 双周报/月报等可扩展报告类型目录）
-- ────────────────────────────────────────────────────────────

CREATE TABLE `ReportScheme` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `businessLineCode` VARCHAR(191) NULL,
    `pageCount` INTEGER NOT NULL DEFAULT 8,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `defaultStyle` VARCHAR(191) NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `ReportScheme_code_key`(`code`),
    INDEX `ReportScheme_ownerId_idx`(`ownerId`),
    INDEX `ReportScheme_businessLineCode_idx`(`businessLineCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ReportScheme` ADD CONSTRAINT `ReportScheme_ownerId_fkey`
    FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;


-- ────────────────────────────────────────────────────────────
-- 迁移 10/12: 20260805000000_html_template
-- 说明: HTML 报告模板表 + Project 加 htmlContent 列
-- ────────────────────────────────────────────────────────────

CREATE TABLE `HtmlTemplate` (
    `id`          VARCHAR(191) NOT NULL,
    `name`        VARCHAR(191) NOT NULL,
    `html`        LONGTEXT NOT NULL,
    `description` VARCHAR(191) NULL,
    `category`    VARCHAR(191) NULL,
    `thumbnail`   VARCHAR(191) NULL,
    `status`      ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `ownerId`     VARCHAR(191) NOT NULL,
    `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`   DATETIME(3) NOT NULL,
    INDEX `HtmlTemplate_ownerId_idx`(`ownerId`),
    INDEX `HtmlTemplate_status_idx`(`status`),
    INDEX `HtmlTemplate_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `HtmlTemplate` ADD CONSTRAINT `HtmlTemplate_ownerId_fkey`
    FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Project` ADD COLUMN `htmlContent` LONGTEXT NULL;


-- ────────────────────────────────────────────────────────────
-- 迁移 11/12: 20260806000000_html_version_recipe
-- 说明: HtmlVersion 表（AI HTML 报告版本）+ recipe 配置列
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `HtmlVersion` (
    `id`          VARCHAR(191) NOT NULL,
    `projectId`   VARCHAR(191) NOT NULL,
    `name`        VARCHAR(191) NOT NULL,
    `html`        LONGTEXT NOT NULL,
    `source`      VARCHAR(191) NULL,
    `isActive`    BOOLEAN NOT NULL DEFAULT false,
    `ownerId`     VARCHAR(191) NOT NULL,
    `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`   DATETIME(3) NOT NULL,
    INDEX `HtmlVersion_projectId_idx`(`projectId`),
    INDEX `HtmlVersion_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `HtmlVersion` ADD CONSTRAINT `HtmlVersion_projectId_fkey`
    FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `HtmlVersion` ADD COLUMN `recipeId` VARCHAR(191) NULL;
ALTER TABLE `HtmlVersion` ADD COLUMN `reportContent` JSON NULL;
ALTER TABLE `HtmlVersion` ADD COLUMN `tokenOverrides` JSON NULL;
ALTER TABLE `HtmlVersion` ADD COLUMN `manifestOverrides` JSON NULL;


-- ────────────────────────────────────────────────────────────
-- 迁移 12/12: Project.reportSchemeVersion（缺失迁移补全）
-- 说明: schema.prisma 有此列但从未生成 ALTER TABLE 迁移
-- ────────────────────────────────────────────────────────────

ALTER TABLE `Project` ADD COLUMN `reportSchemeVersion` VARCHAR(191) NULL;


-- ██████████████████████████████████████████████████████████████
-- █ B 部分：Schema Drift 补全（drift tables 无正式迁移）         █
-- █                                                               █
-- █ 以下 8 张表通过 `prisma db push` 创建，从未生成 migration.sql █
-- █ 干净数据库执行完 A 部分后，需执行此部分才能完整建表。          █
-- ██████████████████████████████████████████████████████████████


-- ────────────────────────────────────────────────────────────
-- Drift 1/8: Merchant（商家/母品牌）
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `Merchant` (
    `id`        VARCHAR(191) NOT NULL,
    `name`      VARCHAR(191) NOT NULL,
    `logo`      VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `Merchant_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- ────────────────────────────────────────────────────────────
-- Drift 2/8: BusinessLine（业务线 FT/SM/CX/DG/KN/DM）
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `BusinessLine` (
    `id`          VARCHAR(191) NOT NULL,
    `code`        VARCHAR(191) NOT NULL,
    `name`        VARCHAR(191) NOT NULL,
    `logo`        VARCHAR(191) NULL,
    `color`       VARCHAR(191) NULL,
    `designMd`    TEXT NULL,
    `designMdUrl` VARCHAR(191) NULL,
    `merchantId`  VARCHAR(191) NULL,
    `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`   DATETIME(3) NOT NULL,
    UNIQUE INDEX `BusinessLine_code_key`(`code`),
    INDEX `BusinessLine_merchantId_idx`(`merchantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `BusinessLine` ADD CONSTRAINT `BusinessLine_merchantId_fkey`
    FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`)
    ON UPDATE CASCADE;


-- ────────────────────────────────────────────────────────────
-- Drift 3/8: Advertiser（广告主/子品牌）
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `Advertiser` (
    `id`             VARCHAR(191) NOT NULL,
    `name`           VARCHAR(191) NOT NULL,
    `logo`           VARCHAR(191) NULL,
    `businessLineId` VARCHAR(191) NOT NULL,
    `merchantId`     VARCHAR(191) NULL,
    `createdAt`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`      DATETIME(3) NOT NULL,
    UNIQUE INDEX `Advertiser_name_key`(`name`),
    INDEX `Advertiser_businessLineId_idx`(`businessLineId`),
    INDEX `Advertiser_merchantId_idx`(`merchantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Advertiser` ADD CONSTRAINT `Advertiser_businessLineId_fkey`
    FOREIGN KEY (`businessLineId`) REFERENCES `BusinessLine`(`id`)
    ON UPDATE CASCADE;

ALTER TABLE `Advertiser` ADD CONSTRAINT `Advertiser_merchantId_fkey`
    FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`)
    ON UPDATE CASCADE;


-- ────────────────────────────────────────────────────────────
-- Drift 4/8: Campaign（投放活动）
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `Campaign` (
    `id`        VARCHAR(191) NOT NULL,
    `name`      VARCHAR(191) NOT NULL,
    `platform`  VARCHAR(191) NOT NULL,
    `startDate` VARCHAR(191) NOT NULL,
    `endDate`   VARCHAR(191) NOT NULL,
    `budget`    VARCHAR(191) NOT NULL,
    `status`    VARCHAR(191) NULL,
    `owner`     VARCHAR(191) NULL,
    `businessLineId`   VARCHAR(191) NULL,
    `advertiserId`     VARCHAR(191) NULL,
    `businessLineCode` VARCHAR(191) NULL,
    `advertiserName`   VARCHAR(191) NULL,
    `metrics`   JSON NULL,
    `analytics` JSON NULL,
    `ownerId`   VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `Campaign_ownerId_idx`(`ownerId`),
    INDEX `Campaign_businessLineId_idx`(`businessLineId`),
    INDEX `Campaign_advertiserId_idx`(`advertiserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Campaign` ADD CONSTRAINT `Campaign_ownerId_fkey`
    FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Campaign` ADD CONSTRAINT `Campaign_businessLineId_fkey`
    FOREIGN KEY (`businessLineId`) REFERENCES `BusinessLine`(`id`)
    ON UPDATE CASCADE;

ALTER TABLE `Campaign` ADD CONSTRAINT `Campaign_advertiserId_fkey`
    FOREIGN KEY (`advertiserId`) REFERENCES `Advertiser`(`id`)
    ON UPDATE CASCADE;


-- ────────────────────────────────────────────────────────────
-- Drift 5/8: Creator（合作方库 — 达人/社群/内容站）
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `Creator` (
    `id`          VARCHAR(191) NOT NULL,
    `name`        VARCHAR(191) NOT NULL,
    `handle`      VARCHAR(191) NOT NULL,
    `platform`    VARCHAR(191) NOT NULL,
    `partnerType` VARCHAR(191) NULL DEFAULT 'creator',
    `tier`        VARCHAR(191) NOT NULL,
    `followers`   VARCHAR(191) NOT NULL,
    `engagement`  VARCHAR(191) NOT NULL,
    `category`    VARCHAR(191) NOT NULL,
    `region`      VARCHAR(191) NOT NULL,
    `avatar`      VARCHAR(191) NULL,
    `profileUrl`  VARCHAR(191) NULL,
    `contact`     JSON NULL,
    `rate`        JSON NULL,
    `metrics`     JSON NULL,
    `audience`    JSON NULL,
    `works`       JSON NULL,
    `stats`       JSON NULL,
    `profile`     JSON NULL,
    `ownerId`     VARCHAR(191) NOT NULL,
    `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`   DATETIME(3) NOT NULL,
    INDEX `Creator_ownerId_idx`(`ownerId`),
    INDEX `Creator_platform_idx`(`platform`),
    INDEX `Creator_tier_idx`(`tier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Creator` ADD CONSTRAINT `Creator_ownerId_fkey`
    FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;


-- ────────────────────────────────────────────────────────────
-- Drift 6/8: CampaignCreator（Campaign ↔ Creator 多对多中间表）
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `CampaignCreator` (
    `id`          VARCHAR(191) NOT NULL,
    `campaignId`  VARCHAR(191) NOT NULL,
    `creatorId`   VARCHAR(191) NOT NULL,
    `collabId`    VARCHAR(191) NULL,
    `collabType`  VARCHAR(191) NULL,
    `status`      VARCHAR(191) NULL,
    `contentType` VARCHAR(191) NULL,
    `currency`    VARCHAR(191) NULL DEFAULT 'USD',
    `totalPrice`  VARCHAR(191) NULL,
    `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`   DATETIME(3) NOT NULL,
    UNIQUE INDEX `CampaignCreator_campaignId_creatorId_key`(`campaignId`, `creatorId`),
    INDEX `CampaignCreator_campaignId_idx`(`campaignId`),
    INDEX `CampaignCreator_creatorId_idx`(`creatorId`),
    INDEX `CampaignCreator_collabId_idx`(`collabId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CampaignCreator` ADD CONSTRAINT `CampaignCreator_campaignId_fkey`
    FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `CampaignCreator` ADD CONSTRAINT `CampaignCreator_creatorId_fkey`
    FOREIGN KEY (`creatorId`) REFERENCES `Creator`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;


-- ────────────────────────────────────────────────────────────
-- Drift 7/8: CreatorPerformance（达人执行效果，1:1 挂 CampaignCreator）
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `CreatorPerformance` (
    `id`                VARCHAR(191) NOT NULL,
    `campaignCreatorId` VARCHAR(191) NOT NULL,
    `summary`           JSON NOT NULL,
    `posts`             JSON NULL,
    `daily`             JSON NULL,
    `placements`        JSON NULL,
    `cps`               JSON NULL,
    `createdAt`         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`         DATETIME(3) NOT NULL,
    UNIQUE INDEX `CreatorPerformance_campaignCreatorId_key`(`campaignCreatorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CreatorPerformance` ADD CONSTRAINT `CreatorPerformance_campaignCreatorId_fkey`
    FOREIGN KEY (`campaignCreatorId`) REFERENCES `CampaignCreator`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;


-- ────────────────────────────────────────────────────────────
-- Drift 8/8: Collaboration（合作详情，1:1 挂 CampaignCreator）
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `Collaboration` (
    `id`                VARCHAR(191) NOT NULL,
    `campaignCreatorId` VARCHAR(191) NOT NULL,
    `deliverables`      JSON NOT NULL,
    `legacyId`          VARCHAR(191) NULL,
    `createdAt`         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`         DATETIME(3) NOT NULL,
    UNIQUE INDEX `Collaboration_campaignCreatorId_key`(`campaignCreatorId`),
    INDEX `Collaboration_legacyId_idx`(`legacyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Collaboration` ADD CONSTRAINT `Collaboration_campaignCreatorId_fkey`
    FOREIGN KEY (`campaignCreatorId`) REFERENCES `CampaignCreator`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;


-- ██████████████████████████████████████████████████████████████
-- █ 表关系图 (ERD 概览)                                          █
-- ██████████████████████████████████████████████████████████████
--
-- User (用户)
-- ├── Project (报告项目) 1:N
-- │   └── HtmlVersion (HTML 报告版本) 1:N
-- ├── Template (PPT 模板) 1:N
-- ├── HtmlTemplate (HTML 模板) 1:N
-- ├── DataRecord (数据管理库 JSON) 1:N
-- ├── ReportScheme (报告方案) 1:N
-- ├── Campaign (投放活动) 1:N
-- │   └── CampaignCreator (中间表) 1:N
-- │       ├── CreatorPerformance (执行效果) 1:1
-- │       ├── Collaboration (合作详情) 1:1
-- │       └── CpsPerformance (CPS 链接效果) 1:N
-- └── Creator (合作方库) 1:N
--
-- Merchant (商家)
-- ├── BusinessLine (业务线) 1:N
-- └── Advertiser (广告主) 1:N (也可关联 BusinessLine)
--
-- BusinessLine (业务线)
-- ├── Advertiser (广告主) 1:N
-- └── Campaign (投放活动) 1:N
--
-- Advertiser (广告主)
-- └── Campaign (投放活动) 1:N


-- ██████████████████████████████████████████████████████████████
-- █ 统计摘要                                                     █
-- ██████████████████████████████████████████████████████████████
--
-- 模型总数:     16 (schema.prisma)
-- 正式迁移:     12 (apps/server/prisma/migrations/)
-- Drift 补全:    8 张表 + 3 列缺失迁移
-- 总表数:       16
-- 字符集:       utf8mb4 / utf8mb4_unicode_ci
-- 主键策略:     VARCHAR(30) cuid (User/Project/Template/DataRecord)
--               VARCHAR(191) cuid (其余表)
--               Creator/DataRecord: 应用层生成 id (不自动)
