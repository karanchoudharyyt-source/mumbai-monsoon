// ---------------------------------------------------------------- facades
const WALLS = ['#8c8273', '#78868c', '#9d8b7b', '#6f7a88', '#a08b8a', '#7e8a76', '#8b7f99', '#9b9282', '#b0a48f', '#6d7f7a'];
const WIN_LIT = ['#ffcf8a', '#ffd9a8', '#e9f3ff', '#c4ffe4', '#ffc070', '#fff1c9'];
const CURTAINS = ['#c0392b', '#2e86c1', '#d4ac0d', '#7d3c98', '#1e8449', '#e67e22'];

function makeFacade() {
  const S = 512, cols = 4, rows = 4, cw = S / cols, ch = S / rows;
  const wall = pick(WALLS);
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    cells.push({
      r, c, lit: R() < 0.42, col: pick(WIN_LIT), curtain: R() < 0.5 ? pick(CURTAINS) : null,
      ac: R() < 0.35, bal: R() < 0.4, cut: rand(0.2, 0.8), tv: R() < 0.12,
    });
  }
  const rect = (k) => [k.c * cw + cw * 0.18, k.r * ch + ch * 0.22, cw * 0.64, ch * 0.52];
  const stains = Array.from({ length: 36 }, () => [rand(0, S), rand(4, 26), rand(0, S * 0.6)]);
  const map = canvasTex(S, S, (g) => {
    g.fillStyle = wall; g.fillRect(0, 0, S, S);
    for (const [x, w, y0] of stains) {
      const grd = g.createLinearGradient(0, y0, 0, S);
      grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(15,15,15,0.42)');
      g.fillStyle = grd; g.fillRect(x, 0, w, S);
    }
    g.fillStyle = 'rgba(0,0,0,0.28)';
    for (let r = 0; r < rows; r++) g.fillRect(0, r * ch + ch - 9, S, 9);
    for (const k of cells) {
      const [x, y, w, h] = rect(k);
      g.fillStyle = '#23262d'; g.fillRect(x - 5, y - 5, w + 10, h + 10);
      g.fillStyle = k.lit ? k.col : '#11151d'; g.fillRect(x, y, w, h);
      if (k.lit && k.curtain) { g.globalAlpha = 0.75; g.fillStyle = k.curtain; g.fillRect(x, y, w * k.cut, h); g.globalAlpha = 1; }
      if (k.lit && k.tv) { g.fillStyle = '#6fa8ff'; g.fillRect(x + w * 0.6, y + h * 0.35, w * 0.25, h * 0.3); }
      g.strokeStyle = 'rgba(25,25,25,0.95)'; g.lineWidth = 3;
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x + (w * i) / 4, y); g.lineTo(x + (w * i) / 4, y + h); g.stroke(); }
      g.beginPath(); g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); g.stroke();
      if (k.ac) { g.fillStyle = '#b5b8bc'; g.fillRect(x + w * 0.55, y + h + 7, w * 0.4, ch * 0.12); g.fillStyle = '#6c6c6c'; g.fillRect(x + w * 0.6, y + h + 11, w * 0.3, ch * 0.05); }
      if (k.bal) { g.strokeStyle = '#2f3033'; g.lineWidth = 4; g.strokeRect(x - 9, y + h * 0.6, w + 18, h * 0.4 + 7); }
    }
  });
  const emi = canvasTex(S, S, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
    for (const k of cells) {
      if (!k.lit) continue;
      const [x, y, w, h] = rect(k);
      g.fillStyle = k.col; g.fillRect(x, y, w, h);
      if (k.curtain) { g.globalAlpha = 0.6; g.fillStyle = '#000'; g.fillRect(x, y, w * k.cut, h); g.globalAlpha = 1; }
      g.strokeStyle = '#000'; g.lineWidth = 3;
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x + (w * i) / 4, y); g.lineTo(x + (w * i) / 4, y + h); g.stroke(); }
      g.beginPath(); g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); g.stroke();
    }
  });
  for (const t of [map, emi]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return new THREE.MeshStandardMaterial({ map, emissiveMap: emi, emissive: 0xffffff, emissiveIntensity: 1.7, roughness: 0.92 });
}
const FACADE_MATS = Array.from({ length: 10 }, makeFacade);

