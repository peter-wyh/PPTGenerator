// 通用 schema-drift 补齐脚本：对比 schema.prisma 与目标数据库，只增列、永不删改。
// 用法：
//   node scripts/sync-drift-columns.mjs                    # 补齐（默认 dev 库，读 .env DATABASE_URL）
//   node scripts/sync-drift-columns.mjs --db mysql://user:pass@host:3306/dbname [--dry-run]
// 依据 apps/server/prisma/schema.prisma 解析 model/field/@map/@db.*，与 information_schema 对比后 ALTER ADD。

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(here, '../prisma/schema.prisma');

// ---------- CLI ----------
const argv = process.argv.slice(2);
const dbFlag = argv.indexOf('--db');
let targetUrl =
  dbFlag !== -1 ? argv[dbFlag + 1] : process.env.DATABASE_URL ?? null;
// 兜底：从 tests/global-setup.ts 提取默认测试库连接串，凭据不落命令行
if (!targetUrl) {
  try {
    const gs = readFileSync(resolve(here, '../tests/global-setup.ts'), 'utf8');
    targetUrl = gs.match(/mysql:\/\/[^'\s]+/)?.[0] ?? null;
  } catch { /* ignore */ }
}
const dryRun = argv.includes('--dry-run');
if (!targetUrl) {
  console.error('需要 --db <url> 或环境变量 DATABASE_URL');
  process.exit(1);
}

// ---------- 解析 schema.prisma ----------
const schema = readFileSync(schemaPath, 'utf8');
const TYPE_MAP = {
  String: (attr) =>
    attr.includes('@db.LongText') ? 'LONGTEXT' :
    attr.includes('@db.Text') ? 'TEXT' :
    attr.includes('@db.MediumText') ? 'MEDIUMTEXT' :
    `VARCHAR(${attr.match(/@db\.VarChar\((\d+)\)/)?.[1] ?? 191})`,
  Int: () => 'INT',
  BigInt: () => 'BIGINT',
  Float: () => 'DOUBLE',
  Decimal: (attr) => {
    const m = attr.match(/@db\.Decimal\((\d+),\s*(\d+)\)/);
    return m ? `DECIMAL(${m[1]},${m[2]})` : 'DECIMAL(65,30)';
  },
  Boolean: () => 'TINYINT(1)',
  DateTime: (attr) =>
    attr.includes('@db.Date') ? 'DATE' : 'DATETIME(3)',
  Json: () => 'JSON',
  Bytes: () => 'LONGBLOB',
};

const models = []; // { table, columns: [{ name, ddl, nullable }] }
const modelRe = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
let m;
while ((m = modelRe.exec(schema)) !== null) {
  const name = m[1];
  const body = m[2];
  const tableMap = body.match(/^@@map\("([^"]+)"\)/m)?.[1] ?? name;
  const columns = [];
  for (const line of body.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('@@') || t.startsWith('//')) continue;
    const fm = t.match(/^(\w+)\s+([\w\[\]]+)(.*)$/);
    if (!fm) continue;
    const [, field, typeRaw, attrRaw] = fm;
    const attr = attrRaw ?? '';
    if (attr.includes('@relation') || typeRaw.includes('[]')) continue; // 关系字段无列
    const baseType = typeRaw.replace(/\?$/, '');
    const mapper = TYPE_MAP[baseType];
    if (!mapper) continue; // 枚举/未知类型跳过（枚举列是 VARCHAR，Prisma 端枚举值不影响 DDL 对比列存在性）
    const colMap = attr.match(/@map\("([^"]+)"\)/)?.[1] ?? field;
    const nullable = typeRaw.endsWith('?') || attr.includes('@default') ? '' : 'NOT NULL';
    columns.push({ name: colMap, ddl: `${mapper(attr)} ${nullable}`.trim() });
  }
  models.push({ model: name, table: tableMap, columns });
}

// ---------- 对比并补列 ----------
const conn = await mysql.createConnection(targetUrl);
let added = 0;
try {
  for (const { model, table, columns } of models) {
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table],
    );
    if (cols.length === 0) {
      console.log(`SKIP  表不存在: ${table} (model ${model})`);
      continue;
    }
    const existing = new Set(cols.map((c) => c.COLUMN_NAME));
    for (const col of columns) {
      if (existing.has(col.name)) continue;
      const sql = `ALTER TABLE \`${table}\` ADD COLUMN \`${col.name}\` ${col.ddl}`;
      if (dryRun) {
        console.log(`DRY   ${sql}`);
      } else {
        await conn.query(sql);
        console.log(`ADD   ${sql}`);
        added++;
      }
    }
  }
  console.log(dryRun ? '完成（dry-run，未改动）' : `完成：补齐 ${added} 列`);
} finally {
  await conn.end();
}
