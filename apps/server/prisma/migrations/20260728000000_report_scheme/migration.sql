-- CreateTable: ReportScheme
-- 报告方案：可扩展的报告类型目录（如 DM 双周报、DM 月报等）。
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

-- AddForeignKey: ReportScheme -> User
ALTER TABLE `ReportScheme` ADD CONSTRAINT `ReportScheme_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
