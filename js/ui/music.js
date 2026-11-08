/**
 * Procedural chiptune music — two original looping tracks synthesized live with WebAudio
 * (no audio files). Melodies are generated from a seeded random walk over chord tones.
 */
let ctx = null;
let master = null;
let enabled = true;
let current = null;
let want = null; // what to play once enabled / unlocked

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return true;
}
["pointerdown", "keydown", "touchstart"].forEach((ev) => window.addEventListener(ev, () => ctx && ctx.state === "suspended" && ctx.resume(), { passive: true }));
document.addEventListener("visibilitychange", () => { if (!ctx) return; document.hidden ? ctx.suspend() : ctx.resume(); });

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function rngFn(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ---- tiny instrument kit -------------------------------------------------------------
function note(dest, m, t, dur, { type = "square", vol = 0.1, attack = 0.005, release = 0.06, detune = 0 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = hz(m); o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
}
let noiseBuf = null;
function noise(dest, t, dur, { vol = 0.1, hp = 4000, lp = 12000 } = {}) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f1 = ctx.createBiquadFilter(); f1.type = "highpass"; f1.frequency.value = hp;
  const f2 = ctx.createBiquadFilter(); f2.type = "lowpass"; f2.frequency.value = lp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f1); f1.connect(f2); f2.connect(g); g.connect(dest);
  s.start(t); s.stop(t + dur + 0.02);
}
function kick(dest, t, vol = 0.32) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.18);
}

// ---- track definitions ---------------------------------------------------------------
const MAJ = [0, 4, 7], MIN = [0, 3, 7];
const PENT = [0, 2, 4, 7, 9];

function buildMelody(prog, rand, density, lo, hi) {
  // returns an array of (bars*16) midi notes or 0, built as 4-bar motif + variation
  const bars = prog.length;
  const out = new Array(bars * 16).fill(0);
  let prev = lo + 7;
  for (let b = 0; b < bars; b++) {
    const chord = prog[b];
    const pool = [];
    for (let o = lo; o <= hi; o++) for (const p of PENT) if ((o + 120 - 60) % 12 === ((p + chord.r) % 12)) pool.push(o);
    const strong = []; for (let o = lo; o <= hi; o++) for (const q of chord.q) if ((o + 120 - 60) % 12 === ((q + chord.r) % 12)) strong.push(o);
    for (let s = 0; s < 16; s += 2) {
      if (rand() > density && s !== 0) continue;
      const list = s % 4 === 0 ? strong : pool;
      let best = list[0], bd = 99;
      for (const n of list) { const d = Math.abs(n - prev) + rand() * 3; if (d < bd && n !== prev) { bd = d; best = n; } }
      out[b * 16 + s] = best; prev = best;
    }
  }
  return out;
}

