-- Agent 四维架构 S1(2026-09-03):指南升级为聚合根——Guide 加 activeRevision 指针 + GuideRevision 不可变版本表。
-- 每次保存 = 新 revision(正文+assets+checks+toolParams 同快照);回滚 = 切指针;"四个一致"落点。
-- 既有 Guide 行惰性回填:读取时无 revision 则以 content 建 v1(见 guide.service.ts ensureActiveRevision)。

CREATE TABLE `GuideRevision` (
    `id` VARCHAR(191) NOT NULL,
    `guideId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `content` LONGTEXT NOT NULL,
    `assets` JSON NOT NULL DEFAULT (JSON_ARRAY()),
    `checks` JSON NOT NULL DEFAULT (JSON_ARRAY()),
    `toolParams` JSON NOT NULL DEFAULT (JSON_OBJECT()),
    `changelog` LONGTEXT NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GuideRevision_guideId_createdAt_idx`(`guideId`, `createdAt`),
    UNIQUE INDEX `GuideRevision_guideId_version_key`(`guideId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Guide` ADD COLUMN `activeRevisionId` VARCHAR(191) NULL;

ALTER TABLE `GuideRevision`
    ADD FOREIGN KEY `GuideRevision_guideId_fkey` (`guideId`) REFERENCES `Guide`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Guide`
    ADD FOREIGN KEY `Guide_activeRevisionId_fkey` (`activeRevisionId`) REFERENCES `GuideRevision`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
