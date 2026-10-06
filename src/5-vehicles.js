// ---------------------------------------------------------------- vehicle models (vertex coloured, instanced per type)
const FLAT_MAT = new THREE.ShaderMaterial({
  uniforms: { map: { value: GLOW }, fogD: FOG_D },
  vertexShader: `attribute vec2 corner; attribute vec2 gsize; attribute vec3 gcol;
    uniform float fogD; varying vec2 vUv; varying vec3 vCol; varying float vFog;
    void main() {
      vec3 p = position + vec3(corner.x * gsize.x, 0.0, corner.y * gsize.y) * 0.5;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vUv = corner * 0.5 + 0.5; vCol = gcol;
      vFog = exp(-pow(-mv.z * fogD, 2.0));
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: GLOW_MAT.fragmentShader,
  blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
});
GlowBatch.prototype.put = function (r, g, b, sx, sy, x, y, z) {
  const i = this.n++;
  for (let v = 0; v < 4; v++) {
    const o = (i * 4 + v) * 3;
    this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z;
    this.col[o] = r; this.col[o + 1] = g; this.col[o + 2] = b;
    this.size[(i * 4 + v) * 2] = sx; this.size[(i * 4 + v) * 2 + 1] = sy;
  }
};
GlowBatch.prototype.reset = function () { this.n = 0; };
GlowBatch.prototype.commit = function () { this.geo.setDrawRange(0, this.n * 6); this.update(); };
const dynGlow = new GlowBatch(900);
scene.add(dynGlow.mesh);
const dynPool = new GlowBatch(400, FLAT_MAT);
dynPool.mesh.layers.set(1);
dynPool.mesh.renderOrder = 2;
scene.add(dynPool.mesh);

function vc(geo, color, k = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color).multiplyScalar(k), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
class Model {
  constructor(len, wid) { this.parts = { body: [], hood: [], glass: [], head: [], tail: [] }; this.heads = []; this.tails = []; this.len = len; this.wid = wid; }
  box(kind, color, sx, sy, sz, x, y, z, k = 1, rx = 0) {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    if (rx) g.rotateX(rx);
    g.translate(x, y, z);
    this.parts[kind].push(vc(g, color, k));
    return this;
  }
  cyl(kind, color, r, w, x, y, z, k = 1, axis = 'x') {
    const g = new THREE.CylinderGeometry(r, r, w, 14);
    if (axis === 'x') g.rotateZ(Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2);
    g.translate(x, y, z);
    this.parts[kind].push(vc(g, color, k));
    return this;
  }
  // half cylinder along z, flat side down: a rounded rickshaw hood of width w and rise h
  arc(kind, color, w, h, len, x, y, z) {
    const g = new THREE.CylinderGeometry(0.5, 0.5, len, 18, 1, false, Math.PI / 2, Math.PI);
    g.rotateX(Math.PI / 2); g.scale(w, h * 2, 1); g.translate(x, y, z);
    this.parts[kind].push(vc(g, color));
    return this;
  }
  limb(color, r, a, b) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
    const g = new THREE.CylinderGeometry(r, r * 0.9, d.length(), 8);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
    this.parts.body.push(vc(g, color));
    return this;
  }
  sph(color, r, x, y, z) { const g = new THREE.SphereGeometry(r, 10, 8); g.translate(x, y, z); this.parts.body.push(vc(g, color)); return this; }
  wheel(x, y, z, r, w) { return this.cyl('body', 0x090909, r, w, x, y, z).cyl('body', 0x7a7a7a, r * 0.45, w + 0.02, x, y, z); }
  head(x, y, z, s = 1) { this.heads.push([x, y, z, s]); return this; }
  tail(x, y, z, s = 1) { this.tails.push([x, y, z, s]); return this; }
  build() {
    const out = {};
    for (const [k, v] of Object.entries(this.parts)) if (v.length) out[k] = mergeGeometries(v);
    return out;
  }
}
const GLASS = 0x0e1824;
function autoModel() {
  const BLK = 0x111214, YEL = 0xffc21a, SEAT = 0x3a2416, KHAKI = 0x9c8a5a, SKIN = 0x6a4430;
  const m = new Model(2.7, 1.35)
    // chassis, engine body under the rear seat, lower side panels with a yellow pinstripe
    .box('body', BLK, 1.2, 0.2, 2.3, 0, 0.42, -0.08)
    .box('body', BLK, 1.28, 0.62, 0.6, 0, 0.66, -0.98)
    .box('body', BLK, 0.05, 0.4, 1.05, 0.62, 0.74, -0.2)
    .box('body', BLK, 0.05, 0.4, 1.05, -0.62, 0.74, -0.2)
    .box('body', YEL, 0.02, 0.06, 1.65, 0.65, 0.95, -0.45)
    .box('body', YEL, 0.02, 0.06, 1.65, -0.65, 0.95, -0.45)
    // narrow nose with the single headlamp, dash under the windscreen, front mudguard and plate
    .box('body', BLK, 0.64, 0.78, 0.36, 0, 0.77, 1.1)
    .box('body', BLK, 0.98, 0.16, 0.8, 0, 0.7, 0.6)
    .box('body', BLK, 1.04, 0.26, 0.08, 0, 0.91, 1.0)
    .box('body', 0x1c1c1f, 1.04, 0.07, 0.34, 0, 1.085, 0.86)
    .cyl('head', 0x9fe0b0, 0.05, 0.02, 0.2, 1.13, 0.92, 0.5, 'y')
    .box('body', BLK, 0.28, 0.08, 0.5, 0, 0.5, 1.06)
    .box('body', 0xf2c400, 0.34, 0.1, 0.02, 0, 0.64, 1.285)
    .box('glass', 0x9fb4c8, 1.02, 0.72, 0.03, 0, 1.38, 1.0, 1, -0.12)
    .box('body', BLK, 0.05, 0.85, 0.05, 0.53, 1.33, 1.0)
    .box('body', BLK, 0.05, 0.85, 0.05, -0.53, 1.33, 1.0)
    // the canvas hood: rounded roof, valances, closed rear quarters and back
    .box('hood', YEL, 1.34, 0.05, 2.22, 0, 1.73, -0.14)
    .arc('hood', YEL, 1.34, 0.15, 2.22, 0, 1.755, -0.14)
    .box('hood', YEL, 0.04, 0.24, 2.22, 0.655, 1.63, -0.14)
    .box('hood', YEL, 0.04, 0.24, 2.22, -0.655, 1.63, -0.14)
    .box('hood', YEL, 0.04, 0.8, 0.46, 0.655, 1.34, -1.02)
    .box('hood', YEL, 0.04, 0.8, 0.46, -0.655, 1.34, -1.02)
    .box('hood', YEL, 1.34, 0.8, 0.04, 0, 1.34, -1.255)
    .box('body', 0x0b0b0b, 0.05, 0.03, 2.23, 0.655, 1.505, -0.14)
    .box('body', 0x0b0b0b, 0.05, 0.03, 2.23, -0.655, 1.505, -0.14)
    .box('body', 0x0b0b0b, 1.27, 0.03, 2.2, 0, 1.69, -0.14)
    // seats, handlebar, driver in khaki
    .box('body', SEAT, 1.1, 0.2, 0.5, 0, 0.92, -0.5)
    .box('body', SEAT, 1.1, 0.5, 0.12, 0, 1.18, -0.8)
    .box('body', SEAT, 0.44, 0.08, 0.36, 0, 0.9, 0.28)
    .box('body', KHAKI, 0.42, 0.55, 0.28, 0, 1.2, 0.3)
    .sph(SKIN, 0.12, 0, 1.58, 0.32)
    .sph(0x120d0a, 0.118, 0, 1.61, 0.3)
    .wheel(0, 0.22, 1.05, 0.22, 0.13).wheel(0.6, 0.22, -0.82, 0.22, 0.14).wheel(-0.6, 0.22, -0.82, 0.22, 0.14)
    .cyl('head', 0xfff3dc, 0.085, 0.05, 0, 1.0, 1.29, 5, 'z')
    .box('head', 0xffa020, 0.06, 0.05, 0.03, 0.27, 1.12, 1.29, 3)
    .box('head', 0xffa020, 0.06, 0.05, 0.03, -0.27, 1.12, 1.29, 3)
    .box('tail', 0xff1a1a, 0.1, 0.07, 0.03, 0.52, 0.8, -1.3, 3)
    .box('tail', 0xff1a1a, 0.1, 0.07, 0.03, -0.52, 0.8, -1.3, 3)
    .head(0, 1.0, 1.36, 0.9).tail(0.52, 0.8, -1.35, 0.38).tail(-0.52, 0.8, -1.35, 0.38);
  for (const s of [1, -1]) {
    m.limb(KHAKI, 0.05, [s * 0.19, 1.42, 0.33], [s * 0.27, 1.25, 0.6]);
    m.limb(SKIN, 0.038, [s * 0.27, 1.25, 0.6], [s * 0.33, 1.2, 0.79]);
    m.limb(0x5c5c5c, 0.013, [0, 1.17, 0.84], [s * 0.28, 1.2, 0.8]);
    m.cyl('body', 0x0b0b0b, 0.022, 0.12, s * 0.33, 1.2, 0.8);
  }
  m.limb(0x2a2a2a, 0.02, [0, 0.86, 0.9], [0, 1.17, 0.84]);
  return m;
}
function sedan(bodyCol, roofCol) {
  const m = new Model(4.0, 1.62)
    .box('body', bodyCol, 1.62, 0.62, 4.0, 0, 0.64, 0)
    .box('body', GLASS, 1.44, 0.5, 2.0, 0, 1.2, -0.15)
    .box('body', roofCol, 1.46, 0.07, 1.9, 0, 1.47, -0.18)
    .box('body', 0x9a9a9a, 1.66, 0.12, 0.12, 0, 0.44, 2.0, 1.4)
    .box('body', 0x9a9a9a, 1.66, 0.12, 0.12, 0, 0.44, -2.0, 1.4)
    .box('body', 0x060606, 1.1, 0.16, 0.03, 0, 0.7, 2.01)
    .box('tail', 0xff1a1a, 0.28, 0.12, 0.03, 0.58, 0.74, -2.01, 3)
    .box('tail', 0xff1a1a, 0.28, 0.12, 0.03, -0.58, 0.74, -2.01, 3)
    .tail(0.58, 0.74, -2.06, 0.7).tail(-0.58, 0.74, -2.06, 0.7);
  for (const x of [0.55, -0.55]) m.cyl('head', 0xfff4e0, 0.1, 0.05, x, 0.7, 2.0, 5, 'z').head(x, 0.7, 2.06, 1);
  for (const x of [0.72, -0.72]) for (const z of [1.25, -1.25]) m.wheel(x, 0.3, z, 0.3, 0.2);
  return m;
}
function busModel() {
  const RED = 0xc4161c;
  const m = new Model(11, 2.5)
    .box('body', RED, 2.5, 4.1, 11, 0, 2.45, 0)
    .box('body', 0x1c1c1c, 2.52, 0.3, 11.02, 0, 0.55, 0)
    .box('body', 0xf0e6d0, 2.52, 0.14, 11.02, 0, 2.62, 0)
    .box('head', 0xb8d4e8, 2.54, 0.85, 8.4, 0, 1.75, -0.8, 0.75)
    .box('head', 0xb8d4e8, 2.54, 0.85, 10.2, 0, 3.5, 0, 0.75)
    .box('body', GLASS, 2.2, 1.3, 0.04, 0, 1.75, 5.51)
    .box('head', 0xb8d4e8, 2.2, 0.8, 0.04, 0, 3.5, 5.51, 0.6)
    .box('head', 0xff8a00, 1.8, 0.3, 0.04, 0, 2.85, 5.53, 3)
    .box('tail', 0xff1a1a, 0.25, 0.25, 0.04, 1.05, 0.9, -5.52, 3)
    .box('tail', 0xff1a1a, 0.25, 0.25, 0.04, -1.05, 0.9, -5.52, 3)
    .tail(1.05, 0.9, -5.58, 1).tail(-1.05, 0.9, -5.58, 1);
  for (const x of [0.95, -0.95]) m.cyl('head', 0xfff4e0, 0.13, 0.05, x, 0.85, 5.51, 5, 'z').head(x, 0.85, 5.58, 1.2);
  for (const x of [1.1, -1.1]) for (const z of [3.4, -3.4]) m.wheel(x, 0.5, z, 0.5, 0.3);
  return m;
}
function truckModel() {
  const m = new Model(7.3, 2.45)
    .box('body', 0x151515, 2.0, 0.4, 7.2, 0, 0.75, 0)
    .box('body', 0xe0640c, 2.3, 1.7, 1.9, 0, 1.75, 2.6)
    .box('body', GLASS, 2.2, 0.7, 0.04, 0, 2.15, 3.56)
    .box('body', 0xffcc00, 2.32, 0.32, 0.9, 0, 2.75, 3.05)
    .box('body', 0xd9a400, 2.45, 1.3, 5.0, 0, 1.6, -1.1)
    .box('body', 0x1f5fbf, 2.4, 0.9, 4.9, 0, 2.7, -1.1)
    .box('tail', 0xff1a1a, 0.22, 0.18, 0.04, 1.0, 1.0, -3.62, 3)
    .box('tail', 0xff1a1a, 0.22, 0.18, 0.04, -1.0, 1.0, -3.62, 3)
    .tail(1.0, 1.0, -3.68, 0.9).tail(-1.0, 1.0, -3.68, 0.9);
  for (const x of [0.85, -0.85]) m.cyl('head', 0xfff4e0, 0.12, 0.05, x, 1.1, 3.56, 5, 'z').head(x, 1.1, 3.62, 1.1);
  for (const x of [1.05, -1.05]) for (const z of [2.6, -2.0, -3.0]) m.wheel(x, 0.5, z, 0.5, 0.3);
  return m;
}
function bikeModel() {
  return new Model(1.9, 0.75)
    .box('body', 0x2a2a2a, 0.35, 0.45, 1.5, 0, 0.55, 0)
    .box('body', 0x7a1010, 0.42, 0.75, 0.16, 0, 0.88, 0.62)
    .box('body', 0x1f3f8f, 0.5, 0.75, 0.45, 0, 1.28, -0.12)
    .box('body', 0x1f3f8f, 0.44, 0.25, 0.55, 0, 0.88, 0.12)
    .sph(0x111111, 0.16, 0, 1.8, -0.06)
    .wheel(0, 0.27, 0.62, 0.27, 0.1).wheel(0, 0.27, -0.6, 0.27, 0.1)
    .cyl('head', 0xfff4e0, 0.07, 0.05, 0, 1.05, 0.71, 5, 'z')
    .box('tail', 0xff1a1a, 0.12, 0.06, 0.03, 0, 0.82, -0.77, 3)
    .head(0, 1.05, 0.78, 0.8).tail(0, 0.82, -0.82, 0.5);
}

const HORN_TEX = canvasTex(512, 256, (g, w, h) => {
  g.fillStyle = '#ffd400'; g.fillRect(0, 0, w, h);
  const bands = ['#d81b60', '#1e88e5', '#43a047', '#e53935'];
  bands.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * 10, w, 10); g.fillRect(0, h - 40 + i * 10, w, 10); });
  g.fillStyle = '#c62828'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold 66px ${FONT}`; g.fillText('HORN OK', w / 2, 98);
  g.fillStyle = '#1a237e'; g.font = `bold 58px ${FONT}`; g.fillText('PLEASE', w / 2, 168);
});
const BODY_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.35 });
const HEAD_MAT = new THREE.MeshBasicMaterial({ vertexColors: true });
const TAIL_MAT = new THREE.MeshBasicMaterial({ vertexColors: true });
const GLASS_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.22, depthWrite: false });
const HOOD_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.0 });
const PART_MAT = { body: BODY_MAT, hood: HOOD_MAT, glass: GLASS_MAT, head: HEAD_MAT, tail: TAIL_MAT };
// back of a Mumbai auto: hood with rear window and the classic painted slogan, yellow commercial plate below
const AUTO_BACK_H = 1.38, AUTO_BACK = canvasTex(512, 544, (g, w, h) => {
  const split = Math.round((1.74 - 0.97) / AUTO_BACK_H * h);
  g.fillStyle = '#ffc21a'; g.fillRect(0, 0, w, split);
  g.fillStyle = '#111214'; g.fillRect(0, split, w, h - split);
  g.fillStyle = '#0b0b0b'; g.fillRect(0, split - 14, w, 14);
  const win = g.createLinearGradient(0, 40, 0, 150);
  win.addColorStop(0, '#1d2633'); win.addColorStop(1, '#06090d');
  g.fillStyle = win; rrect(g, 128, 36, 256, 108, 18); g.fill();
  g.strokeStyle = '#141414'; g.lineWidth = 6; rrect(g, 128, 36, 256, 108, 18); g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#b3121b'; g.font = `bold 40px ${FONT}`;
  g.fillText('बुरी नज़र वाले', w / 2, 188);
  g.fillText('तेरा मुँह काला', w / 2, 238);
  g.fillStyle = '#ffffff'; g.font = `bold 22px ${FONT}`; g.fillText('HORN  PLEASE', w / 2, split + 36);
  g.fillStyle = '#f2c400'; rrect(g, 176, split + 66, 160, 84, 8); g.fill();
  g.strokeStyle = '#111'; g.lineWidth = 3; rrect(g, 181, split + 71, 150, 74, 6); g.stroke();
  g.fillStyle = '#111'; g.font = `bold 30px ${FONT}`;
  g.fillText('MH 02', w / 2, split + 93); g.fillText('AU 4207', w / 2, split + 126);
});
const AUTO_BACK_MAT = new THREE.MeshStandardMaterial({ map: AUTO_BACK, roughness: 0.42, metalness: 0.0 });
function autoBackGeo() {
  const g = new THREE.PlaneGeometry(1.3, AUTO_BACK_H); g.rotateY(Math.PI); g.translate(0, 1.74 - AUTO_BACK_H / 2, -1.288);
  return g;
}
const TYPES = {
  auto: { m: autoModel(), max: 34, w: 30, v: [9, 13] },
  taxi: { m: sedan(0x0e0e0e, 0xffc21a), max: 24, w: 20, v: [11, 15] },
  car: { m: sedan(0xffffff, 0xffffff), max: 24, w: 20, v: [12, 16.5], tints: [0xdcdcdc, 0xf2f2f2, 0x8a1010, 0x15284d, 0x4a4f55, 0x9aa0a6] },
  bus: { m: busModel(), max: 8, w: 7, v: [8.5, 11] },
  truck: { m: truckModel(), max: 8, w: 6, v: [8, 10.5] },
  bike: { m: bikeModel(), max: 20, w: 15, v: [11, 15] },
};
const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);
for (const [name, T] of Object.entries(TYPES)) {
  const geos = T.m.build();
  T.free = Array.from({ length: T.max }, (_, i) => T.max - 1 - i);
  T.meshes = {};
  for (const [k, g] of Object.entries(geos)) {
    const im = new THREE.InstancedMesh(g, PART_MAT[k], T.max);
    im.frustumCulled = false;
    for (let i = 0; i < T.max; i++) { im.setMatrixAt(i, HIDE); im.setColorAt(i, new THREE.Color(1, 1, 1)); }
    scene.add(im);
    T.meshes[k] = im;
  }
  let decor = null;
  if (name === 'truck') {
    const pg = new THREE.PlaneGeometry(2.3, 1.15); pg.rotateY(Math.PI); pg.translate(0, 1.65, -3.63);
    decor = [pg, new THREE.MeshStandardMaterial({ map: HORN_TEX, emissiveMap: HORN_TEX, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.6 })];
  } else if (name === 'auto') decor = [autoBackGeo(), AUTO_BACK_MAT];
  if (decor) {
    const im = new THREE.InstancedMesh(decor[0], decor[1], T.max);
    im.frustumCulled = false;
    for (let i = 0; i < T.max; i++) im.setMatrixAt(i, HIDE);
    scene.add(im);
    T.meshes.decor = im;
  }
}

