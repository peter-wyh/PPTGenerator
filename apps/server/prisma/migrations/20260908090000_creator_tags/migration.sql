-- 0908 达人 tags 落库：导入 CSV tags 列（分号分隔数组）此前被服务端丢弃，前端 Creator 类型早有 tags?: string[] 字段但无存储。
ALTER TABLE `Creator` ADD COLUMN `tags` JSON NULL AFTER `profileUrl`;
