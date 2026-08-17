-- User: 加 businessLineCode 列（业务线账号权限隔离）。
-- 语义: ADMIN 为 NULL = 不受限; USER 填 BusinessLine.code（如 'DG'）。
-- 注: 存量数据划归不在本 migration（依赖业务线账号先存在），
-- 见 prisma/seed-users.ts 的 reassignOwnersToBusinessLines()。
ALTER TABLE `User`
  ADD COLUMN `businessLineCode` VARCHAR(191) NULL;

CREATE INDEX `idx_user_business_line` ON `User` (`businessLineCode`);
