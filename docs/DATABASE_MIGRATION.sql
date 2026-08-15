-- ============================================================
-- PPTGenerator / MediaKit — 数据库结构 bootstrap（clean-DB 可执行）
-- 生成日期: 2026-08-06
-- 数据库: MySQL 8 (mediakit)
-- ORM:    Prisma 5.x (provider: mysql)
-- ============================================================
--
-- 本文件是一份【合并后的干净库 bootstrap】：把
--   • apps/server/prisma/migrations/ 下 11 个正式迁移
--   • 经 `prisma db push` 漂移产生、但从未有 migration.sql 的 8 张 drift 表
--   • schema.prisma 里有、但从未生成 ALTER 迁移的 drift 列
-- 全部按【外键依赖顺序】重排成一条前向、无重复、可直接执行的 DDL 序列。
--
-- ┌─ 为什么不能简单地「先跑 11 个迁移，再补 drift」？──────────────────┐
-- │ 历史上 drift 表是先用 `prisma db push` 建出来的，迁移 7/8 是在      │
-- │ 【drift 表已存在】的前提下补列的（dev DB 用户无 CREATE DATABASE，    │
-- │ `prisma migrate dev` 走 P3014 失败，详见项目记忆）。所以：           │
-- │   • 迁移 7 `ALTER TABLE Creator ADD stats/profile` ——依赖 Creator 已建│
-- │   • 迁移 8 `ALTER TABLE CampaignCreator ADD ...` ——依赖 CC 已建       │
-- │ 干净库里这些表还不存在，直接跑 A 必报 Table doesn't exist；          │
-- │ 反过来「先 drift 后迁移」又会因 drift 建表已含这些列而报 Duplicate   │
-- │ column。本文件把迁移 7/8 的补列直接并入对应 CREATE TABLE，根除冲突。 │
-- └────────────────────────────────────────────────────────────────────┘
--
-- ┌─ 与 Prisma 迁移表的关系（重要）────────────────────────────────────┐
-- │ 本文件【不写 _prisma_migrations 表】，是一次性结构 bootstrap，适合： │
-- │   (a) 手工/审计用的一次性干净库建表；                                │
-- │   (b) 给 CI/测试起 throwaway 实例后灌结构。                          │
-- │                                                                      │
-- │ ⚠ `prisma migrate deploy` 在干净库上【同样会失败】，根因相同：        │
-- │   迁移 7 `ALTER TABLE Creator ...` / 迁移 8 `ALTER TABLE              │
-- │   CampaignCreator ...` 依赖的 drift 表（Creator/CampaignCreator）在   │
-- │   干净库里不存在，而它们从未有过 CREATE TABLE 迁移。也就是说，光靠    │
-- │   migrations/ 目录无法 bootstrap 一个干净库。                         │
-- │                                                                      │
-- │ 本合并文件是目前【唯一】可工作的干净库 bootstrap。若要让              │
-- │ `migrate deploy` 也能干净库端到端跑通，正确做法是另起一个正式迁移     │
-- │ 目录（timestamp 排在迁移 6 与 7 之间），把 8 张 drift 表的             │
-- │ CREATE TABLE + reportSchemeVersion 列写进去——那是独立的更大改动，    │
-- │ 不在本文件范围内（涉及 migrations 目录 + shadow DB 限制）。           │
-- └────────────────────────────────────────────────────────────────────┘
--
-- 执行前提：目标 schema 为空（无同名表）。建表按依赖顺序排列，无需
-- SET FOREIGN_KEY_CHECKS=0；若在已有部分表的库上重跑，请先 DROP 对应表。
-- ============================================================


-- ██████████████████████████████████████████████████████████████
-- █ 来源对照（provenance）                                       █
-- █ 每张表 = 基础建表来源 + 后续并入的列来源                       █
-- ██████████████████████████████████████████████████████████████
--
-- User               ← 20260701000000_init
-- Project            ← init + shareToken(mig2) + meta(mig3)
--                       + reportSchemeVersion(无迁移·drift列)
--                       + htmlContent(mig10)
-- HtmlVersion        ← 20260806000000_html_version_recipe（含 recipe 4 列）
-- Template           ← 20260708000000_add_template
-- DataRecord         ← 20260714000001_data_record（kind ENUM 取 mig6 最终态）
-- Merchant           ← drift（db push，无 migration.sql）
-- BusinessLine       ← drift
-- Advertiser         ← drift
-- Campaign           ← drift
-- Creator            ← drift 建表 + stats/profile(原 mig7 ALTER，现并入建表)
--                       + contact/profileUrl/rate(原 mig8 ALTER，现并入建表)
-- CampaignCreator    ← drift 建表 + collabId/currency/totalPrice
--                       (原 mig8 ALTER，现并入建表)
-- CreatorPerformance ← drift
-- Collaboration      ← drift
-- CpsPerformance     ← 20260727000001_collab_creator_cps_sync
-- ReportScheme       ← 20260728000000_report_scheme
-- HtmlTemplate       ← 20260805000000_html_template
--
-- 正式迁移目录实际为 11 个（非 12）：
--   init / share_token / project_meta / add_template / data_record /
--   collaboration_kind / creator_profile_stats / collab_creator_cps_sync /
--   report_scheme / html_template / html_version_recipe
-- ============================================================


