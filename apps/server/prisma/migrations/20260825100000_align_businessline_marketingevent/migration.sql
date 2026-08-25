-- 业务线/营销活动两表对齐营销系统源表（dm_union_business_lines / sales_activity）。
-- 字段命名/物理列名/类型/默认值与源 DDL 一致；保留本地 cuid 主键与报告侧扩展列
-- （BusinessLine.code/logo/color/designMd/designMdUrl/merchantId/createdAt/updatedAt）。
-- 存量数据搬迁（保数据，不丢行）：
--   BusinessLine: name → title；createdAt/updatedAt → create_time/update_time
--   MarketingEvent: startDate/endDate(varchar 日期) → start_time/end_time(datetime，末日记 23:59:59)；
--     description → info；createdAt/updatedAt → create_time/update_time；
--     advertiserId(经 Advertiser 间接挂) → business_line_id(直接挂业务线，按广告主所属业务线回填)

-- ── BusinessLine：新增源列 + name→title 搬迁 ─────────────────────────────
ALTER TABLE `BusinessLine`
    ADD COLUMN `title` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '名称',
    ADD COLUMN `director_id` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '负责人ids',
    ADD COLUMN `members` TEXT NULL COMMENT '负责成员ids',
    ADD COLUMN `extra` TEXT NULL COMMENT '额外信息',
    ADD COLUMN `creator_id` VARCHAR(191) NULL COMMENT '创建人ID(源dm_admin)',
    ADD COLUMN `updator_id` VARCHAR(191) NULL COMMENT '更新人ID(源dm_admin)',
    ADD COLUMN `create_time` DATETIME(3) NULL COMMENT '创建时间',
    ADD COLUMN `update_time` DATETIME(3) NULL COMMENT '更新时间',
    ADD COLUMN `delete_time` DATETIME(3) NULL COMMENT '删除时间(软删)',
    ADD COLUMN `status` TINYINT NOT NULL DEFAULT 1 COMMENT '业务线状态',
    ADD COLUMN `expert_work_mention` JSON NULL COMMENT '作品提及(字符串数组)',
    ADD COLUMN `expert_work_label` JSON NULL COMMENT '作品标签(字符串数组)',
    ADD COLUMN `company_ids` VARCHAR(500) NOT NULL DEFAULT '0' COMMENT '所属公司',
    ADD COLUMN `department_ids` VARCHAR(2000) NOT NULL DEFAULT '' COMMENT '部门ids',
    ADD COLUMN `specify_members` TEXT NULL COMMENT '指定成员',
    ADD COLUMN `cpt_withdraw` BOOLEAN NOT NULL DEFAULT false COMMENT 'cpt余额提现0否1是',
    ADD COLUMN `related_project` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '关联应用',
    ADD COLUMN `calendar_admin_ids` VARCHAR(1000) NOT NULL DEFAULT '' COMMENT '日历管理员ids';

UPDATE `BusinessLine` SET `title` = `name` WHERE `title` = '';
UPDATE `BusinessLine` SET `create_time` = `createdAt`, `update_time` = `updatedAt`;

ALTER TABLE `BusinessLine` DROP COLUMN `name`;

-- ── MarketingEvent：挂靠广告主→业务线 + 源字段对齐 ─────────────────────────
-- 删除 advertiserId 外键（仅存在于旧库——db push 时代残留；历史建表迁移未建过该 FK，全新库无此约束）。
-- MySQL 无 DROP FOREIGN KEY IF EXISTS，用 information_schema + 动态 SQL 实现两库通吃。
SET @me_adv_fk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'MarketingEvent'
    AND CONSTRAINT_NAME = 'MarketingEvent_advertiserId_fkey'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @me_adv_sql := IF(@me_adv_fk > 0,
  'ALTER TABLE `MarketingEvent` DROP FOREIGN KEY `MarketingEvent_advertiserId_fkey`',
  'SELECT ''fk not present, skip'' AS info');
