-- MediaKit share_token migration (MySQL 8)
-- Adds nullable unique shareToken to Project for public share links (M6).

ALTER TABLE `Project` ADD COLUMN `shareToken` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Project_shareToken_key` ON `Project`(`shareToken`);
