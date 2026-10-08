const p = require('puppeteer');
(async () => {
  const pptr = p.default || p;
  const b = await pptr.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await b.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('file:///tmp/ft_shot/report.html', { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 1000));
  const r = await page.evaluate(() => {
    // 每张组图:可见高度 vs 完整高度,有无被裁
    const gals = Array.from(document.querySelectorAll('.pgal'));
    return gals.map(g => {
      const gr = g.getBoundingClientRect();
      const imgs = Array.from(g.querySelectorAll('img')).map(im => {
        const ir = im.getBoundingClientRect();
        return { w: Math.round(ir.width), h: Math.round(ir.height), topInGal: Math.round(ir.top - gr.top), clipped: ir.bottom > gr.bottom + 1 };
      });
      const cs = getComputedStyle(g.parentElement);
      return { galH: Math.round(gr.height), imgs, parentOverflow: cs.overflow, parentH: cs.height };
    });
  });
  console.log(JSON.stringify(r));
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
