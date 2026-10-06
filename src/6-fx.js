// ---------------------------------------------------------------- rain: camera-locked volumes of streaks, lit by lamp cones and the headlight
const RAIN_U = {
  time: RAIN_T, flash: SKY_U.flash, fogD: FOG_D,
  camPos: { value: new THREE.Vector3() }, camVel: { value: new THREE.Vector3() },
  res: { value: new THREE.Vector2(W, H) }, lampTex: { value: LAMP_TEX }, len: { value: LEN },
  headPos: { value: new THREE.Vector3(0, -99, 0) }, headDir: { value: new THREE.Vector3(0, 0, 1) },
  rain: { value: 1 },
};
const RAIN_LIGHT = `
  uniform sampler2D lampTex; uniform float len, flash; uniform vec3 headPos, headDir;
  vec3 rainLight(vec3 p) {
    float zm = mod(p.z, len);
    float dz = texture2D(lampTex, vec2((floor(zm) + 0.5) / 1024.0, 0.5)).r;
    float dx = abs(abs(p.x) - ${LAMP_X.toFixed(2)});
    float hgt = clamp((${LAMP_Y.toFixed(2)} - p.y) / ${LAMP_Y.toFixed(2)}, 0.0, 1.0);
    float r = 0.4 + hgt * 3.3;
    float cone = p.y < ${LAMP_Y.toFixed(2)} ? smoothstep(r, r * 0.15, length(vec2(dx, dz))) * (1.3 - 0.6 * hgt) : 0.0;
    vec3 hp = p - headPos; float hd = dot(hp, headDir);
    float beam = hd > 0.0 ? smoothstep(0.82, 0.97, hd / max(length(hp), 1e-3)) * exp(-hd * 0.06) : 0.0;
    return vec3(0.5, 0.58, 0.72) * 0.3 + vec3(1.0, 0.6, 0.28) * cone * 2.6 + vec3(1.0, 0.95, 0.85) * beam * 2.2 + vec3(0.7, 0.75, 1.0) * flash * 1.3;
  }`;
function rainLayer(count, size, width, alpha, groundBased) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const seed = new Float32Array(count * 4);
  for (let i = 0; i < seed.length; i++) seed[i] = R();
  g.setAttribute('seed', new THREE.InstancedBufferAttribute(seed, 4));
  g.instanceCount = count;
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...RAIN_U, box: { value: size }, width: { value: width }, alpha: { value: alpha }, gb: { value: groundBased ? 1 : 0 } },
    vertexShader: `attribute vec4 seed;
      uniform float time, width, alpha, fogD, gb, rain; uniform vec3 camPos, camVel, box; uniform vec2 res;
      varying float vA; varying vec2 vC; varying vec3 vCol;
      ${RAIN_LIGHT}
      void main() {
        float spd = 9.5 * (0.8 + 0.4 * seed.w);
        vec3 vel = vec3(1.1, -spd, 0.4);
        vec3 org = camPos - box * vec3(0.5, 0.35, 0.5);
        if (gb > 0.5) org.y = -0.5;
        vec3 p = org + mod(seed.xyz * box + vel * time - org, box);
        vec3 tail = p - (vel - camVel) * 0.04;
        vec4 a = projectionMatrix * viewMatrix * vec4(p, 1.0);
        vec4 b = projectionMatrix * viewMatrix * vec4(tail, 1.0);
        float ok = step(0.15, a.w) * step(0.15, b.w);
        a.w = max(a.w, 0.15); b.w = max(b.w, 0.15);
        vec2 d = (b.xy / b.w - a.xy / a.w) * res;
        vec2 n = normalize(vec2(-d.y, d.x) + vec2(1e-4, 0.0));
        float px = width * projectionMatrix[1][1] * res.y * 0.5 / a.w;
        float thin = min(1.0, px / 1.1);
        px = max(px, 1.1);
        vec4 pos = mix(a, b, position.y);
        pos.xy += n * position.x * px / res * pos.w;
        float dist = length(p - camPos);
        vCol = rainLight(p);
        vA = alpha * rain * ok * thin * exp(-pow(dist * fogD * 1.6, 2.0)) * step(0.05, p.y) * smoothstep(0.5, 1.8, dist);
        vC = position.xy;
        gl_Position = ok > 0.5 ? pos : vec4(0.0, 0.0, 2.0, 1.0);
      }`,
    fragmentShader: `varying float vA; varying vec2 vC; varying vec3 vCol;
      void main() { float a = vA * sin(vC.y * 3.1416) * (1.0 - vC.x * vC.x); gl_FragColor = vec4(vCol * a, 1.0); }`,
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.layers.set(1);
  mesh.renderOrder = 4;
  scene.add(mesh);
  return mesh;
}
rainLayer(11000, new THREE.Vector3(26, 14, 26), 0.013, 1.0, false);
rainLayer(16000, new THREE.Vector3(110, 34, 110), 0.022, 0.6, true);

