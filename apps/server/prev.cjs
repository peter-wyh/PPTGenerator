/* 起静态服务 + 从 DB 实时导出报告:端口 8899 /report */
const http = require('http');
const fs = require('fs');
const path = require('path');
function loadEnv() {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/);
    if (m) { let v = m[1].trim().replace(/^["']|["']$/g, ''); if (/^[a-z]+:\/\//i.test(v)) return v; }
  }
  throw new Error('no DATABASE_URL');
}
const ROOT = '/tmp/ft_shot';
let HTML = null, TS = 0;

async function refresh() {
  const mysql = require('mysql2/promise');
  const u = new URL(loadEnv());
  const conn = await mysql.createConnection({ host: u.hostname, port: u.port || 3306, user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: u.pathname.replace(/^\//, '') });
  const [rows] = await conn.query("SELECT htmlContent FROM Project WHERE id='cmuc13qo7000h6cockqglovg5'");
  await conn.end();
  if (!rows.length || !rows[0].htmlContent) throw new Error('no htmlContent');
  let html = rows[0].htmlContent;
  // chart.js 用本地 vendor(离线可看);图片保持 OSS 绝对地址
  html = html.replace('src="/vendor/chartjs/chart.umd.min.js"', 'src="/vendor/chartjs/chart.umd.min.js"');
  fs.writeFileSync(ROOT + '/report.html', html);
  HTML = html; TS = Date.now();
  return html.length;
}

(async () => {
  await refresh();
  console.log('loaded report from DB:', HTML.length, 'bytes');
  const srv = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/report' || url === '/report.html' || url === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(HTML);
    } else if (url === '/refresh') {
      refresh().then(len => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('refreshed ' + len + ' bytes'); })
        .catch(e => { res.writeHead(500); res.end(String(e.message)); });
    } else {
      // 静态回退(vendor 等)
      const p = path.join(ROOT, path.normalize(url).replace(/^(\.\.[\/\\])+/, ''));
      if (p.startsWith(ROOT) && fs.existsSync(p) && fs.statSync(p).isFile()) {
        const ext = path.extname(p);
        const mime = ext === '.js' ? 'application/javascript' : ext === '.css' ? 'text/css' : 'application/octet-stream';
        res.writeHead(200, { 'content-type': mime });
        res.end(fs.readFileSync(p));
      } else { res.writeHead(404); res.end('nf'); }
    }
  });
  srv.listen(8899, '127.0.0.1', () => console.log('FT report preview: http://127.0.0.1:8899/report'));
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
