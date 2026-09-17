-- 0917 主统计表统一：PublisherDailyStat 升级为唯一日统计主表（媒体维度），
-- 达人 CPS 视图 = 主表按合作行切片（子表）。CreatorCpsDailyStat 退役（数据可由重算再生）。
-- 粒度从 (campaign, publisher, date) 细化为 (campaign, publisher, collab, date)：
--   cc 为空 = 纯媒体行（无合作挂载）；cc 非空 = 合作行切片。
-- 媒体视图 = GROUP BY (publisher, date)；CPS 视图 = WHERE campaignCreatorId 非空。

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