// ground splashes: tiny crowns that pop and fade around the camera
{
  const count = 2400, g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const seed = new Float32Array(count * 4);
  for (let i = 0; i < seed.length; i++) seed[i] = R();
  g.setAttribute('seed', new THREE.InstancedBufferAttribute(seed, 4));
  g.instanceCount = count;
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...RAIN_U },
    vertexShader: `attribute vec4 seed; uniform float time, fogD, rain; uniform vec3 camPos;
      varying float vA; varying vec2 vC; varying vec3 vCol; varying float vPh;
      ${RAIN_LIGHT}
      void main() {
        float period = 0.35 + seed.w * 0.3;
        float tt = time / period + seed.z * 17.0, cyc = floor(tt), ph = fract(tt);
        vec2 h = fract(sin(vec2(cyc * 12.9898 + seed.x * 78.233, cyc * 39.346 + seed.y * 11.135)) * 43758.5453);
        vec2 xz = camPos.xz + (h - 0.5) * vec2(30.0, 30.0);
        float ax = abs(xz.x);
        float y = ax > ${FACE.toFixed(1)} ? -50.0 : (ax > ${RH.toFixed(1)} ? 0.225 : 0.0);
        vec3 p = vec3(xz.x, y, xz.y);
        float sz = 0.03 + 0.05 * ph;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        mv.xy += position.xy * vec2(sz, sz * 0.9);
        float dist = -mv.z;
        vCol = rainLight(p + vec3(0.0, 0.3, 0.0));
        vA = rain * (1.0 - ph) * exp(-pow(dist * fogD * 2.0, 2.0)) * smoothstep(0.3, 1.5, dist);
        vC = position.xy; vPh = ph;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vA; varying vec2 vC; varying vec3 vCol; varying float vPh;
      void main() {
        float r = length(vec2(vC.x, vC.y * 1.5));
        float crown = smoothstep(0.16, 0.0, abs(r - 0.35 - 0.45 * vPh)) * step(0.02, vC.y);
        gl_FragColor = vec4(vCol * crown * vA * 1.3, 1.0);
      }`,
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.layers.set(1);
  mesh.renderOrder = 4;
  scene.add(mesh);
}
camera.layers.enable(1);

// ---------------------------------------------------------------- post: bloom, tone map, grade (chromatic fringe, vignette, grain, fades)
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: DEMO ? 4 : 0 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.6, 0.5, 0.95);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, res: { value: new THREE.Vector2(W, H) }, fade: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, fade; uniform vec2 res; varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5; float r2 = dot(c, c);
      vec2 off = c * r2 * 0.014;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, col * vec3(0.82, 0.98, 1.12), (1.0 - smoothstep(0.0, 0.45, l)) * 0.55);
      col *= 1.0 - r2 * 1.1;
      col += (hash(floor(vUv * res) + fract(time * 7.13) * 91.0) - 0.5) * 0.03;
      gl_FragColor = vec4(col * (1.0 - fade), 1.0);
    }`,
});
composer.addPass(grade);

// ---------------------------------------------------------------- lightning
function lightningLevel(t, strikes) {
  let f = 0;
  for (const s of strikes) {
    const u = t - s;
    if (u < 0 || u > 1.2) continue;
    f = Math.max(f, Math.exp(-u * 9) * 1.0, u > 0.13 ? Math.exp(-(u - 0.13) * 7) * 0.75 : 0, u > 0.32 ? Math.exp(-(u - 0.32) * 5) * 0.45 : 0);
  }
  return f;
}
function applyFlash(f) {
  SKY_U.flash.value = f;
  hemi.intensity = 0.35 + f * 2.5;
  moon.intensity = f * 3.5;
  renderer.toneMappingExposure = 1.1 + f * 0.6;
}
