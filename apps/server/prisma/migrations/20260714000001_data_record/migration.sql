-- 数据管理库记录:Campaign / 达人库(Creator),opaque JSON。
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

ALTER TABLE `DataRecord` ADD CONSTRAINT `DataRecord_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
