-- OrderDailyStat + 设备维度：clickDevice 100% 有值（Awin transactions click_device 列），
-- 聚合进中间层补足报告设备分布维度（此前 43 列已镜像入库但未被任何聚合利用）。

ALTER TABLE `OrderDailyStat`
    ADD COLUMN `topDevices` JSON NULL;
