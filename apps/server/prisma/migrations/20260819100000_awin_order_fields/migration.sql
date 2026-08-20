-- CampaignOrder 全量镜像 Awin transactions 导出字段（43 列中的订单级 40 列）。
-- order_reference/date/commission_status 已映射 orderId/orderDate/orderStatus。
-- 本数据集（Trivago UK 2026-07 Lead）decline_reason/voucher 等列全空，但属 Awin
-- 标准导出，留位未来导出；镜像值保持原样（yes/no 等枚举不转 boolean）。

ALTER TABLE `CampaignOrder`
    ADD COLUMN `awinId`             VARCHAR(191) NULL,
    ADD COLUMN `advertiserId`       VARCHAR(191) NULL,
    ADD COLUMN `saleAmount`         DECIMAL(14,2) NULL,
    ADD COLUMN `commission`         DECIMAL(14,2) NULL,
    ADD COLUMN `validationDate`     DATETIME(3) NULL,
    ADD COLUMN `clickRef`           VARCHAR(191) NULL,
    ADD COLUMN `type`               VARCHAR(191) NULL,
    ADD COLUMN `siteName`           VARCHAR(191) NULL,
    ADD COLUMN `url`                TEXT NULL,
    ADD COLUMN `declineReason`      VARCHAR(191) NULL,
    ADD COLUMN `clickThroughTime`   DATETIME(3) NULL,
    ADD COLUMN `voucherCodeUsed`    VARCHAR(191) NULL,
    ADD COLUMN `lapseTime`          INTEGER NULL,
    ADD COLUMN `amended`            VARCHAR(191) NULL,
    ADD COLUMN `amendReason`        VARCHAR(191) NULL,
    ADD COLUMN `oldSaleAmount`      DECIMAL(14,2) NULL,
    ADD COLUMN `oldCommission`      DECIMAL(14,2) NULL,
    ADD COLUMN `differentCurrency`  VARCHAR(191) NULL,
    ADD COLUMN `clickDevice`        VARCHAR(191) NULL,
    ADD COLUMN `transactionDevice`  VARCHAR(191) NULL,
    ADD COLUMN `publisherUrl`       TEXT NULL,
    ADD COLUMN `transactionParts`   VARCHAR(191) NULL,
    ADD COLUMN `customerCountry`    VARCHAR(191) NULL,
    ADD COLUMN `customParameters`   TEXT NULL,
    ADD COLUMN `paidToPublisher`    VARCHAR(191) NULL,
    ADD COLUMN `paymentStatus`      VARCHAR(191) NULL,
    ADD COLUMN `paymentId`          VARCHAR(191) NULL,
    ADD COLUMN `transactionQueryId` VARCHAR(191) NULL,
    ADD COLUMN `clickRef2`          VARCHAR(191) NULL,
    ADD COLUMN `clickRef3`          VARCHAR(191) NULL,
    ADD COLUMN `clickRef4`          VARCHAR(191) NULL,
    ADD COLUMN `clickRef5`          VARCHAR(191) NULL,
    ADD COLUMN `clickRef6`          VARCHAR(191) NULL,
    ADD COLUMN `voucherCode`        VARCHAR(191) NULL,
    ADD COLUMN `commissionSharingPublisherId`              VARCHAR(191) NULL,
    ADD COLUMN `commissionSharingPublisher`                VARCHAR(191) NULL,
    ADD COLUMN `commissionSharingSelectedRatePublisherId` VARCHAR(191) NULL,
    ADD COLUMN `products`           TEXT NULL,
    ADD COLUMN `campaignLabel`      VARCHAR(191) NULL,
    ADD COLUMN `customerAcquisition` VARCHAR(191) NULL;

-- 订单页按 campaign 过滤 + orderDate 倒序翻页，补复合索引。
CREATE INDEX `CampaignOrder_campaignId_orderDate_idx` ON `CampaignOrder`(`campaignId`, `orderDate`);