// ---------------------------------------------------------------- traffic simulation
const traffic = [];
const TYPE_NAMES = Object.keys(TYPES);
function pickType() {
  const tot = TYPE_NAMES.reduce((a, n) => a + TYPES[n].w, 0);
  let r = R() * tot;
  for (const n of TYPE_NAMES) { r -= TYPES[n].w; if (r <= 0) return n; }
  return 'auto';
}
const lanesFor = (dir) => (dir > 0 ? [LANE.inn, LANE.out] : [LANE.oppIn, LANE.oppOut]);
function addVehicle(dir, z, laneIdx) {
  let type = pickType();
  if (!TYPES[type].free.length) type = TYPE_NAMES.find((n) => TYPES[n].free.length);
  if (!type) return null;
  const T = TYPES[type], lanes = lanesFor(dir);
  if (type === 'bus' || type === 'truck') laneIdx = 1;
  const x = lanes[laneIdx] + (type === 'bike' ? rand(-0.7, 0.7) : rand(-0.15, 0.15));
  const c = {
    type, idx: T.free.pop(), dir, lane: laneIdx, x, tx: x, z, v: 0, vdes: rand(...T.v), brake: 0,
    len: T.m.len, wid: T.m.wid, lc: rand(0, 3), ph: rand(0, 10),
  };
  c.v = c.vdes;
  if (T.tints) T.meshes.body.setColorAt(c.idx, new THREE.Color(pick(T.tints)));
  traffic.push(c);
  return c;
}

