-- 项目元数据列（业务线/创建人/场景/广告主/campaign 信息），不透明 JSON，可空。
ALTER TABLE `Project` ADD COLUMN `meta` JSON NULL;
