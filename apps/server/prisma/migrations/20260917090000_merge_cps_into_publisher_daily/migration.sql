-- 0917 主统计表统一：PublisherDailyStat 升级为唯一日统计主表（媒体维度），
-- 达人 CPS 视图 = 主表按合作行切片（子表）。CreatorCpsDailyStat 退役（数据可由重算再生）。
-- 粒度从 (campaign, publisher, date) 细化为 (campaign, publisher, collab, date)：
--   cc 为空 = 纯媒体行（无合作挂载）；cc 非空 = 合作行切片。
-- 媒体视图 = GROUP BY (publisher, date)；CPS 视图 = WHERE campaignCreatorId 非空。

-- 可移植性补丁（0920）：CreatorCpsDailyStat 当年经 db push 临时建表、从未进迁移链，
-- 全新库（如 mediakit_test 线性重放）无此表会 1146。已应用过本迁移的库不受影响
-- （表存在则 IF NOT EXISTS 跳过；表不存在则建空桩，下方 INSERT...SELECT 自然 0 行，DROP 照常）。
CREATE TABLE IF NOT EXISTS `CreatorCpsDailyStat` (
  `id` VARCHAR(191) NOT NULL,
  `campaignId` VARCHAR(191) NOT NULL,
  `campaignCreatorId` VARCHAR(191) NULL,
  `statDate` DATETIME(3) NOT NULL,
  `clicks` INT NOT NULL DEFAULT 0,
  `impressions` INT NOT NULL DEFAULT 0,
  `orders` INT NOT NULL DEFAULT 0,
  `gmv` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `commission` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `newCustomerOrders` INT NOT NULL DEFAULT 0,
  `recomputedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PublisherDailyStat`
  ADD COLUMN `campaignCreatorId` VARCHAR(191) NULL,
  ADD COLUMN `newCustomerOrders` INT NOT NULL DEFAULT 0,
  ADD INDEX `PublisherDailyStat_campaignCreatorId_idx` (`campaignCreatorId`),
  ADD UNIQUE KEY `PublisherDailyStat_campaign_publisher_creator_date_key` (`campaignId`, `publisherId`, `campaignCreatorId`, `statDate`),
  DROP INDEX `PublisherDailyStat_campaignId_publisherId_statDate_key`;

-- 历史数据迁移：旧 CPS 行按 (campaign, cc, date) 语义并入主表。
-- 主表原有的纯媒体行先清空 campaignCreatorId=NULL 标记，再按合作行逐条并入。
INSERT INTO `PublisherDailyStat` (`id`, `campaignId`, `publisherId`, `campaignCreatorId`, `statDate`, `clicks`, `impressions`, `orders`, `gmv`, `commission`, `newCustomerOrders`, `recomputedAt`)
SELECT
  CONCAT('mig', old.id),
  old.campaignId,
  -- 切片挂载：该合作行 1:1 链接的媒体（无链接则不可切片，丢弃到 dropped 语义——重算会再生）
  COALESCE(lp.publisherId, (SELECT lp2.publisherId FROM LinkPerformance lp2 WHERE lp2.campaignCreatorId = old.campaignCreatorId LIMIT 1)),
  old.campaignCreatorId,
  old.statDate, old.clicks, old.impressions, old.orders, old.gmv, old.commission, old.newCustomerOrders, old.recomputedAt
FROM CreatorCpsDailyStat old
LEFT JOIN LinkPerformance lp ON lp.campaignCreatorId = old.campaignCreatorId
WHERE COALESCE(lp.publisherId, (SELECT lp2.publisherId FROM LinkPerformance lp2 WHERE lp2.campaignCreatorId = old.campaignCreatorId LIMIT 1)) IS NOT NULL;

-- 并入后旧表退役
DROP TABLE `CreatorCpsDailyStat`;
