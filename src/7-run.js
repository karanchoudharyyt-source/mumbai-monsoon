// ---------------------------------------------------------------- HUD
const hud = document.createElement('canvas');
hud.width = W; hud.height = H;
hud.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none';
document.body.appendChild(hud);
const hg = hud.getContext('2d');
const MONO = "FreeMono, \"DejaVu Sans Mono\", Consolas, monospace";
const fare = (d) => 26 + Math.floor(d / 22);
function rrect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function drawHud(o, g = hg, clear = true) {
  if (clear) g.clearRect(0, 0, W, H);
  // Shorter side keeps the HUD and title cards inside portrait phone screens.
  const S = Math.min(W, H) / 1080, m = TOUCH ? 24 : 0;
  if (o.hud > 0.01) {
    g.globalAlpha = o.hud;
    const cx = 150 * S + m, cy = TOUCH ? 120 * S + 12 : H - 140 * S, r = 88 * S, kmh = Math.abs(o.v) * 3.6;
    g.fillStyle = 'rgba(8,10,14,0.55)';
    g.beginPath(); g.arc(cx, cy, r + 22 * S, 0, Math.PI * 2); g.fill();
    g.lineCap = 'round'; g.lineWidth = 9 * S;
    g.strokeStyle = 'rgba(255,255,255,0.16)';
    g.beginPath(); g.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25); g.stroke();
    g.strokeStyle = '#ffc21a';
    g.beginPath(); g.arc(cx, cy, r, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * clamp(kmh / 80))); g.stroke();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `bold ${58 * S}px ${MONO}`; g.fillText(String(Math.round(kmh)), cx, cy - 4 * S);
    g.font = `${20 * S}px ${FONT}`; g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillText('km/h', cx, cy + 40 * S);

    const bx = W - 330 * S - m, by = TOUCH ? 12 + 6 * S : H - 196 * S, bw = 272 * S, bh = 128 * S;
    g.fillStyle = 'rgba(8,10,14,0.72)'; rrect(g, bx, by, bw, bh, 14 * S); g.fill();
    g.strokeStyle = 'rgba(255,194,26,0.85)'; g.lineWidth = 2.5 * S; rrect(g, bx, by, bw, bh, 14 * S); g.stroke();
    g.textAlign = 'left'; g.fillStyle = 'rgba(255,255,255,0.65)'; g.font = `bold ${18 * S}px ${FONT}`;
    g.fillText('METER', bx + 20 * S, by + 26 * S);
    g.textAlign = 'right'; g.fillText((o.dist / 1000).toFixed(2) + ' km', bx + bw - 20 * S, by + 26 * S);
    g.textAlign = 'left'; g.fillStyle = '#ff3b30'; g.shadowColor = '#ff3b30'; g.shadowBlur = 14 * S;
    g.font = `bold ${62 * S}px ${MONO}`; g.fillText('₹' + fare(o.dist) + '.00', bx + 18 * S, by + 82 * S);
    g.shadowBlur = 0;
    if (o.horn > 0) {
      g.globalAlpha = o.hud * clamp(o.horn * 2);
      g.textAlign = 'center'; g.fillStyle = '#ffc21a'; g.font = `bold ${46 * S}px ${FONT}`;
      g.fillText('PEEP PEEP!', W / 2, TOUCH ? H * 0.68 : H - 120 * S);
    }
    g.globalAlpha = 1;
  }
  for (const card of o.cards || []) {
    if (card.a <= 0.01) continue;
    g.globalAlpha = card.a; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = 24 * S;
    g.fillStyle = '#ffffff'; g.font = `bold ${card.size * S}px ${FONT}`;
    if (g.letterSpacing !== undefined) g.letterSpacing = `${card.track * S}px`;
    g.fillText(card.text, W / 2, card.y * S);
    if (card.sub) {
      if (g.letterSpacing !== undefined) g.letterSpacing = `${2 * S}px`;
      g.fillStyle = card.subColor || 'rgba(255,255,255,0.85)'; g.font = `${card.subSize * S}px ${FONT}`;
      g.fillText(card.sub, W / 2, (card.y + card.size * 0.95) * S);
    }
    if (g.letterSpacing !== undefined) g.letterSpacing = '0px';
    g.shadowBlur = 0; g.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- shared per-frame update
function placePlayerMesh() {
  const p = player;
  playerG.position.set(p.x, Math.sin(p.dist * 2.3) * 0.012 + p.bump * Math.sin(p.dist * 9) * 0.04, p.z);
  playerG.rotation.set(p.pitch, p.yaw, p.roll, 'YXZ');
  playerG.updateMatrixWorld(true);
}
function updateWorld(t, camVel) {
  RAIN_T.value = t;
  RAIN_U.camPos.value.copy(camera.position);
  RAIN_U.camVel.value.copy(camVel);
  const h = anchor(player.x, player.z, player.yaw, PM.heads[0]);
  RAIN_U.headPos.value.set(...h);
  RAIN_U.headDir.value.set(Math.sin(player.yaw), -0.06, Math.cos(player.yaw)).normalize();
  placeCity(camera.position.z);
  sky.position.copy(camera.position);
  road.position.set(0, 0, camera.position.z);
  grade.uniforms.time.value = t;
  applyVehicles(camera.position);
}
const _v = new THREE.Vector3();
function rideCam(lx, ly, lz) { return playerG.localToWorld(_v.set(lx, ly, lz)).clone(); }

// ---------------------------------------------------------------- cinematic mode: simulate once, then render any frame on demand
const FPS = 30, SIM = 120, T_END = 36;
const frames = [], hornTimes = [], STRIKES = [12.6, 30.4];
let shots = [];
function snapshot() {
  const p = player;
  const tr = new Float32Array(traffic.length * 5);
  traffic.forEach((c, i) => tr.set([c.x, c.tx, c.z, c.v, c.brake], i * 5));
  return { p: [p.x, p.z, p.yaw, p.v, p.steer, p.roll, p.pitch, p.bump, p.dist, p.acc, p.cyaw, p.cx, p.horn], tr };
}
function restore(f) {
  const p = player;
  [p.x, p.z, p.yaw, p.v, p.steer, p.roll, p.pitch, p.bump, p.dist, p.acc, p.cyaw, p.cx, p.horn] = f.p;
  traffic.forEach((c, i) => { [c.x, c.tx, c.z, c.v, c.brake] = f.tr.subarray(i * 5, i * 5 + 5); });
}
const P = (t) => {
  const a = frames[clamp(Math.round(t * FPS), 0, frames.length - 1)].p;
  return { x: a[0], z: a[1], yaw: a[2], v: a[3], bump: a[7], cyaw: a[10], cx: a[11] };
};
function simulate() {
  player.cyaw = 0; player.cx = player.x;
  let lastHorn = -9;
  for (let i = 0; i <= T_END * SIM; i++) {
    if (i % (SIM / FPS) === 0) frames.push(snapshot());
    const inp = autopilot(1 / SIM);
    if (inp.horn && i / SIM > 5 && i / SIM - lastHorn > 9) { lastHorn = i / SIM; hornTimes.push(lastHorn); player.horn = 1; }
    stepPlayer(1 / SIM, inp);
    stepTraffic(1 / SIM);
    player.cyaw = lerp(player.cyaw, player.yaw, 3 / SIM);
    player.cx = lerp(player.cx, player.x, 4 / SIM);
  }
}
function V(x, y, z) { return new THREE.Vector3(x, y, z); }
function chase(t, back, up, ahead, lookUp, fov, xoff = 0) {
  const p = P(t), fx = Math.sin(p.cyaw), fz = Math.cos(p.cyaw);
  const shake = p.bump * 0.06 * Math.sin(t * 40);
  return { pos: V(p.cx - fx * back + xoff, up + shake, p.z - fz * back), look: V((p.x + p.cx) / 2 + fx * ahead, lookUp, p.z + fz * ahead), fov: fov + p.v * 0.35 };
}
function buildShots(tF) {
  const tA = 4.6, tB = 12.0, tC = 16.2, tD = tF + 1.1, tE = tD + 5.6;
  const e = P(tA);
  return [
    { t0: 0, t1: tA, hud: 0, f: (t) => {
      const p = P(t), cam = V(RH - 0.4, 0.5, e.z + 1.0);
      return { pos: cam, look: V(lerp(p.x, e.x, 0.3), 0.95, Math.min(p.z + 1, cam.z - 7)), fov: 34 };
    } },
    { t0: tA, t1: tB, hud: 1, f: (t) => chase(t, 6.2, 2.3, 8, 1.15, 52, 0.6) },
    { t0: tB, t1: tC, hud: 0, f: (t) => {
      const p = P(t), u = (t - tB) / (tC - tB);
      return { pos: V(p.x - 0.5, 1.05 + u * 0.15, p.z + 6.8 - u * 1.2), look: V(p.x - 0.1, 1.05, p.z + 0.2), fov: 30 };
    } },
    { t0: tC, t1: tD, hud: 1, f: (t) => chase(t, 5.5, 0.85, 14, 3.4, 48, 0.3) },
    { t0: tD, t1: tE, hud: 1, f: (t) => {
      const sway = Math.sin(t * 1.7) * 0.012;
      return { pos: rideCam(0, 1.48 + sway, 0.36), look: rideCam(0, 0.7, 9), fov: 72 };
    } },
    { t0: tE, t1: T_END, hud: 0, f: (t) => {
      const s0 = P(tE), p = P(t), u = (t - tE) / (T_END - tE), k = ease(clamp(u * 1.25));
      const pos = V(lerp(s0.x - 0.3, 0.5, k), lerp(2.6, 31, k), s0.z - 6.5 + (t - tE) * 7.5);
      const look = V(lerp(p.x, 0, k), lerp(1.1, 0, k), lerp(p.z + 4, p.z + 95, k));
      return { pos, look, fov: lerp(52, 44, k) };
    } },
  ];
}
function shotAt(t) {
  const s = shots.find((x) => t >= x.t0 && t < x.t1) || shots[shots.length - 1];
  return { ...s.f(t), hud: s.hud, s };
}
function cardsAt(t) {
  const fade = (a, b, c, d) => smooth((t - a) / (b - a)) * (1 - smooth((t - c) / (d - c)));
  return [
    { text: 'MUMBAI MONSOON', size: 96, track: 14, y: 470, sub: 'an auto-rickshaw game in one HTML file', subSize: 30, a: fade(0.6, 1.4, 3.6, 4.4) },
    { text: 'MUMBAI MONSOON', size: 84, track: 12, y: 440, sub: 'one HTML file · three.js · built with Droid', subSize: 30, subColor: '#ffc21a', a: fade(32.4, 33.3, 40, 41) },
  ];
}
function frameAt(t) {
  restore(frames[clamp(Math.round(t * FPS), 0, frames.length - 1)]);
  placePlayerMesh();
  updateCockpit(t);
  const sh = shotAt(t), prev = shotAt(Math.max(0, t - 1 / FPS));
  camera.position.copy(sh.pos); camera.up.set(0, 1, 0); camera.lookAt(sh.look);
  camera.fov = sh.fov; camera.updateProjectionMatrix();
  const vel = prev.s === sh.s ? sh.pos.clone().sub(prev.pos).multiplyScalar(FPS) : V(0, 0, 0);
  applyFlash(lightningLevel(t, STRIKES));
  updateWorld(t, vel.length() > 60 ? V(0, 0, 0) : vel);
  grade.uniforms.fade.value = smooth((t - 35.2) / 0.8);
  composer.render();
  const sw = clamp((t - sh.s.t0) / 0.25) * clamp((sh.s.t1 - t) / 0.25);
  return { hud: sh.hud * sw, v: player.v, dist: player.dist, horn: player.horn, cards: cardsAt(t) };
}

// ---------------------------------------------------------------- game mode: keyboard, chase/ride/cinema cameras, audio
const keys = {};
let camMode = 0, autoMode = false, audio = null, gameT = 0, nextStrike = 14, strikes = [];
function initAudio() {
  if (audio) return;
  const ac = new AudioContext();
  const noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const rain = ac.createBufferSource(); rain.buffer = noise; rain.loop = true;
  const rf = ac.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 2400; rf.Q.value = 0.4;
  const rg = ac.createGain(); rg.gain.value = 0.22;
  rain.connect(rf).connect(rg).connect(ac.destination); rain.start();
  const eng = ac.createOscillator(); eng.type = 'sawtooth';
  const ef = ac.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 600;
  const eg = ac.createGain(); eg.gain.value = 0.05;
  const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 22; lg.gain.value = 0.04;
  lfo.connect(lg).connect(eg.gain); lfo.start();
  eng.connect(ef).connect(eg).connect(ac.destination); eng.start();
  const horn = ac.createGain(); horn.gain.value = 0; horn.connect(ac.destination);
  for (const f of [415, 520]) { const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(horn); o.start(); }
  const thunder = ac.createBufferSource(); thunder.buffer = noise; thunder.loop = true;
  const tf = ac.createBiquadFilter(); tf.type = 'lowpass'; tf.frequency.value = 160;
  const tg = ac.createGain(); tg.gain.value = 0;
  thunder.connect(tf).connect(tg).connect(ac.destination); thunder.start();
  audio = { ac, eng, lfo, horn, tg };
}
function press(code) {
  keys[code] = true;
  initAudio();
  // Mobile browsers only let audio start inside a user gesture.
  if (audio.ac.state !== 'running') audio.ac.resume();
  if (code === 'KeyC') camMode = (camMode + 1) % 3;
  if (code === 'KeyP') { autoMode = !autoMode; player.ap = null; }
  if (code === 'KeyH') player.horn = 1;
}
addEventListener('keydown', (e) => { if (!e.repeat) press(e.code); });
addEventListener('keyup', (e) => { keys[e.code] = false; });
if (TOUCH) {
  const css = document.createElement('style');
  css.textContent = `
    body { touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
    .tb { position: fixed; display: flex; align-items: center; justify-content: center; box-sizing: border-box;
      border-radius: 50%; background: rgba(8,10,14,.5); border: 2px solid rgba(255,194,26,.75);
      color: #fff; font: bold 13px Arial, sans-serif; letter-spacing: 1px; }
    .tb.on { background: rgba(255,194,26,.6); color: #111; }
    .tb.pill { border-radius: 18px; width: 64px; height: 34px; font-size: 12px; top: calc(12px + env(safe-area-inset-top)); }
    @media (orientation: portrait) { .tb.pill { top: calc(104px + env(safe-area-inset-top)); } }`;
  document.head.appendChild(css);
  const B = 'calc(18px + env(safe-area-inset-bottom))', L = 'env(safe-area-inset-left)', Rt = 'env(safe-area-inset-right)';
  const buttons = [
    ['◀', 'KeyA', `left:calc(16px + ${L});bottom:${B};width:78px;height:78px;font-size:26px`],
    ['▶', 'KeyD', `left:calc(106px + ${L});bottom:${B};width:78px;height:78px;font-size:26px`],
    ['GAS', 'KeyW', `right:calc(16px + ${Rt});bottom:${B};width:94px;height:94px;font-size:16px`],
    ['BRAKE', 'KeyS', `right:calc(122px + ${Rt});bottom:${B};width:70px;height:70px;font-size:11px`],
    ['HORN', 'KeyH', `right:calc(30px + ${Rt});bottom:calc(126px + env(safe-area-inset-bottom));width:66px;height:66px;font-size:11px`],
    ['CAM', 'KeyC', 'left:calc(50% - 70px)', 'pill'],
    ['AUTO', 'KeyP', 'left:calc(50% + 6px)', 'pill'],
  ];
  for (const [label, code, pos, cls] of buttons) {
    const b = document.createElement('div');
    b.className = cls ? `tb ${cls}` : 'tb';
    b.textContent = label;
    b.style.cssText = pos;
    const release = () => { keys[code] = false; if (code !== 'KeyP') b.classList.remove('on'); };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      press(code);
      b.classList.toggle('on', code === 'KeyP' ? autoMode : true);
    });
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    document.body.appendChild(b);
  }
}
addEventListener('resize', () => {
  if (DEMO) return;
  W = innerWidth; H = innerHeight;
  renderer.setSize(W, H); composer.setSize(W, H);
  camera.aspect = W / H; camera.updateProjectionMatrix();
  hud.width = W; hud.height = H;
  RAIN_U.res.value.set(W, H); grade.uniforms.res.value.set(W, H);
});
const camSm = { pos: new THREE.Vector3(), look: new THREE.Vector3(), init: false };
function gameCamera(dt) {
  const p = player, fx = Math.sin(p.cyaw), fz = Math.cos(p.cyaw);
  let pos, look, fov;
  if (camMode === 1) { pos = rideCam(0, 1.48, 0.36); look = rideCam(0, 0.6, 9); fov = 74; }
  else if (camMode === 2) { pos = V(p.x - 1.9, 0.8, p.z + 7.6); look = V(p.x - 0.15, 1.05, p.z + 0.2); fov = 30; }
  else { pos = V(p.cx - fx * 6.2, 2.45, p.z - fz * 6.2); look = V((p.x + p.cx) / 2 + fx * 8, 1.15, p.z + fz * 8); fov = 52 + p.v * 0.35; }
  if (camera.aspect < 1 && camMode !== 1) fov = Math.min(95, fov * (1 + 0.6 * (1 - camera.aspect)));
  if (!camSm.init || camMode) { camSm.pos.copy(pos); camSm.look.copy(look); camSm.init = camMode === 0; }
  const prev = camSm.pos.clone();
  camSm.pos.lerp(pos, 1 - Math.exp(-dt * 12)); camSm.look.lerp(look, 1 - Math.exp(-dt * 12));
  camera.position.copy(camSm.pos).add(V(0, p.bump * 0.06 * Math.sin(gameT * 40), 0));
  camera.lookAt(camSm.look);
  camera.fov = fov; camera.updateProjectionMatrix();
  return camSm.pos.clone().sub(prev).multiplyScalar(1 / Math.max(dt, 1e-3));
}
let last = performance.now(), acc = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  gameT += dt; acc += dt;
  while (acc >= 1 / SIM) {
    const inp = autoMode ? autopilot(1 / SIM) : {
      throttle: keys.KeyW || keys.ArrowUp ? 1 : 0, brake: keys.KeyS || keys.ArrowDown ? 1 : 0,
      steer: (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0),
    };
    if (autoMode && inp.horn && player.horn <= 0) player.horn = 1;
    stepPlayer(1 / SIM, inp); stepTraffic(1 / SIM);
    player.cyaw = lerp(player.cyaw, player.yaw, 3 / SIM);
    player.cx = lerp(player.cx, player.x, 4 / SIM);
    acc -= 1 / SIM;
  }
  if (gameT > nextStrike) { strikes.push(gameT); nextStrike = gameT + rand(14, 30); if (audio) setTimeout(() => { audio.tg.gain.setTargetAtTime(0.9, audio.ac.currentTime, 0.05); audio.tg.gain.setTargetAtTime(0, audio.ac.currentTime + 0.6, 0.8); }, 700); }
  placePlayerMesh();
  updateCockpit(gameT);
  const vel = gameCamera(dt);
  applyFlash(lightningLevel(gameT, strikes.slice(-2)));
  updateWorld(gameT, vel);
  composer.render();
  drawHud({ hud: 1, v: player.v, dist: player.dist, horn: player.horn, cards: [{
    text: 'MUMBAI MONSOON', size: 80, track: 12, y: H / Math.min(W, H) * 1080 * 0.39,
    sub: TOUCH ? 'hold GAS to drive · AUTO to cruise' : 'W to drive · P for autopilot · C to change camera',
    subSize: TOUCH ? 40 : 28, a: 1 - smooth((gameT - 3) / 1.5) }] });
  if (audio) {
    const v = Math.abs(player.v);
    audio.eng.frequency.setTargetAtTime(38 + v * 5.5, audio.ac.currentTime, 0.1);
    audio.lfo.frequency.setTargetAtTime(14 + v * 1.6, audio.ac.currentTime, 0.1);
    audio.horn.gain.setTargetAtTime(player.horn > 0.5 || keys.KeyH ? 0.06 : 0, audio.ac.currentTime, 0.02);
  }
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- boot
initTraffic();
if (DEMO) {
  simulate();
  let tF = 20.6;
  for (const dt of [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2]) {
    const zm = ((P(20.6 + dt).z + 1.5) % LEN + LEN) % LEN;
    if (!nearCross(zm, CW + 18) && !LAMPS.some((l) => Math.abs(l - zm) < 5)) { tF = 20.6 + dt; break; }
  }
  buildFOB(((P(tF).z + 1.5) % LEN + LEN) % LEN);
  finalizeCity();
  shots = buildShots(tF);
  const cap = document.createElement('canvas');
  cap.width = W; cap.height = H;
  const cg = cap.getContext('2d');
  window.demoInfo = { tF, hornTimes, strikes: STRIKES, duration: T_END, fps: FPS, speeds: frames.map((f) => f.p[3]) };
  window.renderAt = (t) => {
    const o = frameAt(t);
    cg.drawImage(renderer.domElement, 0, 0);
    drawHud(o, cg, false);
    return cap.toDataURL('image/jpeg', 0.92);
  };
  window.dbg = (t) => { const sh = shotAt(t); const f = frames[clamp(Math.round(t * FPS), 0, frames.length - 1)]; return { hud: sh.hud, t0: sh.s.t0, t1: sh.s.t1, dist: f.p[8], z: f.p[1], v: f.p[3], n: frames.length, shots: shots.map((s) => [s.t0, s.t1, s.hud]) }; };
  window.dev = { P, traffic, restore, frames, TYPES, player };
  // reports frames where a shot's camera ends up inside a traffic vehicle
  window.camCheck = () => {
    const bad = [];
    for (let i = 0; i < frames.length; i++) {
      const t = i / FPS; restore(frames[i]);
      const c = shotAt(t).pos;
      for (const v of traffic) {
        const T = TYPES[v.type], hgt = v.type === 'bus' ? 4.6 : v.type === 'truck' ? 3.4 : 1.9;
        if (Math.abs(c.x - v.x) < T.m.wid / 2 + 0.3 && Math.abs(c.z - v.z) < T.m.len / 2 + 0.3 && c.y < hgt) bad.push([+t.toFixed(2), v.type]);
      }
    }
    return bad;
  };
  hud.remove();
  window.ready = true;
} else {
  buildFOB(470);
  finalizeCity();
  player.cyaw = 0; player.cx = player.x;
  requestAnimationFrame(loop);
}
