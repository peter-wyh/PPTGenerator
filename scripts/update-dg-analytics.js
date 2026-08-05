const http = require('http');
const fs = require('fs');

const loginData = JSON.stringify({ email: 'admin@mediakit.local', password: 'admin123' });

function login() {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: 'localhost', port: 4000, path: '/api/v1/auth/login', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginData) } },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          const data = JSON.parse(body);
          if (!data.accessToken) return reject(new Error('No token: ' + body.substring(0, 200)));
          resolve(data.accessToken);
        });
      }
    );
    req.on('error', reject);
    req.write(loginData);
    req.end();
  });
}

async function main() {
  const token = await login();
  console.log('✅ Token acquired:', token.substring(0, 20) + '...');

  const analytics = fs.readFileSync(__dirname + '/dg-analytics.json', 'utf8');

  const resp = await new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: 'localhost', port: 4000, path: '/api/v1/campaigns/camp-motion-spring/analytics', method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token,
                   'Content-Length': Buffer.byteLength(analytics) } },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    req.write(analytics);
    req.end();
  });

  console.log('PUT status:', resp.status);
  console.log('PUT response:', resp.body.substring(0, 400));

  // Verify
  const verify = await new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: 'localhost', port: 4000, path: '/api/v1/campaigns/camp-motion-spring/analytics', method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token } },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    req.end();
  });

  const data = JSON.parse(verify.body);
  const a = data.analytics;
  console.log('\n✅ Verification:');
  console.log('  trend points:', a.trend?.length);
  console.log('  weeklyTrend points:', a.weeklyTrend?.length);
  console.log('  insights:', a.insights?.length);
  console.log('  topCategories:', a.topCategories?.length);
  console.log('  topProducts:', a.topProducts?.length);
  console.log('  topMarkets:', a.topMarkets?.length);
  console.log('  promotionOffers:', a.promotionOffers?.length);
  console.log('  newCustomers:', a.newCustomers);
  console.log('  aov:', a.aov);
  console.log('  customerSplit:', JSON.stringify(a.customerSplit));
}

main().catch((e) => console.error('❌ Error:', e.message));
