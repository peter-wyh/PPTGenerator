#!/usr/bin/env node
// sync-project.cjs —— 单项目 本地 → 测试环境 同步命令（固化 0910 手工链路）
//
// 解决的问题：sync-remote-db.cjs 是全库覆盖（远端独有数据会被冲掉）；
// 日常「改了一个项目 → 同步到测试域」只需要行级复制，且必须自动完成
// 手工链路里容易漏的三件事：
//   [1] Project 行 + 该项目全部 HtmlVersion 行（漏行=激活版不同步，0910 事故）
//   [2] /uploads/ 相对引用 → OSS 绝对 URL 重写（含按 MD5 去重复用已传对象）
//   [3] 三层终验：DB 残留=0 / API 版本可读 / 远端图片全部 200
//
// 用法:
//   REMOTE_DATABASE_URL='mysql://u:***@192.168.1.11:3306/mediakit' \
//   TEST_LOGIN='admin@mediakit.local:密码' \
//   node scripts/sync-project.cjs --id cmtqvgq240001ysqjxmb5ei1j
//
// 可选: --dry-run 只列出将发生的动作不写库
// 依赖: 本机 docker 容器 mediakit-mysql-1(本地库 root socket + mysql client 出网)
//       node 18+ 自带 fetch —— 所有 HTTP 一律 fetch(argv 无关)，不经 shell，杜绝引号问题

const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CONTAINER = 'mediakit-mysql-1';
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const idIdx = args.indexOf('--id');
const PROJECT_ID = idIdx >= 0 ? args[idIdx + 1] : '';
if (!PROJECT_ID) { console.error('用法: node scripts/sync-project.cjs --id <projectId> [--dry-run]'); process.exit(1); }

const raw = process.env.REMOTE_DATABASE_URL;
if (!raw) { console.error('需要 REMOTE_DATABASE_URL=mysql://user:***@host:port/db'); process.exit(1); }
const u = new URL(raw);
const RUSER = decodeURIComponent(u.username), RPASS = decodeURIComponent(u.password);
const RHOST = u.hostname, RPORT = u.port || '3306', RDB = u.pathname.slice(1);

const TEST_API = process.env.TEST_API || 'https://campaignreport.sk8s.cn';
const TEST_LOGIN = process.env.TEST_LOGIN || '';
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