-- ██████████████████████████████████████████████████████████████
-- █ 1. 用户根表                                                  █
-- ██████████████████████████████████████████████████████████████

-- User ─ init
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


-- ██████████████████████████████████████████████████████████████
-- █ 2. User 直接拥有的实体                                       █
-- ██████████████████████████████████████████████████████████████

-- Project ─ init + shareToken(mig2) + meta(mig3) + reportSchemeVersion(drift列) + htmlContent(mig10)
CREATE TABLE `Project` (
    `id`                  VARCHAR(30) NOT NULL,
    `ownerId`             VARCHAR(30) NOT NULL,
    `name`                VARCHAR(191) NOT NULL,
    `pages`               LONGTEXT NOT NULL,
    `width`               INTEGER NOT NULL DEFAULT 1280,
    `height`              INTEGER NOT NULL DEFAULT 720,
    `shareToken`          VARCHAR(191) NULL,
    `meta`                JSON NULL,
    `reportSchemeVersion` VARCHAR(191) NULL,
    `htmlContent`         LONGTEXT NULL,
    `createdAt`           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`           DATETIME(3) NOT NULL,
    UNIQUE INDEX `Project_shareToken_key`(`shareToken`),
    INDEX `Project_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Project` ADD CONSTRAINT `Project_ownerId_fkey`
    FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;


-- HtmlVersion ─ 20260806000000_html_version_recipe（含 recipe 4 列，FK→Project）
CREATE TABLE `HtmlVersion` (
    `id`                VARCHAR(191) NOT NULL,
    `projectId`         VARCHAR(191) NOT NULL,
    `name`              VARCHAR(191) NOT NULL,
    `html`              LONGTEXT NOT NULL,
    `source`            VARCHAR(191) NULL,
    `recipeId`          VARCHAR(191) NULL,
    `reportContent`     JSON NULL,
    `tokenOverrides`    JSON NULL,
    `manifestOverrides` JSON NULL,
    `isActive`          BOOLEAN NOT NULL DEFAULT false,
    `ownerId`           VARCHAR(191) NOT NULL,
    `createdAt`         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`         DATETIME(3) NOT NULL,
    INDEX `HtmlVersion_projectId_idx`(`projectId`),
    INDEX `HtmlVersion_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `HtmlVersion` ADD CONSTRAINT `HtmlVersion_projectId_fkey`
    FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;


-- Template ─ 20260708000000_add_template
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


-- DataRecord ─ 20260714000001_data_record；kind ENUM 取 20260715000000_collaboration_kind 的最终态
CREATE TABLE `DataRecord` (
    `id`        VARCHAR(30) NOT NULL,
    `kind`      ENUM('CAMPAIGN', 'CREATOR', 'COLLABORATION') NOT NULL,
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


-- ██████████████████████████████████████████████████████████████
-- █ 3. 品牌 / 业务线 / 广告主层级（drift 表，无 FK→User）         █
-- ██████████████████████████████████████████████████████████████

-- Merchant ─ drift
CREATE TABLE `Merchant` (
    `id`        VARCHAR(191) NOT NULL,
    `name`      VARCHAR(191) NOT NULL,
    `logo`      VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `Merchant_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- BusinessLine ─ drift（FK→Merchant）
CREATE TABLE `BusinessLine` (
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


-- Advertiser ─ drift（FK→BusinessLine, Merchant）
CREATE TABLE `Advertiser` (
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


-- ██████████████████████████████████████████████████████████████
-- █ 4. Campaign / Creator / CampaignCreator 图                   █
-- ██████████████████████████████████████████████████████████████

-- Campaign ─ drift（FK→User, BusinessLine, Advertiser）
CREATE TABLE `Campaign` (
    `id`               VARCHAR(191) NOT NULL,
    `name`             VARCHAR(191) NOT NULL,
    `platform`         VARCHAR(191) NOT NULL,
    `startDate`        VARCHAR(191) NOT NULL,
    `endDate`          VARCHAR(191) NOT NULL,
    `budget`           VARCHAR(191) NOT NULL,
    `status`           VARCHAR(191) NULL,
    `owner`            VARCHAR(191) NULL,
    `businessLineId`   VARCHAR(191) NULL,
    `advertiserId`     VARCHAR(191) NULL,
    `businessLineCode` VARCHAR(191) NULL,
    `advertiserName`   VARCHAR(191) NULL,
    `metrics`          JSON NULL,
    `analytics`        JSON NULL,
    `ownerId`          VARCHAR(191) NOT NULL,
    `createdAt`        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`        DATETIME(3) NOT NULL,
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


-- Creator ─ drift 建表 + stats/profile(原 mig7 ALTER) + contact/profileUrl/rate(原 mig8 ALTER)，FK→User
CREATE TABLE `Creator` (
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


-- CampaignCreator ─ drift 建表 + collabId/currency/totalPrice(原 mig8 ALTER)，FK→Campaign, Creator
CREATE TABLE `CampaignCreator` (
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


-- ██████████████████████████████████████████████████████████████
-- █ 5. CampaignCreator 的子表（1:1 / 1:N）                       █
-- █    必须在 CampaignCreator 之后建                              █
-- ██████████████████████████████████████████████████████████████

-- CreatorPerformance ─ drift（1:1，FK→CampaignCreator）
CREATE TABLE `CreatorPerformance` (
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


-- Collaboration ─ drift（1:1，FK→CampaignCreator）
CREATE TABLE `Collaboration` (
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


-- CpsPerformance ─ 20260727000001_collab_creator_cps_sync（1:N，FK→CampaignCreator）
CREATE TABLE `CpsPerformance` (
    `id`                VARCHAR(191) NOT NULL,
    `campaignCreatorId` VARCHAR(191) NOT NULL,
    `contentType`       VARCHAR(191) NOT NULL,
    `linkUrl`           VARCHAR(191) NULL,
    `clicks`            INTEGER NOT NULL DEFAULT 0,
    `impressions`       INTEGER NOT NULL DEFAULT 0,
    `orders`            INTEGER NOT NULL DEFAULT 0,
    `gmv`               DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `commission`        DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `spend`             DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `daily`             JSON NULL,
    `createdAt`         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`         DATETIME(3) NOT NULL,
    INDEX `CpsPerformance_campaignCreatorId_idx`(`campaignCreatorId`),
    UNIQUE INDEX `CpsPerformance_campaignCreatorId_contentType_key`(`campaignCreatorId`, `contentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CpsPerformance` ADD CONSTRAINT `CpsPerformance_campaignCreatorId_fkey`
    FOREIGN KEY (`campaignCreatorId`) REFERENCES `CampaignCreator`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;


-- ██████████████████████████████████████████████████████████████
-- █ 6. 报告方案 / HTML 模板（FK→User）                            █
-- ██████████████████████████████████████████████████████████████

-- ReportScheme ─ 20260728000000_report_scheme（FK→User）
CREATE TABLE `ReportScheme` (
    `id`               VARCHAR(191) NOT NULL,
    `code`             VARCHAR(191) NOT NULL,
    `name`             VARCHAR(191) NOT NULL,
    `description`      VARCHAR(191) NULL,
    `businessLineCode` VARCHAR(191) NULL,
    `pageCount`        INTEGER NOT NULL DEFAULT 8,
    `enabled`          BOOLEAN NOT NULL DEFAULT true,
    `sortOrder`        INTEGER NOT NULL DEFAULT 0,
    `defaultStyle`     VARCHAR(191) NULL,
    `ownerId`          VARCHAR(191) NOT NULL,
    `createdAt`        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`        DATETIME(3) NOT NULL,
    UNIQUE INDEX `ReportScheme_code_key`(`code`),
    INDEX `ReportScheme_ownerId_idx`(`ownerId`),
    INDEX `ReportScheme_businessLineCode_idx`(`businessLineCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ReportScheme` ADD CONSTRAINT `ReportScheme_ownerId_fkey`
    FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;


-- HtmlTemplate ─ 20260805000000_html_template（FK→User）
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


-- ██████████████████████████████████████████████████████████████
-- █ 表关系图 (ERD 概览)                                          █
-- ██████████████████████████████████████████████████████████████
--
-- User (用户)
-- ├── Project (报告项目) 1:N
-- │   └── HtmlVersion (HTML 报告版本) 1:N
-- ├── Template (PPT 模板) 1:N
-- ├── DataRecord (数据管理库 JSON) 1:N
-- ├── ReportScheme (报告方案) 1:N
-- ├── HtmlTemplate (HTML 模板) 1:N
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
-- 总表数:       16（无隐式 M2M 隐式表，所有关系均显式 FK）
-- 正式迁移目录: 11（apps/server/prisma/migrations/）
-- Drift 来源:   8 张表（db push，无 migration.sql）
--               + reportSchemeVersion 列（schema 有、无 ALTER 迁移）
-- 字符集:       utf8mb4 / utf8mb4_unicode_ci
-- 主键策略:     VARCHAR(30) cuid 默认 → User / Project / Template / DataRecord
--               VARCHAR(191) cuid 默认 → 其余表
--               DataRecord.id / Creator.id → 应用层生成（@id 无 @default），不自动
--
-- ⚠ 与原版差异（相对 6a15e48 提交的旧 DATABASE_MIGRATION.sql）:
--   1. 建表顺序改为按外键依赖排列，干净库可一次性按序执行；
--   2. 迁移 7/8 原 ALTER ADD 的列（Creator 的 stats/profile/contact/profileUrl/
--      rate；CampaignCreator 的 collabId/currency/totalPrice）直接并入各自
--      CREATE TABLE，消除 Duplicate column / Table doesn't exist 冲突；
--   3. reportSchemeVersion 并入 Project 建表（不再是孤立的“迁移 12/12”）；
--   4. 修正迁移计数：11 个正式迁移目录（旧文档误写为 12）；
--   5. 修正摘要：DataRecord.id 为应用层生成，不在 cuid 默认列表内。
