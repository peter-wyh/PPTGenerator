-- Guide: 业务线报告指南(AI 提示词层配置:品牌视觉/章节/展示形式/语调术语)
CREATE TABLE `Guide` (
    `id` VARCHAR(191) NOT NULL,
    `businessLineId` VARCHAR(191) NOT NULL,
    `scenario` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `isDefault` TINYINT(1) NOT NULL DEFAULT 0,
    `isActive` TINYINT(1) NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `Guide_businessLineId_idx`(`businessLineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
