// ---------------------------------------------------------------- buildings, shops, signs, tarps, people
const PEOPLE = [0x1b1f2a, 0x3b2a20, 0x5a1f2e, 0x1f3b4d, 0x4a4a4a, 0x6b4f1d].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
const UMBRELLA = new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.35, metalness: 0.1, side: THREE.DoubleSide });
const SKIN = new THREE.MeshStandardMaterial({ color: 0x6b4630, roughness: 0.7 });
function person(x, z, umbrella = R() < 0.75) {
  const i = Math.floor(R() * PEOPLE.length);
  const body = new THREE.CylinderGeometry(0.2, 0.24, 1.25, 7); body.translate(x, 0.22 + 0.62, z); addGeo('ppl' + i, PEOPLE[i], body);
  const head = new THREE.SphereGeometry(0.13, 8, 6); head.translate(x, 0.22 + 1.42, z); addGeo('skin', SKIN, head);
  if (umbrella) {
    const u = new THREE.ConeGeometry(0.62, 0.32, 10, 1, true); u.translate(x, 0.22 + 1.95, z); addGeo('umb', UMBRELLA, u);
    box(MAT.frame, 'frame', 0.03, 0.6, 0.03, x + 0.12, 0.22 + 1.55, z);
  }
}

function signBoard(s, x, y, z, w, h, cell, ry) {
  const g = new THREE.PlaneGeometry(w, h);
  atlasUV(g, cell);
  g.rotateY(ry);
  g.translate(x, y, z);
  addGeo('sign', SIGN_MAT, g);
}
const nextSign = () => { const c = signCursor; signCursor = (signCursor + 1) % 56; return c; };
const signCells = Array.from({ length: 56 }, (_, i) => i);
for (let i = signCells.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [signCells[i], signCells[j]] = [signCells[j], signCells[i]]; }
const takeSign = () => signCells[nextSign()];
let billboardCursor = 1;

function building(s, z0, bw) {
  const zc = z0 + bw / 2, rot = -s * Math.PI / 2;
  const tall = R() < 0.2;
  const floors = tall ? Math.floor(rand(9, 15)) : Math.floor(rand(2, 7));
  const bd = rand(12, 22), hU = floors * FLOOR_H, top = SHOP_H + hU;
  const fi = Math.floor(R() * FACADE_MATS.length);
  const up = new THREE.BoxGeometry(bd, hU, bw);
  const ou = Math.floor(R() * 4) * 0.25;
  faceScale(up, 0, bw / 12, hU / 12.8, ou); faceScale(up, 1, bw / 12, hU / 12.8, ou);
  faceScale(up, 4, bd / 12, hU / 12.8); faceScale(up, 5, bd / 12, hU / 12.8);
  setFaceUV(up, 2, 0.02, 0.5); setFaceUV(up, 3, 0.02, 0.5);
  up.translate(s * (FACE + bd / 2), SHOP_H + hU / 2, zc);
  addGeo('fac' + fi, FACADE_MATS[fi], up);
  box(MAT.concrete, 'concrete', bd - 0.9, SHOP_H, bw - 0.1, s * (FACE + 0.9 + (bd - 0.9) / 2), SHOP_H / 2, zc);
  box(MAT.ledge, 'ledge', 1.6, 0.26, bw + 0.08, s * (FACE + 0.2), SHOP_H - 0.1, zc);
  box(MAT.ledge, 'ledge', 0.5, 0.5, bw + 0.3, s * (FACE + 0.1), top + 0.25, zc);

  const nShops = Math.max(1, Math.round(bw / 5.2)), sw = bw / nShops;
  for (let k = 0; k < nShops; k++) {
    const sz = z0 + sw * (k + 0.5);
    const mi = Math.floor(R() * SHOPFRONT_MATS.length);
    plane(SHOPFRONT_MATS[mi], 'shop' + mi, sw - 0.45, SHOP_H - 0.62, s * (FACE + 0.88), 0.22 + (SHOP_H - 0.62) / 2, sz, rot);
    box(MAT.ledge, 'ledge', 0.9, SHOP_H, 0.36, s * (FACE + 0.45), SHOP_H / 2, z0 + sw * k + 0.18);
    const open = SHOPFRONT_MATS[mi].emissiveIntensity > 0.5;
    if (open) decal(s * (FACE - 1.3), 0.235, sz, 3.4, sw + 1.5, '#ffd9a0', 0.32);
    const cell = takeSign();
    const w = Math.min(sw - 0.5, 4.6), h = Math.max(0.8, w / 4);
    signBoard(s, s * (FACE - 0.62), SHOP_H + 0.08 + h / 2, sz, w, h, cell, rot);
    decal(s * (FACE - 1.0), 0.236, sz, 2.6, w + 1.5, signColors[cell], 0.2);
    if (R() < 0.42) {
      const zA = sz - sw / 2 + 0.15, zB = sz + sw / 2 - 0.15, xi = s * (FACE - 0.6), xo = s * (RH + 0.85);
      const ti = Math.floor(R() * TARPS.length);
      quad(TARPS[ti], 'tarp' + ti, [xi, SHOP_H - 0.35, zA], [xi, SHOP_H - 0.35, zB], [xo, 2.45, zB], [xo, 2.45, zA]);
      box(MAT.trunk, 'trunk', 0.07, 2.25, 0.07, xo, 1.33, zA + 0.1);
      box(MAT.trunk, 'trunk', 0.07, 2.25, 0.07, xo, 1.33, zB - 0.1);
    }
    if (R() < 0.5) person(s * rand(RH + 1.0, FACE - 0.6), sz + rand(-1.5, 1.5));
  }

  // projecting signs seen head-on by traffic
  if (R() < 0.45) {
    const cell = takeSign(), y = SHOP_H + 1.7 + Math.floor(rand(0, Math.min(floors, 4))) * FLOOR_H;
    const x = s * (FACE - 1.85), z = z0 + 0.7;
    signBoard(s, x, y, z - 0.06, 3.4, 0.85, cell, Math.PI);
    signBoard(s, x, y, z + 0.06, 3.4, 0.85, cell, 0);
    box(MAT.frame, 'frame', 3.6, 0.08, 0.1, x, y + 0.48, z);
    box(MAT.frame, 'frame', 3.6, 0.08, 0.1, x, y - 0.48, z);
    sglow(signColors[cell], 5, x, y, z, 0.16);
  }

  // rooftop clutter: black water tanks, billboards, aviation lights
  for (let t = 0, n = Math.floor(rand(0, 3)); t < n; t++) {
    const tank = new THREE.CylinderGeometry(0.85, 0.85, 1.6, 12);
    tank.translate(s * (FACE + rand(3, bd - 2)), top + 0.8, z0 + rand(1.5, bw - 1.5));
    addGeo('tank', MAT.tank, tank);
  }
  if (floors >= 4 && R() < 0.22) {
    const cell = 56 + billboardCursor, bwid = Math.min(12, bw + 2);
    billboardCursor = billboardCursor % 5 + 1;
    const x = s * (FACE + 3.5), y = top + 1.2 + bwid / 8, z = zc;
    signBoard(s, x, y, z, bwid, bwid / 4, cell, Math.PI + s * 0.5);
    box(MAT.frame, 'frame', 0.25, 1.4, 0.25, x, top + 0.7, z - bwid * 0.3);
    box(MAT.frame, 'frame', 0.25, 1.4, 0.25, x, top + 0.7, z + bwid * 0.3);
    sglow('#ffffff', 2.2, x - s * 1.2, y + bwid / 8 + 0.3, z - bwid * 0.42, 0.7);
  }
  if (floors >= 9) sglow('#ff2020', 1.6, s * (FACE + 0.6), top + 0.7, z0 + 0.6, 1.3);
}

