-- DataRecord: 加 scopeCampaignId 普通列 + 复合索引,支持按 (kind, campaignId) 查 COLLABORATION。
-- SP1 of DataRecord 统一数据模型。详见 docs/superpowers/specs/2026-08-12-datarecord-unified-data-model-sp1-design.md
ALTER TABLE `DataRecord`
  ADD COLUMN `scopeCampaignId` VARCHAR(191) NULL;

CREATE INDEX `idx_data_kind_scope` ON `DataRecord` (`kind`, `scopeCampaignId`);

-- 回填既有 COLLABORATION 记录的 scopeCampaignId(当前 0 条,幂等,留作安全网)
UPDATE `DataRecord`
  SET `scopeCampaignId` = JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.campaignId'))
  WHERE `kind` = 'COLLABORATION';
