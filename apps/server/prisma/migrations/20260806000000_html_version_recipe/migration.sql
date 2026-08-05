-- CreateTable: HtmlVersion
-- AI 生成的 HTML 报告版本（一个 Project 可有多个版本）。
-- 注意:此前 schema drift,HtmlVersion 表存在但从未有过 CREATE TABLE 迁移;
-- 此处补齐 CREATE TABLE IF NOT EXISTS,使干净的 DB 按顺序 apply 迁移也能建表。
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

-- AddForeignKey: HtmlVersion -> Project
ALTER TABLE `HtmlVersion` ADD CONSTRAINT `HtmlVersion_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddColumn: HtmlVersion recipe 配置(模板化报告专用,ai 报告保持 null)
ALTER TABLE `HtmlVersion` ADD COLUMN `recipeId` VARCHAR(191) NULL;
ALTER TABLE `HtmlVersion` ADD COLUMN `reportContent` JSON NULL;
ALTER TABLE `HtmlVersion` ADD COLUMN `tokenOverrides` JSON NULL;
ALTER TABLE `HtmlVersion` ADD COLUMN `manifestOverrides` JSON NULL;
