// ---------------------------------------------------------------- world helpers
const city = new THREE.Group();
scene.add(city);
const FOG_D = { value: scene.fog.density };
const CW = 8;                       // cross street half width
const SHOP_H = 4.4, FLOOR_H = 3.2;
const SEGS = [];
{ let a = 0; for (const c of CROSS) { SEGS.push([a, c - CW]); a = c + CW; } SEGS.push([a, LEN]); }

function box(mat, key, sx, sy, sz, x, y, z, ry = 0) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  addGeo(key, mat, g);
  return g;
}
function plane(mat, key, w, h, x, y, z, ry = 0, rx = 0) {
  const g = new THREE.PlaneGeometry(w, h);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  addGeo(key, mat, g);
  return g;
}
function quad(mat, key, p0, p1, p2, p3) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...p0, ...p1, ...p2, ...p3], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  addGeo(key, mat, g);
}
function faceScale(g, face, ru, rv, ou = 0) {
  const uv = g.attributes.uv;
  for (let i = face * 4; i < face * 4 + 4; i++) uv.setXY(i, uv.getX(i) * ru + ou, uv.getY(i) * rv);
}

// One draw call for every static glow halo: camera-facing quads built in the vertex shader.
const GLOW_MAT = new THREE.ShaderMaterial({
  uniforms: { map: { value: GLOW }, fogD: FOG_D },
  vertexShader: `attribute vec2 corner; attribute vec2 gsize; attribute vec3 gcol;
    uniform float fogD; varying vec2 vUv; varying vec3 vCol; varying float vFog;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float d = -mv.z;
      // cap the angular size so a halo right next to the lens never floods the frame
      vec2 sz = gsize * min(1.0, d * 0.09 / max(gsize.x, 1e-3));
      mv.xy += corner * sz * 0.5;
      mv.z += sz.x * 0.3;
      vUv = corner * 0.5 + 0.5; vCol = gcol;
      vFog = exp(-pow(d * fogD, 2.0)) * smoothstep(0.8, 3.0, d);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying vec3 vCol; varying float vFog;
    void main() { float a = texture2D(map, vUv).a; gl_FragColor = vec4(vCol * a * vFog, 1.0); }`,
  blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
});
class GlowBatch {
  constructor(max, mat = GLOW_MAT) {
    this.n = 0;
    const g = this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 12);
    this.col = new Float32Array(max * 12);
    this.size = new Float32Array(max * 8);
    const cor = new Float32Array(max * 8), idx = [];
    for (let i = 0; i < max; i++) {
      cor.set([-1, -1, 1, -1, 1, 1, -1, 1], i * 8);
      idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('gcol', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('gsize', new THREE.BufferAttribute(this.size, 2));
    g.setAttribute('corner', new THREE.BufferAttribute(cor, 2));
    g.setIndex(idx);
    g.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
  }
  add(color, size, k = 1, x = 0, y = -50, z = 0, sy = size) {
    const i = this.n++;
    this.setColor(i, color, k);
    for (let v = 0; v < 4; v++) this.size.set([size, sy], (i * 4 + v) * 2);
    this.set(i, x, y, z);
    this.geo.setDrawRange(0, this.n * 6);
    return i;
  }
  set(i, x, y, z) { for (let v = 0; v < 4; v++) this.pos.set([x, y, z], (i * 4 + v) * 3); }
  setColor(i, color, k) {
    const c = new THREE.Color(color).multiplyScalar(k);
    for (let v = 0; v < 4; v++) this.col.set([c.r, c.g, c.b], (i * 4 + v) * 3);
  }
  update() {
    for (const n of ['position', 'gcol', 'gsize']) this.geo.attributes[n].needsUpdate = true;
  }
}
const staticGlow = new GlowBatch(1400);
city.add(staticGlow.mesh);
const sglow = (color, size, x, y, z, k = 1) => staticGlow.add(color, size, k, x, y, z);

// ---------------------------------------------------------------- sky, environment, lights
const SKY_U = { flash: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: SKY_U,
  vertexShader: `varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float flash; varying vec3 vP;
    void main() {
      float h = max(vP.y, 0.0);
      vec3 c = mix(vec3(0.20, 0.12, 0.10), vec3(0.010, 0.014, 0.028), pow(h, 0.4));
      c += flash * vec3(0.55, 0.62, 0.9) * (0.35 + h);
      gl_FragColor = vec4(c, 1.0);
    }`,
}));
sky.renderOrder = -1;
scene.add(sky);

