// Synthesizes the soundtrack for the cinematic cut: rain bed, hood patter, auto-rickshaw engine,
// horns, wiper thunks and thunder, timed from demo-info.json. Writes a 48 kHz stereo WAV.
// Usage: node audio.js out.wav
const fs = require('fs');
const info = JSON.parse(fs.readFileSync(__dirname + '/demo-info.json', 'utf8'));
const SR = 48000, DUR = info.duration, N = DUR * SR;
const L = new Float32Array(N), R = new Float32Array(N);

let seed = 20240711;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };

// RBJ biquad
function biquad(type, f, q = 0.707) {
  const w = 2 * Math.PI * f / SR, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
  else { b0 = a; b1 = 0; b2 = -a; }
  a0 = 1 + a; a1 = -2 * c; a2 = 1 - a;
  const k = [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => {
    const y = k[0] * x + k[1] * x1 + k[2] * x2 - k[3] * y1 - k[4] * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

// shot boundaries from the cinematic cut
const tA = 4.6, tB = 12.0, tC = 16.2, tD = info.tF + 1.1, tE = tD + 5.6;
const speedAt = (t) => info.speeds[clamp(Math.round(t * info.fps), 0, info.speeds.length - 1)];
// how close the listener is to the rickshaw in each shot
function engineGain(t) {
  if (t < tA) { const d = Math.max(0, speedAt(t) * (tA - t)) + 1.5; return 0.9 / (1 + d / 3); }
  if (t < tB) return 0.42;
  if (t < tC) return 0.36;
  if (t < tD) return 0.44;
  if (t < tE) return 0.7;
  return 0.42 * (1 - smooth((t - tE) / 6.5)) + 0.04;
}
const inCab = (t) => smooth((t - tD) / 0.08) * (1 - smooth((t - tE) / 0.08));

// rain bed: decorrelated filtered noise per channel, plus a low city rumble
{
  const hpL = biquad('hp', 350), hpR = biquad('hp', 350), lpL = biquad('lp', 5200), lpR = biquad('lp', 5200);
  const rum = biquad('lp', 90), rum2 = biquad('lp', 90);
  const cabL = biquad('lp', 1400), cabR = biquad('lp', 1400);
  for (let i = 0; i < N; i++) {
    const t = i / SR, cab = inCab(t);
    let l = lpL(hpL(rnd() * 2 - 1)), r = lpR(hpR(rnd() * 2 - 1));
    // under the canvas hood the hiss gets duller
    const g = 0.2 * (1 - 0.45 * cab);
    l = l * (1 - cab) + cabL(l) * cab; r = r * (1 - cab) + cabR(r) * cab;
    const low = rum(rum2(rnd() * 2 - 1)) * 2.6;
    L[i] += l * g + low * 0.35; R[i] += r * g + low * 0.35;
  }
}

// droplets: tiny decaying pings; much denser and lower on the canvas hood inside the cab
function ping(t0, f, amp, decay, pan) {
  const i0 = Math.floor(t0 * SR), n = Math.floor(decay * 6 * SR);
  for (let j = 0; j < n && i0 + j < N; j++) {
    const e = Math.exp(-j / (decay * SR)), v = Math.sin(2 * Math.PI * f * j / SR) * e * amp;
    L[i0 + j] += v * (1 - pan); R[i0 + j] += v * pan;
  }
}
for (let t = 0; t < DUR; t += 1 / 260) {
  const tt = t + rnd() / 260;
  ping(tt, 2200 + rnd() * 4800, 0.01 + rnd() * 0.012, 0.004, rnd());
}
for (let t = tD; t < tE; t += 1 / 180) {
  const tt = t + rnd() / 180;
  ping(tt, 480 + rnd() * 700, 0.02 + rnd() * 0.03, 0.006, 0.2 + rnd() * 0.6);
}

// engine: a lumpy single-cylinder pulse train whose rate follows speed, with combustion noise
{
  const lp = biquad('lp', 950, 0.9), lp2 = biquad('lp', 1800), hp = biquad('hp', 40);
  let ph = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR, v = speedAt(t);
    const f0 = 19 + v * 1.55 + Math.sin(t * 7.3) * 0.6;
    ph += f0 / SR;
    if (ph >= 1) ph -= 1;
    const pulse = Math.exp(-ph * 9) * (1 + 0.35 * Math.sin(2 * Math.PI * ph * 3)) - 0.12;
    const rough = (rnd() * 2 - 1) * Math.exp(-ph * 5) * 0.6;
    let y = lp(pulse + rough) * 0.9 + lp2((rnd() * 2 - 1) * Math.exp(-ph * 14)) * 0.18;
    y = hp(y) * engineGain(t);
    L[i] += y; R[i] += y;
  }
}

// horns: the hero's double "peep", and distant traffic horns that make it sound like Mumbai
function horn(t0, f, len, amp, pan, beeps = 1, gap = 0.09) {
  const lp = biquad('lp', 2600);
  for (let b = 0; b < beeps; b++) {
    const s = t0 + b * (len + gap), i0 = Math.floor(s * SR), n = Math.floor((len + 0.25) * SR);
    for (let j = 0; j < n && i0 + j < N; j++) {
      const t = j / SR, env = smooth(t / 0.015) * (1 - smooth((t - len) / 0.04));
      const vib = 1 + 0.004 * Math.sin(t * 38);
      const sq = (x) => Math.sign(Math.sin(x)) * 0.6 + Math.sin(x) * 0.4;
      const v = lp(sq(2 * Math.PI * f * vib * t) + 0.7 * sq(2 * Math.PI * f * 1.26 * vib * t)) * env * amp;
      L[i0 + j] += v * (1 - pan); R[i0 + j] += v * pan;
    }
  }
}
for (const h of info.hornTimes) horn(h, 410, 0.16, 0.16, 0.5, 2);
for (const [t, f, a, p, n] of [[2.4, 330, 0.03, 0.2, 1], [7.1, 460, 0.035, 0.8, 2], [9.8, 250, 0.045, 0.3, 1],
  [15.0, 520, 0.03, 0.75, 3], [19.2, 300, 0.04, 0.25, 1], [24.6, 440, 0.03, 0.7, 2], [29.4, 360, 0.025, 0.4, 1]]) {
  horn(t, f, 0.28, a, p, n, 0.12);
}

// wiper: a soft rubber thunk at each end of its sweep while we sit in the cab
{
  const W = 2 * Math.PI / 1.25;
  for (let k = 0; ; k++) {
    const t = (Math.PI / 2 + k * Math.PI) / W;
    if (t > tE) break;
    if (t < tD) continue;
    const i0 = Math.floor(t * SR), side = k % 2 ? 0.35 : 0.65;
    for (let j = 0; j < 0.12 * SR && i0 + j < N; j++) {
      const v = Math.sin(2 * Math.PI * 95 * j / SR) * Math.exp(-j / (0.025 * SR)) * 0.22;
      L[i0 + j] += v * (1 - side); R[i0 + j] += v * side;
    }
  }
}

// thunder: a bright crack, then a long rolling rumble
for (const s of info.strikes) {
  const i0 = Math.floor((s + 0.12) * SR), n = Math.floor(7 * SR);
  const hp = biquad('hp', 900), lpA = biquad('lp', 160), lpB = biquad('lp', 160), lpC = biquad('lp', 160), lpD = biquad('lp', 160);
  let roll = 0;
  for (let j = 0; j < n && i0 + j < N; j++) {
    const t = j / SR;
    const crack = hp(rnd() * 2 - 1) * Math.exp(-t / 0.09) * 0.55;
    if (j % 2400 === 0) roll = 0.55 + rnd() * 0.45;
    const env = smooth(t / 0.18) * Math.exp(-t / 2.2) * roll;
    const l = lpA(lpB(rnd() * 2 - 1)) * env * 9, r = lpC(lpD(rnd() * 2 - 1)) * env * 9;
    L[i0 + j] += crack + l; R[i0 + j] += crack * 0.9 + r;
  }
}

// fade in/out, normalize, write 16-bit WAV
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR, g = smooth(t / 0.6) * (1 - smooth((t - (DUR - 2.2)) / 2.2));
  L[i] *= g; R[i] *= g;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.89 / peak, buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(clamp(L[i] * norm, -1, 1) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(clamp(R[i] * norm, -1, 1) * 32767), 46 + i * 4);
}
fs.writeFileSync(process.argv[2] || 'soundtrack.wav', buf);
console.log('peak', peak.toFixed(3), 'written', process.argv[2] || 'soundtrack.wav');