for (const [a, b] of SEGS) for (const s of [1, -1]) {
  let z = a;
  while (z < b - 3) {
    let bw = rand(8, 19);
    if (b - z - bw < 6) bw = b - z;
    building(s, z, bw - 0.25);
    if (R() < 0.18 && z + bw < b - 2) {
      // a rain tree in the gap
      const tz = z + bw, tx = s * (RH + 1.3);
      box(MAT.trunk, 'trunk', 0.42, 5.2, 0.42, tx, 2.6, tz);
      for (let k = 0; k < 6; k++) {
        const g = new THREE.IcosahedronGeometry(rand(1.6, 2.6), 0);
        g.translate(tx + s * rand(-0.5, 2.2), rand(5.4, 7.6), tz + rand(-2.4, 2.4));
        addGeo('leaf', MAT.leaf, g);
      }
    }
    if (R() < 0.35) {
      // vada pav / chai cart with a naked bulb
      const cz = z + rand(2, bw - 2), cx = s * (RH + 1.25);
      box(MAT.frame, 'frame', 1.1, 0.9, 2.0, cx, 0.22 + 0.62, cz);
      box(MAT.ledge, 'ledge', 1.2, 0.08, 2.1, cx, 0.22 + 1.1, cz);
      const ti = Math.floor(R() * TARPS.length);
      quad(TARPS[ti], 'tarp' + ti, [cx - 0.9, 2.5, cz - 1.3], [cx - 0.9, 2.5, cz + 1.3], [cx + 0.9, 2.2, cz + 1.3], [cx + 0.9, 2.2, cz - 1.3]);
      sglow('#ffd27a', 2.6, cx, 2.0, cz, 1.25);
      sglow('#fff6e0', 0.5, cx, 2.0, cz, 2.0);
      decal(cx, 0.24, cz, 5, 5, '#ffc470', 0.5);
      decal(cx - s * 1.8, 0.02, cz, 3.0, 5, '#ffb050', 0.22);
      person(cx + s * 0.2, cz + 1.6, false);
      if (R() < 0.6) person(cx - s * 0.9, cz - 1.4);
    }
    z += bw;
  }
}

