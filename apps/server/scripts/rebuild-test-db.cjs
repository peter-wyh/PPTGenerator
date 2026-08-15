// 重建测试库：DROP + 全链 migrate deploy（14 个 migration 从零执行）
// 与 dev 库完全隔离（mediakit_test），global-setup.ts 已声明它是可 TRUNCATE 的一次性库
const mysql = require('mysql2/promise');
const fs = require('fs');
const { execSync } = require('child_process');

(async () => {
  const gs = fs.readFileSync('/Users/ap/Desktop/PPTGenerator/apps/server/tests/global-setup.ts', 'utf8');
  const url = gs.match(/mysql:\/\/[^'\s]+/)[0];
  const u = new URL(url);
  const dbName = u.pathname.slice(1);

  // root 权限来自 docker exec（global-setup 用 root 建库授权）
  const dropCreate = `DROP DATABASE IF EXISTS \`${dbName}\`; CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${decodeURIComponent(u.username)}'@'%';`;
  execSync(`docker exec -i mediakit-mysql-1 mysql -uroot -p${process.env.MYSQL_ROOT_PASSWORD || 'mediakit_root'}`, { input: dropCreate, stdio: ['pipe', 'inherit', 'inherit'] });
  console.log(`1/2 测试库 ${dbName} 已重建`);

  execSync('npx prisma migrate deploy', {
    cwd: '/Users/ap/Desktop/PPTGenerator/apps/server',
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
  console.log('2/2 14 个 migration 全链应用完成');
})();
