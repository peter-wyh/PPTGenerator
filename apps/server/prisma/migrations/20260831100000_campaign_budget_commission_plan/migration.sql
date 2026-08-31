-- DM Deck 数据缺口修复 #1/#2（2026-08-31，缺口分析报告 Obsidian/PPT Design/DM Deck数据指标缺口分析-20260831.md）：
-- #1 预算结构化：Campaign 加 budgetAmount/budgetCurrency（budget 字符串保留兼容）。
-- #2 佣金方案时间线：新表 CommissionPlan（campaign × 时段 × CPA/flat fee），
--    支撑 DM deck「调佣金→销量变化」叙事与月度 CPA 标签。

ALTER TABLE `Campaign`
    ADD COLUMN `budgetAmount` DECIMAL(14,2) NULL COMMENT '预算金额(结构化数值;与 budget 字符串并存)',
    ADD COLUMN `budgetCurrency` VARCHAR(8) NULL COMMENT '预算币种(ISO 4217)';

-- 佣金方案时间线（手写迁移：Prisma shadow DB 无权限，见 skill prisma-migration-drift-repair.md 铁律）
CREATE TABLE `CommissionPlan` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL COMMENT '方案名(如 Q1 冲量方案)',
    `startDate` VARCHAR(191) NOT NULL COMMENT '生效日(含,YYYY-MM-DD)',
    `endDate` VARCHAR(191) NULL COMMENT '失效日(含;null=至今有效',
    `cpaRate` DECIMAL(6,4) NULL COMMENT 'CPA 佣金率(小数,0.10=10%)',
    `flatFee` DECIMAL(14,2) NULL COMMENT '固定费用',
    `flatFeeFrequency` VARCHAR(191) NULL COMMENT '固定费用周期:monthly/one_time',
    `note` VARCHAR(191) NULL COMMENT '备注(调价原因等)',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    INDEX `CommissionPlan_campaignId_idx` (`campaignId`),
    INDEX `CommissionPlan_campaignId_startDate_idx` (`campaignId`, `startDate`),
    CONSTRAINT `CommissionPlan_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
