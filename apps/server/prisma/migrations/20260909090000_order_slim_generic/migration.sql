-- 0909 订单表瘦身 + 通用化（方案 A，用户定稿）
-- 消费审计：43 列中仅 9 列有真实消费方（cps-source/order-stats/报告 mapper/AI/归因链），
-- 其余 28 列仅在「导入写入→DTO→列表回显」管道存活。DROP 数据不可逆，但导入接口
-- 幂等可重放，无分析消费方 → 实际无损。
ALTER TABLE `CampaignOrder` DROP COLUMN `advertiserId`;
ALTER TABLE `CampaignOrder` DROP COLUMN `type`;
ALTER TABLE `CampaignOrder` DROP COLUMN `url`;
ALTER TABLE `CampaignOrder` DROP COLUMN `declineReason`;
ALTER TABLE `CampaignOrder` DROP COLUMN `clickThroughTime`;
ALTER TABLE `CampaignOrder` DROP COLUMN `voucherCodeUsed`;
ALTER TABLE `CampaignOrder` DROP COLUMN `lapseTime`;
ALTER TABLE `CampaignOrder` DROP COLUMN `amended`;
ALTER TABLE `CampaignOrder` DROP COLUMN `amendReason`;
ALTER TABLE `CampaignOrder` DROP COLUMN `oldSaleAmount`;
ALTER TABLE `CampaignOrder` DROP COLUMN `oldCommission`;
ALTER TABLE `CampaignOrder` DROP COLUMN `differentCurrency`;
ALTER TABLE `CampaignOrder` DROP COLUMN `transactionDevice`;
ALTER TABLE `CampaignOrder` DROP COLUMN `transactionParts`;
ALTER TABLE `CampaignOrder` DROP COLUMN `customParameters`;
ALTER TABLE `CampaignOrder` DROP COLUMN `paidToPublisher`;
ALTER TABLE `CampaignOrder` DROP COLUMN `paymentStatus`;
ALTER TABLE `CampaignOrder` DROP COLUMN `paymentId`;
ALTER TABLE `CampaignOrder` DROP COLUMN `transactionQueryId`;
ALTER TABLE `CampaignOrder` DROP COLUMN `clickRef2`;
ALTER TABLE `CampaignOrder` DROP COLUMN `clickRef3`;
ALTER TABLE `CampaignOrder` DROP COLUMN `clickRef4`;
ALTER TABLE `CampaignOrder` DROP COLUMN `clickRef5`;
ALTER TABLE `CampaignOrder` DROP COLUMN `clickRef6`;
ALTER TABLE `CampaignOrder` DROP COLUMN `voucherCode`;
ALTER TABLE `CampaignOrder` DROP COLUMN `commissionSharingPublisherId`;
ALTER TABLE `CampaignOrder` DROP COLUMN `commissionSharingPublisher`;
ALTER TABLE `CampaignOrder` DROP COLUMN `commissionSharingSelectedRatePublisherId`;
ALTER TABLE `CampaignOrder` DROP COLUMN `campaignLabel`;
-- 通用化：awinId → externalTxnId（平台中立），新增 source 标记来源平台
ALTER TABLE `CampaignOrder` CHANGE COLUMN `awinId` `externalTxnId` VARCHAR(191) NULL;
ALTER TABLE `CampaignOrder` ADD COLUMN `source` VARCHAR(191) NULL COMMENT '来源平台标识（awin/impact/...）' AFTER `customerAcquisition`;