const player = {
  x: LANE.inn, z: 120, yaw: 0, v: 11, steer: 0, len: 2.7, wid: 1.35, roll: 0, pitch: 0, bump: 0,
  horn: 0, dist: 0, prevX: LANE.inn, acc: 0, isPlayer: true,
};
function initTraffic() {
  for (const dir of [1, -1]) for (let li = 0; li < 2; li++) {
    let z = player.z - 130 + rand(0, 10);
    while (z < player.z + 340) {
      if (!(dir > 0 && li === 0 && Math.abs(z - player.z) < 14)) addVehicle(dir, z, li);
      z += rand(dir > 0 ? 22 : 15, dir > 0 ? 42 : 30);
    }
  }
}
const vz = (o) => (o.isPlayer ? o.v * Math.cos(o.yaw) : o.v * o.dir);
function laneClear(c, x, from, to, margin = 0.3) {
  const all = traffic.concat([player]);
  return all.every((o) => o === c || o === player && c.isProbe || Math.abs(o.x - x) > (o.wid + c.wid) / 2 + margin ||
    (o.z - c.z) * c.dir < from || (o.z - c.z) * c.dir > to);
}
function stepTraffic(dt) {
  const all = traffic.concat([player]);
  for (const c of traffic) {
    let gap = 1e9, lead = null;
    for (const o of all) {
      if (o === c) continue;
      if (Math.abs(o.x - c.x) > (o.wid + c.wid) / 2 + 0.3) continue;
      const d = (o.z - c.z) * c.dir - (o.len + c.len) / 2;
      if (d > -1.5 && d < gap) { gap = d; lead = o; }
    }
    let target = c.vdes;
    if (lead) {
      const safe = 2.5 + c.v * 0.8, vl = Math.max(0, vz(lead) * c.dir);
      if (gap < safe + 30) target = Math.min(target, Math.max(0, vl + (gap - safe) * 0.4));
    }
    const acc = target > c.v ? 2.0 : -8 * clamp((c.v - target) / 3, 0.2, 1);
    c.v = Math.max(0, c.v + acc * dt);
    c.brake = lerp(c.brake, acc < -1.2 || c.v < 0.4 ? 1 : 0, Math.min(1, dt * 8));
    c.lc -= dt;
    if (lead && gap < 18 && c.v < c.vdes - 1.5 && c.lc <= 0 && c.type !== 'bus' && c.type !== 'truck') {
      const ol = 1 - c.lane, ox = lanesFor(c.dir)[ol];
      if (laneClear(c, ox, -9, 22)) { c.lane = ol; c.tx = ox + (c.type === 'bike' ? rand(-0.6, 0.6) : 0); }
      c.lc = rand(2, 5);
    }
    if (c.type === 'bike' && c.lc <= 0 && R() < dt * 0.3) c.tx = lanesFor(c.dir)[c.lane] + rand(-0.8, 0.8);
    c.x += (c.tx - c.x) * Math.min(1, dt * 1.1);
    c.z += c.v * c.dir * dt;
    const rel = c.z - player.z;
    let nz = null;
    if (rel < -170) nz = player.z + rand(300, 370);
    else if (c.dir > 0 && rel > 420) nz = player.z - rand(140, 160);
    if (nz !== null) {
      const lanes = lanesFor(c.dir);
      c.z = nz;
      c.lane = (c.type === 'bus' || c.type === 'truck') ? 1 : (R() < 0.5 ? 0 : 1);
      c.x = c.tx = lanes[c.lane];
      for (let k = 0; k < 6 && !laneClear(c, c.x, -14, 14); k++) c.z += 16 * (c.dir > 0 ? 1 : -1) * (nz > player.z ? 1 : -1);
      c.vdes = rand(...TYPES[c.type].v); c.v = c.vdes;
    }
  }
}