// ---------------------------------------------------------------- shopfronts
const PRODUCT = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#e67e22', '#9b59b6', '#ecf0f1', '#ff6fa8'];
function makeShopfront(kind) {
  const w = 512, h = 320;
  const tex = canvasTex(w, h, (g) => {
    if (kind === 'shutter' || kind === 'half') {
      g.fillStyle = '#4a4d52'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 9) { g.fillStyle = y % 18 ? '#5b5f65' : '#3c3f44'; g.fillRect(0, y, w, 4); }
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, h - 26, w, 26);
      if (kind === 'shutter') return;
    }
    const top = kind === 'half' ? h * 0.42 : 0;
    const warm = pick(['#ffe2b0', '#fff4dc', '#ffd59a', '#e8f7ff']);
    g.fillStyle = warm; g.fillRect(0, top, w, h - top);
    for (let row = 0; row < 4; row++) {
      const y = top + 18 + row * ((h - top - 90) / 4);
      if (y > h - 90) break;
      g.fillStyle = '#6b4a2c'; g.fillRect(10, y + 30, w - 20, 5);
      for (let x = 16; x < w - 26; x += rand(14, 30)) {
        g.fillStyle = pick(PRODUCT); g.fillRect(x, y + rand(4, 14), rand(9, 22), 30 - rand(0, 10));
      }
    }
    g.fillStyle = '#5a3b22'; g.fillRect(0, h - 70, w, 70);
    g.fillStyle = '#7a5532'; g.fillRect(0, h - 74, w, 8);
    if (R() < 0.7) {
      const px = rand(80, w - 120);
      g.fillStyle = '#2b2018';
      g.beginPath(); g.arc(px, h - 112, 17, 0, Math.PI * 2); g.fill();
      g.fillRect(px - 26, h - 94, 52, 40);
    }
    const bulb = g.createRadialGradient(w / 2, top + 10, 0, w / 2, top + 10, 140);
    bulb.addColorStop(0, 'rgba(255,255,255,0.9)'); bulb.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = bulb; g.fillRect(0, top, w, h - top);
  });
  return new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff,
    emissiveIntensity: kind === 'shutter' ? 0.08 : 1.15, roughness: 0.8,
  });
}
const SHOPFRONT_MATS = ['open', 'open', 'open', 'half', 'open', 'shutter', 'half', 'open'].map(makeShopfront);

// ---------------------------------------------------------------- sign atlas (4 x 16 cells of 512x128)
const SIGN_TEXT = [
  'CHAI • चाय', 'VADA PAV', 'SHREE GANESH STORES', 'IRANI CAFE', 'MOBILE REPAIR', 'MEDICAL • दवाखाना',
  'JUICE CENTRE', 'DOSA CORNER', 'LAXMI TAILORS', 'PAAN HOUSE', 'SAI ELECTRONICS', 'MITHAI • मिठाई',
  'HOTEL • होटल', 'PAV BHAJI', 'CYBER CAFE', 'NEW SAGAR LUNCH HOME', 'KHAU GALLI', 'FALOODA',
  'CUTTING CHAI', 'BOMBAY BAKERY', 'XEROX • PRINT', 'OPTICIANS', 'FRANKIE HOUSE', 'JAI HIND HARDWARE',
];
const BILLBOARDS = [
  { t: 'BUILT WITH DROID', bg: '#0b0b10', fg: '#ff7a1a' },
  { t: 'MONSOON SALE 50% OFF', bg: '#d81b60', fg: '#ffffff' },
  { t: 'CUTTING CHAI · ₹15', bg: '#ffd23d', fg: '#3a1d00' },
  { t: 'MUMBAI MERI JAAN', bg: '#101820', fg: '#3df2ff' },
  { t: 'RAIN? NO PROBLEM.', bg: '#1b5e20', fg: '#fff59d' },
  { t: 'VADA PAV KING', bg: '#e65100', fg: '#ffffff' },
];
const NEON = ['#ff3d7f', '#3df2ff', '#ffd23d', '#5cff7a', '#ff4a3d', '#ffffff', '#b46bff'];
const BOARD = [['#c62828', '#ffffff'], ['#1565c0', '#ffeb3b'], ['#2e7d32', '#ffffff'], ['#f9a825', '#3e2723'], ['#ad1457', '#ffffff'], ['#00838f', '#ffffff']];
const signColors = [];
const ATLAS = canvasTex(2048, 2048, (g) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, 2048, 2048);
  for (let i = 0; i < 64; i++) {
    const x = (i % 4) * 512, y = Math.floor(i / 4) * 128;
    const bb = i >= 56 ? BILLBOARDS[(i - 56) % BILLBOARDS.length] : null;
    const text = bb ? bb.t : SIGN_TEXT[i % SIGN_TEXT.length];
    let fg, bg, neon = !bb && R() < 0.45;
    if (bb) { bg = bb.bg; fg = bb.fg; } else if (neon) { bg = '#08080d'; fg = pick(NEON); } else { [bg, fg] = pick(BOARD); }
    signColors[i] = neon || bb ? fg : bg;
    g.fillStyle = bg; g.fillRect(x + 4, y + 4, 504, 120);
    let size = 64;
    g.font = `bold ${size}px ${FONT}`;
    while (g.measureText(text).width > 470 && size > 26) { size -= 2; g.font = `bold ${size}px ${FONT}`; }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (neon) { g.shadowColor = fg; g.shadowBlur = 22; }
    g.fillStyle = fg; g.fillText(text, x + 256, y + 66);
    g.shadowBlur = 0;
    if (!neon) { g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 4; g.strokeRect(x + 8, y + 8, 496, 112); }
  }
});
const SIGN_MAT = new THREE.MeshStandardMaterial({ map: ATLAS, emissiveMap: ATLAS, emissive: 0xffffff, emissiveIntensity: 2.2, roughness: 0.6 });
let signCursor = 0;
function atlasUV(geo, cell) {
  const u0 = (cell % 4) / 4, v1 = 1 - Math.floor(cell / 4) / 16;
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * 0.25, v1 - (1 - uv.getY(i)) / 16);
}

