-- CreateTable: HtmlTemplate
-- Phase 5: 独立 HTML 报告模板体系（与 PPT 模板 Template 分开管理）。
-- 含 {{placeholder}} 占位符的 HTML 文件，由 ADMIN 维护，用于一键生成 HTML 报告。
-- 对应 prisma/schema.prisma 的 HtmlTemplate 模型（status 复用 TemplateStatus 枚举）。

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

-- AddForeignKey: HtmlTemplate -> User
ALTER TABLE `HtmlTemplate` ADD CONSTRAINT `HtmlTemplate_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddColumn: Project.htmlContent
-- AI/模板生成的 HTML 报告内容（单文件，内联 CSS）；styleType='ai-html' 时使用。
ALTER TABLE `Project` ADD COLUMN `htmlContent` LONGTEXT NULL;