const pmrem = new THREE.PMREMGenerator(renderer);
{
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x0a0e1c);
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const panel = (c, k, p, s) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...p); m.scale.set(...s); env.add(m);
  };
  panel(0x1c2238, 1, [0, 30, 0], [200, 1, 200]);
  panel(0xff9a40, 1.6, [14, 5, 0], [1, 6, 80]);
  panel(0xff9a40, 1.6, [-14, 5, 0], [1, 6, 80]);
  panel(0xff3d7f, 2.5, [13, 10, 18], [1, 2, 10]);
  panel(0x3df2ff, 2.5, [-13, 11, -16], [1, 2, 10]);
  panel(0x040506, 1, [0, -3, 0], [200, 1, 200]);
  scene.environment = pmrem.fromScene(env, 0.02).texture;
  scene.environmentIntensity = 0.7;
}
const hemi = new THREE.HemisphereLight(0x33406a, 0x0a0806, 0.35);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0x8fa6ff, 0.0);
moon.position.set(-30, 80, 40);
scene.add(moon);

// ---------------------------------------------------------------- wet road: real reflections, smeared by roughness, rippled by rain
const RAIN_T = { value: 0 };
const roadShader = {
  name: 'WetRoad',
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
    tRough: { value: null }, time: { value: 0 }, rh: { value: RH },
  }]),
  vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vWorld;
    #include <fog_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; uniform sampler2D tRough; uniform float time; uniform float rh;
    varying vec4 vUv; varying vec3 vWorld;
    #include <fog_pars_fragment>
    vec2 hash2(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
    vec2 ripple(vec2 p, float t) {
      vec2 cell = floor(p), f = fract(p) - 0.5, h = hash2(cell);
      vec2 d = f - (h - 0.5) * 0.6;
      float ph = fract(t * 1.3 + h.x * 7.0), r = length(d);
      float ring = sin(clamp((r - ph * 0.45) * 40.0, -3.1416, 3.1416)) * (1.0 - ph) * smoothstep(0.5, 0.1, r);
      return d / max(r, 1e-3) * ring;
    }
    void main() {
      float rough = texture2D(tRough, vec2(vWorld.x / (2.0 * rh) + 0.5, vWorld.z / 50.0)).r;
      float wet = 1.0 - smoothstep(0.08, 0.45, rough);
      vec2 rp = ripple(vWorld.xz * 1.7, time) + ripple(vWorld.xz * 2.4 + 17.0, time * 1.13);
      vec4 uv = vUv;
      uv.xy += rp * 0.018 * uv.w;
      float sp = mix(0.03, 0.005, wet) * uv.w;
      vec3 refl = texture2DProj(tDiffuse, uv + vec4(0.0, -1.5 * sp, 0.0, 0.0)).rgb
                + texture2DProj(tDiffuse, uv + vec4(0.0, -0.5 * sp, 0.0, 0.0)).rgb
                + texture2DProj(tDiffuse, uv + vec4(0.0, 0.5 * sp, 0.0, 0.0)).rgb
                + texture2DProj(tDiffuse, uv + vec4(0.0, 1.5 * sp, 0.0, 0.0)).rgb;
      refl *= 0.25;
      vec3 V = normalize(cameraPosition - vWorld);
      float fres = 0.3 + 0.7 * pow(1.0 - max(V.y, 0.0), 4.0);
      float grain = hash2(floor(vWorld.xz * 40.0)).x;
      vec3 base = vec3(0.010, 0.011, 0.014) * (0.6 + 0.8 * rough) * (0.85 + 0.3 * grain);
      gl_FragColor = vec4(base + refl * fres * mix(0.5, 1.0, wet) * color, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
};
const road = new Reflector(new THREE.PlaneGeometry(2 * RH, 560), {
  shader: roadShader, textureWidth: Math.round(W * 0.5), textureHeight: Math.round(H * 0.5),
  clipBias: 0.003, color: 0xffffff, multisample: 0,
});
road.material.fog = true;
road.material.uniforms.tRough.value = ROAD_ROUGH;
road.material.uniforms.time = RAIN_T;
road.rotation.x = -Math.PI / 2;
scene.add(road);

{
  const g = new THREE.PlaneGeometry(700, LEN);
  g.rotateX(-Math.PI / 2); g.translate(0, -0.04, LEN / 2);
  addGeo('ground', MAT.concrete, g);
}

// ---------------------------------------------------------------- sidewalks, curbs, median, markings, crossings
for (const [a, b] of SEGS) {
  const L = b - a, zc = (a + b) / 2;
  for (const s of [1, -1]) {
    box(MAT.walk, 'walk', SW, 0.22, L, s * (RH + SW / 2), 0.11, zc);
    const curb = box(MAT.curb, 'curb', 0.22, 0.26, L, s * (RH + 0.11), 0.13, zc);
    faceScale(curb, 0, L / 2, 1); faceScale(curb, 1, L / 2, 1); setFaceUV(curb, 2, 0.25, 0.5);
    plane(MAT.mark, 'mark', 0.14, L - 2, s * (RH - 0.4), 0.012, zc, 0, -Math.PI / 2);
    for (let z = a + 3; z < b - 3; z += 9) plane(MAT.mark, 'mark', 0.13, 3, s * 3.45, 0.012, z + 1.5, 0, -Math.PI / 2);
  }
  const med = box(MAT.curb, 'curb', 0.6, 0.34, L - 2, 0, 0.17, zc);
  faceScale(med, 0, (L - 2) / 2, 1); faceScale(med, 1, (L - 2) / 2, 1); setFaceUV(med, 2, 0.25, 0.5);
}
for (const c of CROSS) {
  for (const s of [1, -1]) {
    const g = plane(ROAD_MAT, 'xroad', 150, 2 * CW, s * (RH + 75), 0.0, c, 0, -Math.PI / 2);
    for (const zz of [c - CW - 1.9, c + CW + 1.9]) {
      for (let x = 0.9; x < RH - 0.5; x += 1.15) plane(MAT.mark, 'mark', 0.55, 2.8, s * x, 0.013, zz, 0, -Math.PI / 2);
    }
    // traffic signals at the corners: green for the main road, red for the cross street
    for (const zz of [c - CW - 0.8, c + CW + 0.8]) {
      const x = s * (RH + 0.7);
      box(MAT.pole, 'pole', 0.16, 4.6, 0.16, x, 2.3, zz);
      box(MAT.frame, 'frame', 0.42, 1.2, 0.42, x, 4.6, zz);
      sglow('#30ff8a', 1.6, x, 4.3, zz + (zz < c ? -0.25 : 0.25), 1.4);
      sglow('#ff2a2a', 1.4, x + (s * 0.25), 4.9, zz, 1.2);
    }
  }
  decal(0, 0.02, c, 2 * RH, 2 * CW, '#ffb070', 0.18);
}

// ---------------------------------------------------------------- street lamps on the median (double arm), light cones, pools
const CONE_MAT = new THREE.ShaderMaterial({
  uniforms: { col: { value: new THREE.Color('#ffae5c') }, k: { value: 0.16 }, fogD: FOG_D },
  vertexShader: `varying float vH; varying vec3 vN; varying vec3 vV; varying float vFog; uniform float fogD;
    void main() {
      vH = uv.y;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vN = normalize(mat3(modelMatrix) * normal);
      vV = normalize(cameraPosition - wp.xyz);
      vFog = exp(-pow(length(cameraPosition - wp.xyz) * fogD, 2.0));
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: `uniform vec3 col; uniform float k; varying float vH; varying vec3 vN; varying vec3 vV; varying float vFog;
    void main() { float e = pow(abs(dot(normalize(vN), normalize(vV))), 2.0); gl_FragColor = vec4(col * pow(vH, 1.5) * e * k * vFog, 1.0); }`,
  blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide,
});
CONE_MAT.userData.layer = 1;
const LAMP_X = 3.1, LAMP_Y = 8.75;
const LAMPS = [];
for (let z = 6; z < LEN; z += 31.25) if (!nearCross(z, CW + 3)) LAMPS.push(z);
for (const z of LAMPS) {
  box(MAT.pole, 'pole', 0.22, 9.1, 0.22, 0, 4.55, z);
  for (const s of [1, -1]) {
    box(MAT.pole, 'pole', LAMP_X + 0.2, 0.1, 0.1, s * LAMP_X / 2, 9.05, z);
    box(MAT.lampHead, 'lamphead', 1.0, 0.16, 0.38, s * LAMP_X, 8.92, z);
    sglow('#ffb15c', 3.2, s * LAMP_X, LAMP_Y, z, 0.75);
    sglow('#fff0d0', 1.1, s * LAMP_X, LAMP_Y, z, 1.4);
    decal(s * 3.0, 0.02, z, 11, 12, '#ff9440', 0.36);
    const cone = new THREE.CylinderGeometry(0.4, 3.6, LAMP_Y, 20, 1, true);
    cone.translate(s * LAMP_X, LAMP_Y / 2, z);
    addGeo('cone', CONE_MAT, cone);
  }
}
// Distance from any z to the nearest lamp, so the rain shader can light drops inside the cones.
const lampDist = new Float32Array(1024);
for (let i = 0; i < 1024; i++) {
  let best = 99;
  for (const lz of LAMPS) for (const off of [-LEN, 0, LEN]) {
    const d = i - (lz + off);
    if (Math.abs(d) < Math.abs(best)) best = d;
  }
  lampDist[i] = best;
}
const LAMP_TEX = new THREE.DataTexture(lampDist, 1024, 1, THREE.RedFormat, THREE.FloatType);
LAMP_TEX.needsUpdate = true;