const TRACKS = {
  game: (() => {
    const rand = rngFn(2024);
    const prog = [0, 9, 5, 7, 0, 9, 5, 7].map((r, i) => ({ r, q: r === 9 ? MIN : MAJ }));
    const mel = buildMelody(prog, rand, 0.72, 72, 86);
    // second half echoes the first with a fresh last bar
    for (let i = 0; i < 4 * 16; i++) mel[4 * 16 + i] = i < 3 * 16 ? mel[i] : mel[4 * 16 + i];
    return {
      bpm: 134, steps: prog.length * 16,
      play(step, t, dest) {
        const bar = Math.floor(step / 16), s = step % 16, c = prog[bar];
        const beat = 60 / 134 / 4;
        // bouncy bass
        if (s % 4 === 0) note(dest, 36 + c.r + (c.r > 6 ? -12 : 0), t, beat * 3.2, { type: "triangle", vol: 0.28 });
        else if (s % 4 === 2) note(dest, 48 + c.r + (c.r > 6 ? -12 : 0), t, beat * 1.6, { type: "triangle", vol: 0.16 });
        // lead
        const m = mel[step];
        if (m) note(dest, m, t, beat * 1.9, { type: "square", vol: 0.075, release: 0.09 });
        // sparkly 16th arp, quiet, every other bar
        if (bar % 2 === 1 && s % 2 === 1) note(dest, 72 + c.r + c.q[(s >> 1) % 3], t, beat * 0.9, { type: "triangle", vol: 0.05 });
        // drums
        if (s % 4 === 0) kick(dest, t);
        if (s === 4 || s === 12) noise(dest, t, 0.14, { vol: 0.16, hp: 1800, lp: 9000 });
        if (s % 4 === 2) noise(dest, t, 0.04, { vol: 0.08, hp: 7000 });
      },
    };
  })(),
  menu: (() => {
    const rand = rngFn(77);
    const prog = [0, 7, 9, 5].map((r) => ({ r, q: r === 9 ? MIN : MAJ }));
    const mel = buildMelody(prog, rand, 0.32, 76, 90);
    return {
      bpm: 84, steps: prog.length * 16,
      play(step, t, dest) {
        const bar = Math.floor(step / 16), s = step % 16, c = prog[bar];
        const beat = 60 / 84 / 4;
        if (s === 0) for (const q of c.q) note(dest, 60 + c.r + q - (c.r > 6 ? 12 : 0), t, beat * 15.5, { type: "sine", vol: 0.07, attack: 0.25, release: 0.5 });
        if (s === 0) note(dest, 36 + c.r - (c.r > 6 ? 12 : 0), t, beat * 8, { type: "triangle", vol: 0.2 });
        if (s % 2 === 0) note(dest, 72 + c.r + c.q[[0, 1, 2, 1, 2, 1, 0, 2][(s >> 1) % 8] % 3] - (c.r > 6 ? 12 : 0), t, beat * 1.7, { type: "triangle", vol: 0.055 });
        const m = mel[step];
        if (m) note(dest, m, t, beat * 3, { type: "sine", vol: 0.1, attack: 0.01, release: 0.25 });
        if (s === 0 || s === 8) kick(dest, t, 0.12);
        if (s === 4 || s === 12) noise(dest, t, 0.05, { vol: 0.035, hp: 6000 });
      },
    };
  })(),
};

class Loop {
  constructor(name, volume, fadeMs) {
    this.def = TRACKS[name];
    this.gain = ctx.createGain();
    this.gain.gain.value = 0.0001;
    this.gain.connect(master);
    this.gain.gain.setTargetAtTime(volume, ctx.currentTime, fadeMs / 3000);
    this.step = 0;
    this.next = ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.tick(), 30);
    this.notes = 0;
  }
  tick() {
    if (ctx.state !== "running") return;
    if (this.next < ctx.currentTime - 0.25) this.next = ctx.currentTime + 0.05; // recover after a stall
    const stepDur = 60 / this.def.bpm / 4;
    while (this.next < ctx.currentTime + 0.15) {
      this.def.play(this.step % this.def.steps, this.next, this.gain);
      this.notes++;
      this.next += stepDur;
      this.step++;
    }
  }
  stop(fadeMs) {
    clearInterval(this.timer);
    this.gain.gain.cancelScheduledValues(ctx.currentTime);
    this.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, fadeMs / 3000);
    setTimeout(() => this.gain.disconnect(), fadeMs + 400);
  }
}

export const music = {
  get enabled() { return enabled; },
  get debug() { return { name: current?.name, notes: current?.loop.notes ?? 0, state: ctx?.state }; },

  /** name: "menu" | "game"   volume: 0..1 */
  play(name, volume = 0.3, fadeMs = 1500) {
    want = { name, volume, fadeMs };
    if (!enabled || !TRACKS[name]) return;
    if (current?.name === name) { current.loop.gain.gain.setTargetAtTime(volume, ctx.currentTime, 0.2); return; }
    if (!ensure()) return;
    this.stop(fadeMs);
    current = { name, loop: new Loop(name, volume, fadeMs) };
  },

  stop(fadeMs = 800) {
    if (current) { current.loop.stop(fadeMs); current = null; }
  },

  setEnabled(v) {
    enabled = v;
    if (!v) this.stop(400);
    else if (want) this.play(want.name, want.volume, 800);
  },
};
