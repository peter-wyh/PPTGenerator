#!/usr/bin/env node
// sync-remote-db.cjs —— 本地主库 → 测试环境库(192.168.1.11:3306)
// 用法: REMOTE_DATABASE_URL='mysql://user:pass@192.168.1.11:3306/mediakit' node sync-remote-db.cjs [--no-backup]
//
// [1] 远端全量备份 → backups/remote_<db>_<ts>.sql.gz(可回滚)
// [2] 本地 mediakit 全量 dump(容器内 root socket:结构+数据+_prisma_migrations)
// [3] 灌入远端(dump 自带 DROP TABLE → 全覆盖,以本地为准)
// [4] 逐表行数对账
//
// 说明:
//   - _prisma_migrations 同步为本地干净状态(全部 applied)→ 远端 P3009 failed
//     记录被清掉,下次部署 migrate deploy 为 no-op,entrypoint 不再 exit 1
//   - 方向=以本地为准:远端独有数据(线上新建账号/项目)会被覆盖
const { execSync } = require('child_process');
const fs = require('fs');

const CONTAINER = 'mediakit-mysql-1';
const raw = process.env.REMOTE_DATABASE_URL;
if (!raw) { console.error('需要 REMOTE_DATABASE_URL=mysql://user:pass@host:port/db'); process.exit(1); }
const u = new URL(raw);
const RUSER = decodeURIComponent(u.username), RPASS = decodeURIComponent(u.password);
const RHOST = u.hostname, RPORT = u.port || '3306', RDB = u.pathname.slice(1);
const NO_BACKUP = process.argv.includes('--no-backup');
console.log(`目标: ${RUSER}@${RHOST}:${RPORT}/${RDB}${NO_BACKUP ? '(不备份!)' : ''}`);

const sh = (cmd, opts = {}) => execSync(cmd, { encoding: 'utf8', ...opts }).toString();
// SQL 一律走 stdin 管道,避开引号嵌套(与 sync-test-db.cjs 同款)
const localSql = (q) => execSync(
  `docker exec -i ${CONTAINER} sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -N --default-character-set=utf8mb4'`,
  { input: q, encoding: 'utf8' },
).trim();
const remoteSql = (q) => execSync(
  `docker exec -i -e MU=${JSON.stringify(RUSER)} -e MP=${JSON.stringify(RPASS)} -e MH=${RHOST} -e MPN=${RPORT} ${CONTAINER} sh -c 'MYSQL_PWD="$MP" mysql -h $MH -P $MPN -u $MU --default-character-set=utf8mb4 -N -D ${RDB}'`,
  { input: q, encoding: 'utf8' },
).trim();

// [1] 远端备份
if (!NO_BACKUP) {
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
  const out = `/Users/ap/Desktop/PPTGenerator/backups/remote_${RDB}_${ts}.sql.gz`;
  fs.mkdirSync('/Users/ap/Desktop/PPTGenerator/backups', { recursive: true });
  console.log(`[1/4] 备份远端 → ${out}`);
  execSync(
    `docker exec -e MU=${JSON.stringify(RUSER)} -e MP=${JSON.stringify(RPASS)} -e MH=${RHOST} -e MPN=${RPORT} ${CONTAINER} sh -c 'MYSQL_PWD="$MP" mysqldump -h $MH -P $MPN -u $MU --single-transaction --no-tablespaces --triggers --default-character-set=utf8mb4 ${RDB}' | gzip > ${JSON.stringify(out)}`,
    { stdio: 'inherit' },
  );
  console.log(`      大小: ${sh(`du -h ${JSON.stringify(out)} | cut -f1`).trim()}`);
}

// [2] 本地 dump
console.log('[2/4] dump 本地 mediakit(容器 root socket)');
execSync(
  `docker exec ${CONTAINER} sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --no-tablespaces --triggers --default-character-set=utf8mb4 mediakit' > /tmp/sync-remote.sql`,
  { stdio: 'inherit' },
);
console.log(`      ${sh(`grep -c '^CREATE TABLE' /tmp/sync-remote.sql`).trim()} 张表, ${sh('du -h /tmp/sync-remote.sql | cut -f1').trim()}`);

// [3] 灌入远端
console.log(`[3/4] 灌入远端 ${RDB}(DROP+CREATE+INSERT,以本地为准)`);
execSync(
  `docker exec -i -e MU=${JSON.stringify(RUSER)} -e MP=${JSON.stringify(RPASS)} -e MH=${RHOST} -e MPN=${RPORT} ${CONTAINER} sh -c 'MYSQL_PWD="$MP" mysql -h $MH -P $MPN -u $MU --default-character-set=utf8mb4 ${RDB}' < /tmp/sync-remote.sql`,
  { stdio: 'inherit' },
);
console.log('      完成');

// [4] 对账
console.log('[4/4] 逐表行数对账');
const tables = localSql(`SELECT table_name FROM information_schema.tables WHERE table_schema='mediakit' ORDER BY 1`)
  .split('\n').map((s) => s.trim()).filter(Boolean);
let fail = 0;
for (const t of tables) {
  const a = Number(localSql(`SELECT COUNT(*) FROM mediakit.\`${t}\``));
  const b = Number(remoteSql(`SELECT COUNT(*) FROM \`${t}\``));
  if (a === b) console.log(`  ✓ ${t}: ${a}`);
  else { console.log(`  ✗ ${t}: 本地=${a} 远端=${b}`); fail++; }
}
fs.rmSync('/tmp/sync-remote.sql', { force: true });
console.log(fail ? `⚠️ ${fail} 张表不一致` : '✅ 全部一致');
process.exit(fail ? 1 : 0);