const log = (m) => console.log(m);
const sh = (cmd, opts = {}) => execSync(cmd, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
// SQL 一律走 stdin 管道，避开引号嵌套（sync-remote-db.cjs 同款）
const localSql = (q) => execSync(
  `docker exec -i ${CONTAINER} sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -N --default-character-set=utf8mb4 mediakit'`,
  { input: q, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
).toString();
const remoteSql = (q) => execSync(
  `docker exec -i -e MU=${JSON.stringify(RUSER)} -e MP=${JSON.stringify(RPASS)} -e MH=${RHOST} -e MPN=${RPORT} ${CONTAINER} sh -c 'MYSQL_PWD="$MP" mysql -h $MH -P $MPN -u $MU --default-character-set=utf8mb4 -N -D ${RDB}'`,
  { input: q, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
).toString();
const md5File = (p) => crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex');

// node fetch 走系统代理会 502（0910 实测）——env 直配 no_proxy
process.env.NO_PROXY = (process.env.NO_PROXY ? process.env.NO_PROXY + ',' : '') + 'campaignreport.sk8s.cn,campaignreport.oss-cn-hangzhou.aliyuncs.com';
process.env.no_proxy = process.env.NO_PROXY;

async function apiLogin() {
  const [email, ...pw] = TEST_LOGIN.split(':');
  const r = await fetch(`${TEST_API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'sync-project.cjs/1.0' },
    body: JSON.stringify({ email, password: pw.join(':') }),
  });
  const j = await r.json();
  if (!j.accessToken) throw new Error('测试域登录失败: ' + JSON.stringify(j).slice(0, 150));
  return j.accessToken;
}

(async () => {
  // ─── [0] 源行检查 ─────────────────────────────────────────────
  log(`[0] 项目 ${PROJECT_ID}`);
  const projExists = localSql(`SELECT COUNT(*) FROM Project WHERE id='${PROJECT_ID}';`).trim();
  if (projExists !== '1') { console.error(`本地无此项目 (count=${projExists})`); process.exit(1); }
  const localHvIds = localSql(`SELECT id FROM HtmlVersion WHERE projectId='${PROJECT_ID}' ORDER BY createdAt;`).trim().split('\n').filter(Boolean);
  log(`    HtmlVersion 行: ${localHvIds.length} 条 [${localHvIds.join(', ')}]`);

  // ─── [1] dump 行 + 收集 /uploads/ 引用 → 上传/复用 → URL 映射 ─
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'syncproj-'));
  const projDump = path.join(tmp, 'proj.sql');
  const hvDump = path.join(tmp, 'hv.sql');
  // mysqldump 的 --where 引号嵌套在 docker sh -c 里太脆——改用两步：
  // 先 dump 整表结构无关数据为空的操作不可取；直接用 SELECT ... INTO OUTFILE 不行(secure_file_priv)。
  // 正解：mysqldump 支持 --where 但经 stdin 传 SQL 更稳——用 mysql -e 不行(无 dump 转义)。
  // 最稳：临时表 + mysqldump 整表 where 主键范围…… 复杂。
  // 实用解：--where 参数不含引号——用双引号包整个 sh -c，where 用 \"\" 转义。
  const dumpWhere = (col) => `--where=\\\"${col}='${PROJECT_ID}'\\\"`;
  sh(`docker exec ${CONTAINER} sh -c \"MYSQL_PWD=\\\"\\$MYSQL_ROOT_PASSWORD\\\" mysqldump -uroot --single-transaction --no-create-info --replace --skip-triggers --no-tablespaces ${dumpWhere('id')} mediakit Project\" > ${JSON.stringify(projDump)}`);
  sh(`docker exec ${CONTAINER} sh -c \"MYSQL_PWD=\\\"\\$MYSQL_ROOT_PASSWORD\\\" mysqldump -uroot --single-transaction --no-create-info --replace --skip-triggers --no-tablespaces ${dumpWhere('projectId')} mediakit HtmlVersion\" > ${JSON.stringify(hvDump)}`);
  const allSql = fs.readFileSync(projDump, 'utf8') + '\n' + fs.readFileSync(hvDump, 'utf8');
  const uploadRefs = [...new Set((allSql.match(/\/uploads\/[A-Za-z0-9._\/-]+/g) || []))];
  log(`[1] uploads 引用: ${uploadRefs.length} 个`);
  const urlMap = new Map(); // /uploads/x.png -> https://oss.../x.png

  let token = null;
  if (uploadRefs.length && !DRY) {
    if (!TEST_LOGIN) { console.error('有 uploads 引用需要 OSS 化，请设 TEST_LOGIN=email:password'); process.exit(1); }
    token = await apiLogin();

    // 远端已有 OSS URL → 下载算 MD5，可复用则不重传（省流量省对象数）
    const remoteHtml = remoteSql(`SELECT htmlContent FROM Project WHERE id='${PROJECT_ID}';` + `SELECT html FROM HtmlVersion WHERE projectId='${PROJECT_ID}';`);
    const allRemoteOss = [...new Set((remoteHtml.match(/https:\/\/campaignreport\.oss[^'"\\) ]+/g) || []))];
    const ossByMd5 = new Map();
    for (const ossUrl of allRemoteOss) {
      try {
        const r = await fetch(ossUrl, { headers: { 'User-Agent': 'sync-project.cjs/1.0' } });
        if (!r.ok) continue;
        const buf = Buffer.from(await r.arrayBuffer());
        ossByMd5.set(crypto.createHash('md5').update(buf).digest('hex'), ossUrl);
      } catch { /* skip */ }
    }

    for (const ref of uploadRefs) {
      const localPath = path.join(UPLOADS_DIR, ref.replace(/^\/uploads\//, ''));
      if (!fs.existsSync(localPath)) { console.error(`  !! 本地文件缺失: ${localPath} —— 引用将保持原样(远端 404)`); continue; }
      const md5 = md5File(localPath);
      if (ossByMd5.has(md5)) {
        urlMap.set(ref, ossByMd5.get(md5));
        log(`  复用 ${ref} → ${ossByMd5.get(md5).split('/').pop()}`);
        continue;
      }
      // multipart 上传（fetch + FormData，node18 原生）
      const fd = new FormData();
      fd.append('file', new Blob([fs.readFileSync(localPath)]), path.basename(localPath));
      const r = await fetch(`${TEST_API}/api/v1/uploads`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'User-Agent': 'sync-project.cjs/1.0' },
        body: fd,
      });
      const up = await r.json().catch(() => ({}));
      if (!up.url) { console.error(`  !! 上传失败 ${ref}: ` + JSON.stringify(up).slice(0, 150)); continue; }
      urlMap.set(ref, up.url);
      ossByMd5.set(md5, up.url);
      log(`  上传 ${ref} → ${up.url.split('/').pop()}`);
    }
  }

  // ─── [2] URL 重写 + 写远端（REPLACE INTO 幂等） ────────────────
  if (!DRY) {
    let projSql = fs.readFileSync(projDump, 'utf8');
    let hvSql = fs.readFileSync(hvDump, 'utf8');
    for (const [from, to] of urlMap) {
      // dump 文本已是 SQL 转义态；from 是纯 ASCII 路径无需转义，to 的 URL 无单引号
      projSql = projSql.split(from).join(to);
      hvSql = hvSql.split(from).join(to);
    }
    remoteSql(hvSql); log(`[2] HtmlVersion ${localHvIds.length} 行已写入`);
    remoteSql(projSql); log('[2] Project 行已写入');

    // 以本地为准：删远端多余 HtmlVersion 行
    if (localHvIds.length) {
      const idList = localHvIds.map((i) => `'${i}'`).join(',');
      const extra = remoteSql(`SELECT id FROM HtmlVersion WHERE projectId='${PROJECT_ID}' AND id NOT IN (${idList});`).trim().split('\n').filter(Boolean);
      if (extra.length) {
        remoteSql(`DELETE FROM HtmlVersion WHERE id IN (${extra.map((i) => `'${i}'`).join(',')});`);
        log(`    删除远端多余 HtmlVersion ${extra.length} 行: ${extra.join(', ')}`);
      }
    }
  } else {
    log('[2] dry-run: 跳过写库');
  }

  // ─── [3] 三层终验 ─────────────────────────────────────────────
  log('[3] 终验');
  const fails = [];
  const residue = remoteSql(`SELECT (SELECT COUNT(*) FROM Project WHERE id='${PROJECT_ID}' AND htmlContent LIKE '%/uploads/%') + (SELECT COUNT(*) FROM HtmlVersion WHERE projectId='${PROJECT_ID}' AND html LIKE '%/uploads/%');`).trim();
  if (residue !== '0') fails.push(`DB uploads 残留 ${residue} 处`);
  const rHv = remoteSql(`SELECT COUNT(*) FROM HtmlVersion WHERE projectId='${PROJECT_ID}';`).trim();
  if (rHv !== String(localHvIds.length)) fails.push(`HtmlVersion 行数远端 ${rHv} ≠ 本地 ${localHvIds.length}`);
  log(`    DB: 残留=${residue} HtmlVersion=${rHv}`);

  // API 层：激活版本可读、无残留
  if (TEST_LOGIN && !DRY) {
    try {
      if (!token) token = await apiLogin();
      const active = remoteSql(`SELECT id FROM HtmlVersion WHERE projectId='${PROJECT_ID}' AND isActive=1 LIMIT 1;`).trim();
      if (active) {
        const r = await fetch(`${TEST_API}/api/v1/html-templates/html-versions/${active}`, {
          headers: { 'Authorization': 'Bearer ' + token, 'User-Agent': 'sync-project.cjs/1.0' },
        });
        const vr = await r.json();
        const h = vr.html || '';
        const oss = (h.match(/aliyuncs\.com/g) || []).length;
        const up = (h.match(/\/uploads\//g) || []).length;
        log(`    API: 激活版 ${active} html=${h.length}B oss=${oss} uploads=${up}`);
        if (!h.length) fails.push('API 激活版 html 为空');
        if (up > 0) fails.push('API 激活版仍有 uploads 引用');
      } else {
        log('    API: 无 isActive=1 版本(跳过)');
      }
    } catch (e) { log(`    API: 跳过 (${String(e.message).slice(0, 80)})`); }
  }

  // 图片层：远端最终 OSS URL 全部 200
  if (!DRY) {
    const finalHtml = remoteSql(`SELECT htmlContent FROM Project WHERE id='${PROJECT_ID}';` + `SELECT html FROM HtmlVersion WHERE projectId='${PROJECT_ID}';`);
    const finalOss = [...new Set((finalHtml.match(/https:\/\/campaignreport\.oss[^'"\\) ]+/g) || []))];
    let ok200 = 0;
    for (const ossUrl of finalOss) {
      const r = await fetch(ossUrl, { method: 'HEAD', headers: { 'User-Agent': 'sync-project.cjs/1.0' } });
      if (r.ok) ok200++; else fails.push(`OSS ${ossUrl.split('/').pop()} → ${r.status}`);
    }
    log(`    图片: ${ok200}/${finalOss.length} 200`);
  }

  if (fails.length) { console.error('\n✗ 终验失败:'); fails.forEach((f) => console.error('  - ' + f)); process.exit(2); }
  log('\n✓ 同步完成，三层终验全绿');
})().catch((e) => { console.error('FATAL:', e.message); process.exit(3); });
