-- 补充 unique 约束:Prisma 1:1 关系要求外键侧唯一(第一次部署后 schema 校验发现)。
ALTER TABLE `Guide` MODIFY COLUMN `activeRevisionId` VARCHAR(191) NULL,
    ADD UNIQUE INDEX `Guide_activeRevisionId_key`(`activeRevisionId`);
