-- 数据记录类型新增 COLLABORATION（达人合作：合作方式 + 每种作品类型的截图/效果/画像/词云）。
ALTER TABLE `DataRecord` MODIFY COLUMN `kind` ENUM('CAMPAIGN', 'CREATOR', 'COLLABORATION') NOT NULL;