// ---------------------------------------------------------------- player rickshaw: physics, autopilot
const WB = 1.95;
const maxSteer = (v) => 0.42 / (1 + Math.abs(v) * 0.09);
function stepPlayer(dt, inp) {
  const p = player;
  let a = inp.throttle * 3.6 * (1 - p.v / 21) - inp.brake * 9 * Math.sign(p.v || 1) - Math.sign(p.v) * (0.25 + 0.004 * p.v * p.v);
  if (inp.brake && p.v <= 0.2 && !inp.throttle) a = -1.6;
  if (!inp.throttle && !inp.brake && Math.abs(p.v) < 0.25) { a = 0; p.v = 0; }
  p.v = clamp(p.v + a * dt, -3, 21);
  p.acc = a;
  p.steer = lerp(p.steer, inp.steer * maxSteer(p.v), Math.min(1, dt * 6));
  p.yaw += p.v * Math.tan(p.steer) / WB * dt;
  p.x += Math.sin(p.yaw) * p.v * dt;
  p.z += Math.cos(p.yaw) * p.v * dt;
  const lim = RH - 0.75;
  if (Math.abs(p.x) > lim) { p.x = Math.sign(p.x) * lim; p.yaw *= 0.5; p.v *= 0.97; p.bump = Math.max(p.bump, 0.35); }
  const zm = ((p.z % LEN) + LEN) % LEN;
  if (Math.abs(p.x) < 0.98 && !nearCross(zm, CW + 1)) {
    p.x = (p.prevX >= 0 ? 1 : -1) * 0.98; p.yaw *= 0.4; p.v *= 0.92; p.bump = Math.max(p.bump, 0.5);
  }
  for (const c of traffic) {
    const dz = Math.abs(c.z - p.z), dx = Math.abs(c.x - p.x);
    const oz = (c.len + p.len) / 2 - dz, ox = (c.wid + p.wid) / 2 - dx;
    if (oz > 0.05 && ox > 0.05) {
      if (ox < oz) p.x += Math.sign(p.x - c.x || 1) * ox;
      else { p.z += Math.sign(p.z - c.z) * oz; p.v = Math.min(p.v, Math.max(0, vz(c))); }
      p.v *= 0.7; p.bump = 1; p.horn = Math.max(p.horn, 0.6);
    }
  }
  p.prevX = p.x;
  p.dist += Math.abs(p.v) * dt;
  p.bump = Math.max(0, p.bump - dt * 2.2);
  p.horn = Math.max(0, p.horn - dt);
  p.roll = lerp(p.roll, -p.steer * p.v * 0.045, Math.min(1, dt * 5));
  p.pitch = lerp(p.pitch, -a * 0.006, Math.min(1, dt * 4));
}
// Mumbai-style autopilot: three lines to choose from, including the gap between the two lanes.
function autopilot(dt) {
  const p = player, lanes = [LANE.inn, 3.45, LANE.out];
  if (!p.ap) {
    let li = 0;
    lanes.forEach((x, i) => { if (Math.abs(x - p.x) < Math.abs(lanes[li] - p.x)) li = i; });
    p.ap = { lane: li, timer: 0, vt: 17.5 };
  }
  const ap = p.ap;
  const ahead = (lx) => {
    let best = 1e9, bv = 0;
    for (const c of traffic) {
      if (Math.abs(c.x - lx) > (c.wid + p.wid) / 2 + 0.08) continue;
      const d = (c.z - p.z) - (c.len + p.len) / 2;
      if (d > -2 && d < best) { best = d; bv = vz(c); }
    }
    return [best, bv];
  };
  const [g0, v0] = ahead(lanes[ap.lane]);
  ap.timer -= dt;
  if (g0 < 34 && v0 < ap.vt - 1 && ap.timer <= 0) {
    let best = ap.lane, bestG = g0;
    for (const o of [ap.lane - 1, ap.lane + 1]) {
      if (o < 0 || o > 2) continue;
      const [g1] = ahead(lanes[o]);
      if (g1 > bestG + 8 && laneClear({ z: p.z, dir: 1, wid: p.wid, isProbe: true }, lanes[o], -6, 8, 0.05)) { best = o; bestG = g1; }
    }
    if (best !== ap.lane) { ap.lane = best; ap.timer = 1.4; }
  }
  const tx = lanes[ap.lane];
  let vt = ap.vt;
  if (g0 < 34) vt = Math.min(vt, Math.max(0, v0) + (g0 - 4.5) * 0.55);
  const dYaw = clamp((tx - p.x) * 0.18, -0.26, 0.26);
  const st = Math.atan((dYaw - p.yaw) * 2.8 * WB / Math.max(p.v, 1));
  return {
    throttle: p.v < vt ? clamp((vt - p.v) * 0.7, 0, 1) : 0,
    brake: p.v > vt + 0.6 ? clamp((p.v - vt) * 0.3, 0, 1) : 0,
    steer: clamp(st / maxSteer(p.v), -1, 1),
    horn: g0 < 9 && v0 < p.v ? 1 : 0,
  };
}

