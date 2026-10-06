// Smoke test for the playable build: phone landscape + portrait with touch, and desktop with keys.
// Usage: node touch-test.js [url]   (defaults to the local render.html)
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(browser, name, vp, url, act) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errs.push(m.text()); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errs.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', (r) => errs.push(`failed ${r.url()}`));
  await page.setViewport(vp);
  await page.goto(url, { waitUntil: 'load' });
  await sleep(2500);
  await page.screenshot({ path: `touch-shots/${name}-0.jpg`, type: 'jpeg', quality: 80 });
  await act(page);
  await page.screenshot({ path: `touch-shots/${name}-1.jpg`, type: 'jpeg', quality: 80 });
  console.log(name, 'errors:', JSON.stringify(errs));
  await page.close();
}
const center = (page, label) => page.evaluate((l) => {
  const b = [...document.querySelectorAll('.tb')].find((x) => x.textContent === l);
  const r = b.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}, label);

(async () => {
  fs.mkdirSync('touch-shots', { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true, protocolTimeout: 300000,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const base = process.argv[2] || 'http://127.0.0.1:8765/render.html';
  await run(browser, 'land', { width: 844, height: 390, isMobile: true, hasTouch: true }, base + '?touch', async (page) => {
    const gas = await center(page, 'GAS'), left = await center(page, '◀');
    await page.touchscreen.touchStart(gas.x, gas.y);
    await sleep(4000);
    console.log('land holding GAS, pressed classes:', await page.evaluate(() => [...document.querySelectorAll('.tb.on')].map((b) => b.textContent).join(',')));
    await page.touchscreen.touchEnd();
    await page.touchscreen.tap(left.x, left.y);
    console.log('land after release:', await page.evaluate(() => [...document.querySelectorAll('.tb.on')].map((b) => b.textContent).join(',') || 'none'));
  });
  await run(browser, 'port', { width: 390, height: 844, isMobile: true, hasTouch: true }, base + '?touch', async (page) => {
    const auto = await center(page, 'AUTO'), cam = await center(page, 'CAM');
    await page.touchscreen.tap(auto.x, auto.y);
    await page.touchscreen.tap(cam.x, cam.y);
    await sleep(4000);
    console.log('port on:', await page.evaluate(() => [...document.querySelectorAll('.tb.on')].map((b) => b.textContent).join(',')));
  });
  await run(browser, 'desk', { width: 1280, height: 720 }, base, async (page) => {
    console.log('desk touch buttons:', await page.evaluate(() => document.querySelectorAll('.tb').length), 'help:', await page.evaluate(() => !!document.getElementById('help')));
    await page.keyboard.down('KeyW');
    await sleep(4000);
    await page.keyboard.up('KeyW');
  });
  await browser.close();
})();
