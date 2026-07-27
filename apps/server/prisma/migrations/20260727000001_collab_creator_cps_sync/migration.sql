-- Drift fix: sync DB to schema.prisma.
-- These fields/tables were added to schema.prisma without a migration
-- (dev DB user lacks CREATE DATABASE → `prisma migrate dev` fails P3014),
-- so dev/prod DBs lagged the schema and Prisma queries threw P2022.
--   - CampaignCreator: collabId / currency / totalPrice (+ index)
--   - Creator: contact / profileUrl / rate
--   - CpsPerformance: new table (Phase 4 CPS link performance)

-- AlterTable: CampaignCreator
ALTER TABLE `CampaignCreator` ADD COLUMN `collabId` VARCHAR(191) NULL,
    ADD COLUMN `currency` VARCHAR(191) NULL DEFAULT 'USD',
    ADD COLUMN `totalPrice` VARCHAR(191) NULL;

-- AlterTable: Creator
ALTER TABLE `Creator` ADD COLUMN `contact` JSON NULL,
    ADD COLUMN `profileUrl` VARCHAR(191) NULL,
    ADD COLUMN `rate` JSON NULL;

-- CreateTable: CpsPerformance
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

-- CreateIndex: CampaignCreator.collabId
CREATE INDEX `CampaignCreator_collabId_idx` ON `CampaignCreator`(`collabId`);

-- AddForeignKey: CpsPerformance -> CampaignCreator
ALTER TABLE `CpsPerformance` ADD CONSTRAINT `CpsPerformance_campaignCreatorId_fkey` FOREIGN KEY (`campaignCreatorId`) REFERENCES `CampaignCreator`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
