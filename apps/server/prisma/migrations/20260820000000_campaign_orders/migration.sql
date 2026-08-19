-- 订单商品明细：支持 Top-Sales 商品排行(含 QTY 件数) 与购物篮结构分析。
-- 一行 OrderItem = 某订单下的一个商品行。订单头挂在 campaign（+可选达人归属）。
-- 订单真源在联盟平台；此处为导入快照，唯一键幂等：同 (campaign, orderId) 重导覆盖。

CREATE TABLE `CampaignOrder` (
    `id`                  VARCHAR(191) NOT NULL,
    `campaignId`          VARCHAR(191) NOT NULL,
    `campaignCreatorId`   VARCHAR(191) NULL,
    `orderId`             VARCHAR(191) NOT NULL,
    `orderDate`           DATETIME(3) NULL,
    `orderStatus`         VARCHAR(64) NULL,
    `createdAt`           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`           DATETIME(3) NOT NULL,

    UNIQUE INDEX `CampaignOrder_orderId_key`(`campaignId`, `orderId`),
    INDEX `CampaignOrder_campaignId_idx`(`campaignId`),
    INDEX `CampaignOrder_campaignCreatorId_idx`(`campaignCreatorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 商品行：一行 = 订单 × 商品。
CREATE TABLE `CampaignOrderItem` (
    `id`                  VARCHAR(191) NOT NULL,
    `campaignOrderId`        VARCHAR(191) NOT NULL,
    `productName`         VARCHAR(255) NOT NULL,
    `category`            VARCHAR(128) NULL,
    `sku`                 VARCHAR(128) NULL,
    `qty`                 INTEGER NOT NULL DEFAULT 1,
    `unitPrice`           DECIMAL(14,2) NOT NULL DEFAULT 0,
    `lineTotal`           DECIMAL(14,2) NOT NULL DEFAULT 0,
    `createdAt`          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CampaignOrderItem_campaignOrderId_idx`(`campaignOrderId`),
    INDEX `CampaignOrderItem_productName_idx`(`productName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- FK 由 Prisma relation 管理端到端（OnDelete: Cascade）。
ALTER TABLE `CampaignOrderItem` ADD CONSTRAINT `CampaignOrderItem_campaignOrderId_fkey`
    FOREIGN KEY (`campaignOrderId`) REFERENCES `CampaignOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
