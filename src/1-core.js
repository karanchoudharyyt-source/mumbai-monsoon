import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

// Cinematic mode (?demo) renders deterministic frames on demand via window.renderAt(t).
const PARAMS = new URLSearchParams(location.search);
const DEMO = PARAMS.has('demo');
const TOUCH = !DEMO && (PARAMS.has('touch') || matchMedia('(hover: none) and (pointer: coarse)').matches);
if (DEMO || TOUCH) document.getElementById('help').remove();
let W = DEMO ? 1920 : innerWidth, H = DEMO ? 1080 : innerHeight;
const FONT = 'FreeSans, "Noto Sans Devanagari", "Nirmala UI", "Segoe UI", Arial, sans-serif';

function mulberry(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const R = mulberry(20261005);
const rand = (a = 0, b = 1) => a + (b - a) * R();
const pick = (a) => a[Math.floor(R() * a.length)];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
const ease = (u) => { u = clamp(u); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: DEMO, powerPreference: 'high-performance' });
renderer.setPixelRatio(DEMO ? 1 : Math.min(devicePixelRatio, TOUCH ? 1 : 1.5));
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060912);
scene.fog = new THREE.FogExp2(0x0c1222, 0.0105);
const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 1500);

const RH = 7;            // road half width
const SW = 3;            // sidewalk width
const FACE = RH + SW;    // building facade x
const LEN = 1000;
const CROSS = [175, 365, 565, 770];
const nearCross = (z, pad) => CROSS.some((c) => Math.abs(z - c) < pad);
const LANE = { out: 5.15, inn: 1.75, oppIn: -1.75, oppOut: -5.15 };

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const GLOW = canvasTex(128, 128, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, w);
});

// Merge static geometry by material so the whole street costs a few dozen draw calls.
const buckets = new Map();
function addGeo(key, mat, geo) {
  if (!buckets.has(key)) buckets.set(key, { mat, geos: [] });
  buckets.get(key).geos.push(geo);
}
function flushBuckets(parent = scene) {
  for (const { mat, geos } of buckets.values()) {
    const indexed = geos.filter((g) => g.index), plain = geos.filter((g) => !g.index);
    for (const list of [indexed, plain]) {
      if (!list.length) continue;
      const mesh = new THREE.Mesh(mergeGeometries(list), mat);
      mesh.matrixAutoUpdate = false;
      mesh.layers.set(mat.userData.layer || 0);
      parent.add(mesh);
    }
  }
  buckets.clear();
}
function scaleUV(g, rx, ry) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rx, uv.getY(i) * ry);
}
function setFaceUV(g, face, u, v) {
  const uv = g.attributes.uv;
  for (let i = face * 4; i < face * 4 + 4; i++) uv.setXY(i, u, v);
}

// Additive light decals (lamp pools, wet-road reflections) merged into one mesh.
const decalPos = [], decalCol = [], decalUV = [], decalIdx = [];
function decal(x, y, z, sx, sz, color, alpha) {
  const c = new THREE.Color(color).multiplyScalar(alpha);
  const base = decalPos.length / 3;
  const pts = [[-sx / 2, -sz / 2], [sx / 2, -sz / 2], [sx / 2, sz / 2], [-sx / 2, sz / 2]];
  const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
  pts.forEach(([dx, dz], i) => {
    decalPos.push(x + dx, y, z + dz);
    decalCol.push(c.r, c.g, c.b);
    decalUV.push(...uvs[i]);
  });
  decalIdx.push(base, base + 2, base + 1, base, base + 3, base + 2);
}
function flushDecals(parent = scene) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(decalPos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(decalCol, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(decalUV, 2));
  g.setIndex(decalIdx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    map: GLOW, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: true,
  }));
  m.renderOrder = 2;
  m.layers.set(1);
  parent.add(m);
}

const spriteMats = new Map();
function glow(parent, color, size, x, y, z, intensity = 1) {
  const key = color + ':' + intensity;
  if (!spriteMats.has(key)) {
    spriteMats.set(key, new THREE.SpriteMaterial({
      map: GLOW, color: new THREE.Color(color).multiplyScalar(intensity),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
  }
  const s = new THREE.Sprite(spriteMats.get(key));
  s.scale.set(size, size, 1);
  s.position.set(x, y, z);
  parent.add(s);
  return s;
}
