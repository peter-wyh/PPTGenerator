-- 报告模版表：设计师(ADMIN) 维护、按业务线/场景分类、草稿/已发布状态。
-- pages/width/height/meta 与 Project 结构一致，编辑器可直接复用。
-- 对应 prisma/schema.prisma 的 Template 模型 + TemplateStatus 枚举。

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

ALTER TABLE `Template` ADD CONSTRAINT `Template_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
