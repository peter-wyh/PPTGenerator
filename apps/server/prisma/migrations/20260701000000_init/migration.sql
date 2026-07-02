-- MediaKit init migration (MySQL 8)
-- 对应 prisma/schema.prisma

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

ALTER TABLE `Project` ADD CONSTRAINT `Project_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
