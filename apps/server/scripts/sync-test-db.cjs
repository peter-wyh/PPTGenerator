#!/usr/bin/env node
// 用法：node sync-test-db.cjs [--from <db>] [--to <db>]
// 把 dev 主库 mysqldump 到容器内临时文件，再导入测试库（可重复执行，幂等）。
// 凭据不手拼：root 密码取容器 env，app 账号读根 .env——历史上手拼 mediakit/mediaket
// 两个拼写曾把“间歇 1049/1045”假象排查成“库在消失”，务必走程序化凭据。
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DOCKER = process.env.DOCKER_HOST ? `DOCKER_HOST=${process.env.DOCKER_HOST} ` : '';
const CONTAINER = 'mediakit-mysql-1';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const fromDb = flag('from', 'mediakit');
const toDb = flag('to', 'mediakit_test');

// app 账号从根 .env 读（与 docker-compose 建库一致）
const envPath = path.join(__dirname, '..', '..', '..', '.env');
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).toString();
}

// SQL 一律走 stdin 管道（docker exec -i），彻底避开 sh 单引号/双引号嵌套转义
function sql(query) {
  return execSync(
    `${DOCKER}docker exec -i ${CONTAINER} sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -N'`,
    { input: query, encoding: 'utf8' },
  ).trim();
}

const count = (db, table) => Number(sql(`SELECT COUNT(*) FROM \`${db}\`.${table}`));

console.log(`[1/5] dump ${fromDb}（容器内走 socket，绕开 TCP 抖动）`);
execSync(
  `${DOCKER}docker exec ${CONTAINER} sh -c 'MYSQL_PWD="\$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --no-tablespaces --triggers --default-character-set=utf8mb4 ${fromDb} > /tmp/sync-test-db.sql'`,
  { stdio: 'inherit' },
);
const marker = sh(
  `${DOCKER}docker exec ${CONTAINER} sh -c "grep -c '^CREATE TABLE' /tmp/sync-test-db.sql || true"`,
).trim();
console.log(`      dump 完成：${marker || '?'} 张表`);

console.log(`[2/5] 授权 ${env.MYSQL_USER} 访问 ${toDb}（若缺）`);
// SQL 走 stdin 管道传给 mysql，彻底避开三层引号嵌套转义（rebuild-test-db.cjs 同款模式）
execSync(
  `${DOCKER}docker exec -i ${CONTAINER} sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot'`,
  {
    input: `GRANT ALL PRIVILEGES ON \`${toDb}\`.* TO \`${env.MYSQL_USER}\`@\`%\`; FLUSH PRIVILEGES;\n`,
    stdio: ['pipe', 'inherit', 'inherit'],
  },
);

console.log(`[3/5] 导入 ${toDb}（dump 自带 DROP TABLE IF EXISTS，覆盖旧表）`);
execSync(
  `${DOCKER}docker exec ${CONTAINER} sh -c 'MYSQL_PWD="\$MYSQL_ROOT_PASSWORD" mysql -uroot ${toDb} < /tmp/sync-test-db.sql'`,
  { stdio: 'inherit' },
);

console.log(`[4/5] 对账 ${fromDb} → ${toDb}`);
const tables = sql(
  `SELECT table_name FROM information_schema.tables WHERE table_schema='${fromDb}' AND table_name NOT LIKE '_prisma%' ORDER BY table_name`,
)
  .split('\n')
  .filter(Boolean);
let mismatch = 0;
for (const t of tables) {
  const a = count(fromDb, t);
  const b = count(toDb, t);
  const ok = a === b ? '✓' : '✗';
  if (a !== b) mismatch++;
  console.log(`      ${ok} ${t}: ${a} → ${b}`);
}

console.log(`[5/5] app 账号连通性（宿主机 mysql2，与 vitest 同通道）`);
const mysql = require('mysql2/promise');
(async () => {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: Number(env.MYSQL_PORT || 3317),
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: toDb,
  });
  const [rows] = await conn.query(
    'SELECT (SELECT COUNT(*) FROM Campaign) campaigns, (SELECT COUNT(*) FROM CampaignOrder) orders',
  );
  console.log(`      OK:`, JSON.stringify(rows[0]));
  await conn.end();
  if (mismatch) {
    console.error(`\n${mismatch} 张表行数不一致！`);
    process.exit(1);
  }
  console.log(`\n完成：${fromDb} → ${toDb} 全部一致`);
})().catch((e) => {
  console.error(`app 账号连 ${toDb} 失败:`, e.code || e.message);
  process.exit(1);
});

execSync(`${DOCKER}docker exec ${CONTAINER} rm -f /tmp/sync-test-db.sql`);