// player mesh
const playerG = new THREE.Group();
const PLAYER_TAIL = new THREE.MeshBasicMaterial({ vertexColors: true });
{
  const geos = autoModel().build();
  playerG.add(new THREE.Mesh(geos.body, BODY_MAT));
  playerG.add(new THREE.Mesh(geos.hood, HOOD_MAT));
  playerG.add(new THREE.Mesh(autoBackGeo(), AUTO_BACK_MAT));
  playerG.add(new THREE.Mesh(geos.glass, GLASS_MAT));
  playerG.add(new THREE.Mesh(geos.head, HEAD_MAT));
  playerG.add(new THREE.Mesh(geos.tail, PLAYER_TAIL));
  scene.add(playerG);
}

// cockpit: a single pendulum wiper hanging from the top of the windscreen, and rain drops that it clears
const WIPE_A = 0.95, WIPE_W = Math.PI * 2 / 1.25, WIPE_R = 0.62, SCREEN = [1.0, 0.7], PIVOT = 0.33;
const wiperG = new THREE.Group();
{
  const arm = new THREE.BoxGeometry(0.018, WIPE_R, 0.014); arm.translate(0, -WIPE_R / 2, 0.012);
  const blade = new THREE.BoxGeometry(0.03, 0.48, 0.02); blade.translate(0, -0.37, 0.022);
  wiperG.add(new THREE.Mesh(mergeGeometries([vc(arm, 0x0a0a0a), vc(blade, 0x050505)]), BODY_MAT));
  wiperG.position.set(0, 1.38 + PIVOT * Math.cos(0.12), 1.02 - PIVOT * Math.sin(0.12) + 0.012);
  playerG.add(wiperG);
}
const DROP_CV = document.createElement('canvas');
DROP_CV.width = 512; DROP_CV.height = Math.round(512 * SCREEN[1] / SCREEN[0]);
const dropG = DROP_CV.getContext('2d');
const DROP_TEX = new THREE.CanvasTexture(DROP_CV);
DROP_TEX.colorSpace = THREE.SRGBColorSpace;
const DROP_MAT = new THREE.MeshBasicMaterial({ map: DROP_TEX, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
{
  const g = new THREE.PlaneGeometry(SCREEN[0], SCREEN[1]); g.rotateX(-0.12); g.translate(0, 1.38, 1.02);
  playerG.add(new THREE.Mesh(g, DROP_MAT));
}
const DROP_SPR = document.createElement('canvas');
DROP_SPR.width = DROP_SPR.height = 64;
{
  // a lit droplet: soft body, brighter lower rim, small specular glint
  const g = DROP_SPR.getContext('2d'), gr = g.createRadialGradient(32, 36, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,0.32)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill();
  const gl = g.createRadialGradient(26, 24, 0, 26, 24, 9);
  gl.addColorStop(0, 'rgba(255,255,255,1)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(26, 24, 9, 0, 7); g.fill();
}
const DROPS = [];
{
  // own generator so the drops do not shift the seeded traffic simulation
  let sd = 1234567;
  const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 300; i++) {
    const x = r() * DROP_CV.width, y = r() * DROP_CV.height;
    const px = (x / DROP_CV.width - 0.5) * SCREEN[0], py = (0.5 - y / DROP_CV.height) * SCREEN[1];
    const phi = Math.atan2(px, PIVOT - py), rr = Math.hypot(px, PIVOT - py);
    DROPS.push({ x, y, r: 3 + r() * r() * 8, a: 0.5 + r() * 0.5, delay: 0.05 + r() * 1.2, life: 2 + r() * 3, off: r() * 5,
      wiped: rr < WIPE_R && Math.abs(phi) < WIPE_A, s: Math.asin(clamp(phi / WIPE_A, -1, 1)) });
  }
}
function updateCockpit(t) {
  const w = WIPE_W * t, TAU = Math.PI * 2;
  wiperG.rotation.set(-0.12, 0, WIPE_A * Math.sin(w));
  const g = dropG;
  g.globalAlpha = 1; g.fillStyle = '#000'; g.fillRect(0, 0, DROP_CV.width, DROP_CV.height);
  for (const d of DROPS) {
    let age;
    if (d.wiped) {
      const c1 = d.s + TAU * Math.floor((w - d.s) / TAU), c2 = Math.PI - d.s + TAU * Math.floor((w - Math.PI + d.s) / TAU);
      age = (w - Math.max(c1, c2)) / WIPE_W - d.delay;
    } else {
      age = ((t + d.off) % d.life) - d.delay * 0.3;
      if (age > d.life * 0.8) continue;
    }
    if (age <= 0) continue;
    const rad = d.r * Math.min(1, 0.45 + age * 2.5);
    g.globalAlpha = Math.min(1, age * 6) * d.a;
    g.drawImage(DROP_SPR, d.x - rad, d.y - rad, rad * 2, rad * 2);
  }
  DROP_TEX.needsUpdate = true;
  const zm = ((player.z % LEN) + LEN) % LEN, ld = lampDist[Math.floor(zm) % 1024];
  DROP_MAT.color.setScalar(0.4 + 0.9 * Math.exp(-ld * ld / 60) + SKY_U.flash.value * 1.2);
}
const playerLight = new THREE.PointLight(0xffa860, 0, 10, 1.4);
scene.add(playerLight);
const PM = autoModel();

// ---------------------------------------------------------------- push vehicle state into meshes, halos and road light pools
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const _c = new THREE.Color();
function anchor(x, z, yaw, a) {
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  return [x + a[0] * cs + a[2] * sn, a[1], z - a[0] * sn + a[2] * cs];
}
function lightsFor(m, x, z, yaw, brake, cam, big = 1) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  for (const h of m.heads) {
    const [gx, gy, gz] = anchor(x, z, yaw, h);
    const dx = cam.x - gx, dy = cam.y - gy, dz = cam.z - gz, d = Math.hypot(dx, dy, dz) || 1;
    const face = clamp(((dx * fx + dz * fz) / d + 0.15) / 0.7);
    const s = h[3] * big;
    if (face > 0.01) {
      dynGlow.put(0.42 * face, 0.36 * face, 0.28 * face, 2.3 * s, 2.3 * s, gx, gy, gz);
      dynGlow.put(1.5 * face, 1.42 * face, 1.3 * face, 0.42 * s, 0.42 * s, gx, gy, gz);
    }
    dynGlow.put(0.06, 0.05, 0.04, 0.8 * s, 0.8 * s, gx, gy, gz);
  }
  for (const t of m.tails) {
    const [gx, gy, gz] = anchor(x, z, yaw, t);
    const k = 0.45 + brake * 1.1;
    dynGlow.put(1.0 * k, 0.06 * k, 0.04 * k, 1.5 * t[3] * (1 + brake * 0.5), 1.5 * t[3] * (1 + brake * 0.5), gx, gy, gz);
  }
  const L = m.len / 2;
  const pk = big > 1.1 ? 0.6 : 0.3;
  dynPool.put(pk, pk * 0.87, pk * 0.7, m.wid * 2.8, 11 * big, x + fx * (L + 5.5 * big), 0.025, z + fz * (L + 5.5 * big));
  dynPool.put(0.32 * (0.5 + brake), 0.02, 0.01, m.wid * 1.9, 3.5, x - fx * (L + 1.2), 0.025, z - fz * (L + 1.2));
}
function applyVehicles(cam) {
  dynGlow.reset(); dynPool.reset();
  for (const c of traffic) {
    const T = TYPES[c.type];
    const yaw = (c.dir > 0 ? 0 : Math.PI) + c.dir * clamp((c.tx - c.x) * 1.1 / Math.max(c.v, 2), -0.2, 0.2);
    const roll = c.type === 'bike' ? Math.sin(c.ph + c.z * 0.15) * 0.05 : 0;
    _e.set(0, yaw, roll, 'YXZ');
    _q.setFromEuler(_e);
    _p.set(c.x, 0, c.z);
    _m.compose(_p, _q, _s);
    for (const k in T.meshes) T.meshes[k].setMatrixAt(c.idx, _m);
    _c.setScalar(1 + c.brake * 1.6);
    T.meshes.tail.setColorAt(c.idx, _c);
    lightsFor(T.m, c.x, c.z, yaw, c.brake, cam, 1);
  }
  for (const T of Object.values(TYPES)) for (const im of Object.values(T.meshes)) {
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }
  const p = player;
  playerG.position.set(p.x, 0, p.z);
  playerG.rotation.set(p.pitch, p.yaw, p.roll, 'YXZ');
  playerG.position.y = Math.sin(p.dist * 2.3) * 0.012 + p.bump * Math.sin(p.dist * 9) * 0.04;
  const braking = p.acc < -2 ? 1 : 0;
  PLAYER_TAIL.color.setScalar(1 + braking * 1.6);
  lightsFor(PM, p.x, p.z, p.yaw, braking, cam, 1.15);
  const zm = ((p.z % LEN) + LEN) % LEN;
  const ld = lampDist[Math.floor(zm) % 1024];
  playerLight.position.set(p.x - Math.sign(p.x) * 1.2, 4.2, p.z);
  playerLight.intensity = 3 + 22 * Math.exp(-ld * ld / 40);
  dynGlow.commit(); dynPool.commit();
}