// ---------------------------------------------------------------- foot overbridge with the hero hoarding
let FOB_Z = 470;
function buildFOB(z) {
  FOB_Z = z;
  const span = 2 * FACE + 6;
  box(MAT.concrete, 'concrete', span, 0.9, 3.4, 0, 6.55, FOB_Z);
  box(MAT.ledge, 'ledge', span, 0.18, 4.2, 0, 9.9, FOB_Z);
  for (const x of [-(RH + 1.6), 0, RH + 1.6]) box(MAT.ledge, 'ledge', 0.55, 6.1, 0.55, x, 3.05, FOB_Z);
  for (const x of [-span / 2 + 0.2, span / 2 - 0.2]) for (const dz of [-1.9, 1.9]) box(MAT.pole, 'pole', 0.12, 3.0, 0.12, x, 8.5, FOB_Z + dz);
  signBoard(1, 0, 8.25, FOB_Z - 1.76, 15, 3.75, 56, Math.PI);
  signBoard(1, 0, 8.25, FOB_Z + 1.76, 15, 3.75, 59, 0);
  for (const x of [-6, -2, 2, 6]) {
    sglow('#fff4e0', 1.6, x, 10.35, FOB_Z - 2.1, 1.3);
    sglow('#fff4e0', 1.6, x, 10.35, FOB_Z + 2.1, 1.0);
  }
  sglow('#ff7a1a', 16, 0, 8.25, FOB_Z - 2.2, 0.13);
  for (const s of [1, -1]) {
    const g = new THREE.BoxGeometry(1.7, 0.3, 12.5);
    g.rotateX(Math.atan2(6.1, 12));
    g.translate(s * (RH + SW / 2 + 0.15), 3.15, FOB_Z + 7.7);
    addGeo('concrete', MAT.concrete, g);
  }
  decal(0, 0.02, FOB_Z - 4, 2 * RH, 8, '#ff7a1a', 0.12);
}

// ---------------------------------------------------------------- background towers (skip the cross street corridors)
for (const s of [1, -1]) {
  let z = 0;
  while (z < LEN) {
    const w = rand(16, 34);
    if (!CROSS.some((c) => z < c + CW + 3 && z + w > c - CW - 3)) {
      const h = rand(22, 90), d = rand(14, 30), x = s * (FACE + 25 + rand(0, 45));
      const fi = Math.floor(R() * FACADE_MATS.length);
      const g = new THREE.BoxGeometry(d, h, w * 0.85);
      for (const f of [0, 1]) faceScale(g, f, w * 0.85 / 12, h / 12.8);
      for (const f of [4, 5]) faceScale(g, f, d / 12, h / 12.8);
      setFaceUV(g, 2, 0.02, 0.5); setFaceUV(g, 3, 0.02, 0.5);
      g.translate(x, h / 2, z + w / 2);
      addGeo('fac' + fi, FACADE_MATS[fi], g);
      if (h > 55) sglow('#ff2020', 2.6, x, h + 0.6, z + w / 2, 1.4);
    }
    z += w;
  }
}
for (const c of CROSS) for (const s of [1, -1]) {
  const fi = Math.floor(R() * FACADE_MATS.length);
  const g = new THREE.BoxGeometry(20, 60, 40);
  faceScale(g, 0, 40 / 12, 60 / 12.8); faceScale(g, 1, 40 / 12, 60 / 12.8);
  g.translate(s * 160, 30, c);
  addGeo('fac' + fi, FACADE_MATS[fi], g);
}

// ---------------------------------------------------------------- sagging overhead cables
{
  const pts = [];
  for (let i = 0; i < 90; i++) {
    const z0 = rand(0, LEN), z1 = z0 + rand(-7, 7), y0 = rand(5.5, 11), y1 = rand(5.5, 11), sag = rand(0.6, 2.2);
    const s = R() < 0.5 ? 1 : -1;
    const along = R() < 0.3;
    const xa = s * (FACE - 0.1), xb = along ? xa : -xa, zb = along ? z0 + rand(8, 20) : z1;
    let prev = null;
    for (let k = 0; k <= 14; k++) {
      const u = k / 14;
      const p = [lerp(xa, xb, u), lerp(y0, y1, u) - sag * 4 * u * (1 - u), lerp(z0, zb, u)];
      if (prev) pts.push(...prev, ...p);
      prev = p;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  city.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x050505 })));
}

// The street repeats every LEN metres; a second copy keeps the horizon full while driving forever.
let city2 = null;
function finalizeCity() {
  flushBuckets(city);
  flushDecals(city);
  staticGlow.update();
  city2 = city.clone();
  scene.add(city2);
}
function placeCity(z) {
  const base = Math.floor(z / LEN) * LEN;
  city.position.z = base;
  city2.position.z = z - base > LEN / 2 ? base + LEN : base - LEN;
}
