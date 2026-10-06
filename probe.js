// Scores candidate camera rigs for a time window by how often traffic blocks the view of the rickshaw.
// Usage: node probe.js front|low
const puppeteer = require('puppeteer-core');

(async () => {
  const which = process.argv[2] || 'front';
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true, protocolTimeout: 600000,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 640, height: 360 });
  await page.goto('http://127.0.0.1:8765/render.html?demo', { waitUntil: 'load' });
  await page.waitForFunction('window.ready === true', { timeout: 300000 });
  const res = await page.evaluate((which, tFix) => {
    const { P, traffic, restore, frames, TYPES } = window.dev;
    const H = { bus: 4.6, truck: 3.4 };
    const boxes = () => traffic.map((v) => ({ x0: v.x - TYPES[v.type].m.wid / 2, x1: v.x + TYPES[v.type].m.wid / 2, z0: v.z - TYPES[v.type].m.len / 2, z1: v.z + TYPES[v.type].m.len / 2, y1: H[v.type] || 1.7 }));
    const hit = (o, d, b, tmax) => {
      let t0 = 0, t1 = tmax;
      for (const [oo, dd, lo, hi] of [[o[0], d[0], b.x0, b.x1], [o[1], d[1], 0, b.y1], [o[2], d[2], b.z0, b.z1]]) {
        if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) return false; continue; }
        let a = (lo - oo) / dd, c = (hi - oo) / dd; if (a > c) [a, c] = [c, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return false;
      }
      return true;
    };
    const inside = (c, b) => c[0] > b.x0 - 0.35 && c[0] < b.x1 + 0.35 && c[2] > b.z0 - 0.35 && c[2] < b.z1 + 0.35 && c[1] < b.y1 + 0.2;
    // camera rig candidates
    const cands = [];
    if (which === 'front') {
      for (const s of [1, -1]) for (const D of [5.5, 6.5, 7.6, 9]) for (const h of [0.8, 1.4, 2.2]) for (const L of [0.5, 0.7, 0.9])
        for (const tB of (tFix ? [tFix] : [10, 10.4, 10.8, 11.2, 11.6, 12])) cands.push({ s, D, h, L, tB, len: 4.2 });
    } else {
      for (const back of [4.5, 5.5, 6.5, 8.5]) for (const up of [0.85, 1.3, 1.8]) for (const xo of [-0.8, -0.3, 0.3, 0.8])
        cands.push({ back, up, xo, tB: 15.4, len: 6.3 });
    }
    const out = [];
    for (const c of cands) {
      let bad = 0, n = 0, inn = 0;
      for (let t = c.tB; t < c.tB + c.len; t += 1 / 15) {
        const i = Math.round(t * 30); restore(frames[i]); const p = P(t), bx = boxes();
        let cam;
        if (which === 'front') { const u = (t - c.tB) / c.len; cam = [p.x + c.s * c.L, c.h, p.z + c.D - u * 1.2]; }
        else { cam = [p.cx - Math.sin(p.cyaw) * c.back + c.xo, c.up, p.z - Math.cos(p.cyaw) * c.back]; }
        if (bx.some((b) => inside(cam, b))) inn++;
        for (const [ox, oy] of [[0, 1.0], [0, 1.6], [0.5, 0.6], [-0.5, 0.6], [1.2, 1.0], [-1.2, 1.0]]) {
          const tgt = [p.x + ox, oy, p.z], d = tgt.map((v, k) => v - cam[k]), L = Math.hypot(...d);
          const dn = d.map((v) => v / L), w = Math.abs(ox) > 1 ? 0.3 : 1;
          if (bx.some((b) => hit(cam, dn, b, L - 1.5))) bad += w; n += w;
        }
      }
      out.push({ ...c, score: bad / n + inn * 0.2 });
    }
    out.sort((a, b) => a.score - b.score);
    return out.slice(0, tFix ? 80 : 12);
  }, which, Number(process.argv[3] || 0));
  for (const r of res) console.log(JSON.stringify(r));
  await browser.close();
})();
