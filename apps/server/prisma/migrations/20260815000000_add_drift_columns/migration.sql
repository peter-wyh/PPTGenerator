-- 补录历史 db push 漂移列：Project.reportSchemeVersion / Template.htmlContent
-- 这两列此前只经 `prisma db push` 进入 dev 库，从未落正式 migration。
-- （Project.htmlContent 已由 20260805000000_html_template 覆盖，无需重复补录。）
-- 已有这些列的库（dev）用 `prisma migrate resolve --applied 20260815000000_add_drift_columns`
-- 标记为已应用；全新库由本迁移真正补列。

ALTER TABLE `Project` ADD COLUMN `reportSchemeVersion` VARCHAR(191) NULL;
ALTER TABLE `Template` ADD COLUMN `htmlContent` LONGTEXT NULL;