// ---------------------------------------------------------------- road, curb
const ROAD_ROUGH = canvasTex(256, 1024, (g, w, h) => {
  g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const x = rand(0, w), y = rand(0, h), r = rand(10, 46);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(18,18,18,0.95)'); grd.addColorStop(1, 'rgba(18,18,18,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  g.fillStyle = 'rgba(30,30,30,0.5)';
  for (const x of [40, 88, 168, 216]) g.fillRect(x, 0, 12, h);
}, false);
ROAD_ROUGH.wrapS = ROAD_ROUGH.wrapT = THREE.RepeatWrapping;
ROAD_ROUGH.repeat.set(1, LEN / 50);
const ROAD_MAT = new THREE.MeshStandardMaterial({ color: 0x0d0e12, roughness: 0.55, roughnessMap: ROAD_ROUGH, metalness: 0.55 });

const CURB_TEX = canvasTex(64, 8, (g) => { g.fillStyle = '#e8c200'; g.fillRect(0, 0, 32, 8); g.fillStyle = '#151515'; g.fillRect(32, 0, 32, 8); });
CURB_TEX.wrapS = CURB_TEX.wrapT = THREE.RepeatWrapping;

const MAT = {
  concrete: new THREE.MeshStandardMaterial({ color: 0x2b2a2a, roughness: 0.9 }),
  ledge: new THREE.MeshStandardMaterial({ color: 0x5d5a55, roughness: 0.85 }),
  walk: new THREE.MeshStandardMaterial({ color: 0x34363b, roughness: 0.35, metalness: 0.25 }),
  curb: new THREE.MeshStandardMaterial({ map: CURB_TEX, roughness: 0.6 }),
  mark: new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: 0.5, emissive: 0x2a2a2a }),
  pole: new THREE.MeshStandardMaterial({ color: 0x3c4046, roughness: 0.5, metalness: 0.6 }),
  lampHead: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffb15c, emissiveIntensity: 5 }),
  tank: new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.6 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.95 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x173a1f, roughness: 0.9, flatShading: true }),
  red: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff2020, emissiveIntensity: 6 }),
  frame: new THREE.MeshStandardMaterial({ color: 0x1f2124, roughness: 0.7, metalness: 0.5 }),
};
const TARPS = [0x1f5fbf, 0x2a7de1, 0x1a8f5a, 0xc0392b, 0xe0a100].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, side: THREE.DoubleSide }));
