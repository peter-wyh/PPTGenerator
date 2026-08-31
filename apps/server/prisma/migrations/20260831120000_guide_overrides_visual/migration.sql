-- DM Deck 视觉还原修复(2026-08-31):Guide 加 overridesVisual——
-- 结构指南声明自带全套视觉规范时,生成时跳过 LAYER 1(业务线白色规范)注入,由该指南完全接管视觉。
-- 解决:DM Performance Deck 指南(深色票根风)被 30K 白色设计系统淹没,AI 产出白底橙风格。
ALTER TABLE `Guide` ADD COLUMN `overridesVisual` BOOLEAN NOT NULL DEFAULT false;