PREPARE me_adv_stmt FROM @me_adv_sql;
EXECUTE me_adv_stmt;
DEALLOCATE PREPARE me_adv_stmt;
DROP INDEX `MarketingEvent_advertiserId_idx` ON `MarketingEvent`;
DROP INDEX `MarketingEvent_startDate_idx` ON `MarketingEvent`;

ALTER TABLE `MarketingEvent`
    ADD COLUMN `start_time` DATETIME(3) NOT NULL DEFAULT '1970-01-01 00:00:00' COMMENT '开始时间',
    ADD COLUMN `end_time` DATETIME(3) NOT NULL DEFAULT '1970-01-01 00:00:00' COMMENT '结束时间',
    ADD COLUMN `label` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '标识 1废弃',
    ADD COLUMN `type` TINYINT NOT NULL DEFAULT 0 COMMENT '类型 1节日 2活动日 3特别促销',
    ADD COLUMN `info` TEXT NULL COMMENT '简介',
    ADD COLUMN `continent` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '适用州',
    ADD COLUMN `region` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '适用地区',
    ADD COLUMN `level` TINYINT NOT NULL DEFAULT 0 COMMENT '平台评级 3高 2中 1低',
    ADD COLUMN `ads_id` VARCHAR(191) NOT NULL DEFAULT '0' COMMENT '申请人(源dm_admin)',
    ADD COLUMN `business_line_id` VARCHAR(191) NULL COMMENT '业务线id',
    ADD COLUMN `is_show_member` TINYINT NOT NULL DEFAULT 0 COMMENT '展示给流量主 1是 2否',
    ADD COLUMN `source` TINYINT NOT NULL DEFAULT 0 COMMENT '入库来源 1管理员录入 2邮件解析 3ai解析',
    ADD COLUMN `create_id` VARCHAR(191) NOT NULL DEFAULT '0' COMMENT '添加人id(源dm_admin)',
    ADD COLUMN `update_id` VARCHAR(255) NOT NULL DEFAULT '0' COMMENT '修改人id(源dm_admin)',
    ADD COLUMN `create_time` DATETIME(3) NOT NULL DEFAULT '1970-01-01 00:00:00' COMMENT '创建时间',
    ADD COLUMN `update_time` DATETIME(3) NOT NULL DEFAULT '1970-01-01 00:00:00' COMMENT '修改时间';

-- 存量回填：varchar 日期→datetime；description→info；时间戳平移
UPDATE `MarketingEvent` SET
    `start_time`  = COALESCE(STR_TO_DATE(`startDate`, '%Y-%m-%d'), '1970-01-01 00:00:00'),
    `end_time`    = COALESCE(STR_TO_DATE(CONCAT(`endDate`, ' 23:59:59'), '%Y-%m-%d %H:%i:%s'), '1970-01-01 00:00:00'),
    `info`        = `description`,
    `create_time` = `createdAt`,
    `update_time` = `updatedAt`;

-- 挂靠回填：广告主 → 其所属业务线
UPDATE `MarketingEvent` me
JOIN `Advertiser` a ON a.`id` = me.`advertiserId`
SET me.`business_line_id` = a.`businessLineId`
WHERE a.`businessLineId` IS NOT NULL;

ALTER TABLE `MarketingEvent`
    DROP COLUMN `advertiserId`,
    DROP COLUMN `description`,
    DROP COLUMN `startDate`,
    DROP COLUMN `endDate`,
    DROP COLUMN `createdAt`,
    DROP COLUMN `updatedAt`,
    MODIFY `name` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '活动名称';

CREATE INDEX `MarketingEvent_business_line_id_idx` ON `MarketingEvent`(`business_line_id`);
CREATE INDEX `MarketingEvent_start_time_idx` ON `MarketingEvent`(`start_time`);

ALTER TABLE `MarketingEvent` ADD CONSTRAINT `MarketingEvent_business_line_id_fkey`
    FOREIGN KEY (`business_line_id`) REFERENCES `BusinessLine`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
