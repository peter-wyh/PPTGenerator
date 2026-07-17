-- 达人库结构化表:补缺失的 stats 列 + 新增 profile 聚合列(bio/tags/contact/rate)。
ALTER TABLE `Creator` ADD COLUMN `stats` JSON NULL;
ALTER TABLE `Creator` ADD COLUMN `profile` JSON NULL;
