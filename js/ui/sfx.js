/** Sound effects synthesized with WebAudio — no sample files needed. */
let ctx = null;
let master = null;
let enabled = true;
let comboT = 0, combo = 0;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return true;
}
["pointerdown", "keydown", "touchstart"].forEach((ev) => window.addEventListener(ev, ensure, { passive: true }));

function tone({ type = "sine", f0, f1 = f0, dur = 0.15, vol = 0.3, delay = 0, attack = 0.005 }) {
  if (!enabled || !ensure()) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise({ dur = 0.2, vol = 0.2, freq = 800, delay = 0 }) {
  if (!enabled || !ensure()) return;
  const t = ctx.currentTime + delay;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = ctx.createBufferSource(); s.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master); s.start(t);
}

const arp = (notes, step = 0.08, type = "triangle", vol = 0.25, dur = 0.18) =>
  notes.forEach((f, i) => tone({ type, f0: f, dur, vol, delay: i * step }));

export const sfx = {
  setEnabled(v) { enabled = v; },
  get enabled() { return enabled; },
  click() { tone({ type: "square", f0: 700, f1: 420, dur: 0.06, vol: 0.12 }); },
  bounce(impact = 400) { const v = Math.min(0.28, 0.06 + impact / 3800); tone({ type: "sine", f0: 260, f1: 120, dur: 0.11, vol: v }); },
  jump() { tone({ type: "square", f0: 320, f1: 720, dur: 0.14, vol: 0.1 }); },
  spring() { tone({ type: "sine", f0: 180, f1: 980, dur: 0.3, vol: 0.28 }); tone({ type: "triangle", f0: 360, f1: 1400, dur: 0.22, vol: 0.12, delay: 0.03 }); },
  ring() {
    const now = performance.now();
    combo = now - comboT < 700 ? Math.min(combo + 1, 7) : 0;
    comboT = now;
    const base = 880 * Math.pow(2, combo / 12);
    tone({ type: "triangle", f0: base, dur: 0.16, vol: 0.22 });
    tone({ type: "triangle", f0: base * 1.5, dur: 0.22, vol: 0.18, delay: 0.06 });
  },
  heart() { arp([523, 659, 784, 1047], 0.07); },
  checkpoint() { arp([523, 659, 784], 0.09, "sine", 0.28, 0.3); },
  stomp() { noise({ dur: 0.18, vol: 0.3, freq: 1500 }); tone({ type: "square", f0: 220, f1: 70, dur: 0.15, vol: 0.18 }); },
  death() { tone({ type: "sawtooth", f0: 520, f1: 50, dur: 0.6, vol: 0.18 }); noise({ dur: 0.35, vol: 0.2, freq: 900 }); },
  respawn() { tone({ type: "sine", f0: 300, f1: 900, dur: 0.25, vol: 0.18 }); },
  crumble() { noise({ dur: 0.3, vol: 0.18, freq: 500 }); },
  splash() { noise({ dur: 0.25, vol: 0.14, freq: 2200 }); },
  win() { arp([523, 659, 784, 1047, 784, 1047, 1319], 0.11, "triangle", 0.28, 0.3); },
  gameover() { arp([392, 349, 330, 262], 0.2, "sawtooth", 0.14, 0.4); },
  swoosh() {
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime, dur = 0.55;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3200, t + dur);
    const g = ctx.createGain(); g.gain.value = 0.35;
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  },
  star() { tone({ type: "triangle", f0: 988, f1: 1319, dur: 0.25, vol: 0.25 }); },

  /** Map a simulation event to a sound. */
  forEvent(e) {
    switch (e.type) {
      case "land": if (e.impact > 120 && !e.pad) this.bounce(e.impact); break;
      case "jump": this.jump(); break;
      case "spring": this.spring(); break;
      case "ring": this.ring(); break;
      case "heart": this.heart(); break;
      case "checkpoint": this.checkpoint(); break;
      case "stomp": this.stomp(); break;
      case "death": this.death(); break;
      case "respawn": this.respawn(); break;
      case "crumbleStart": case "crumbled": this.crumble(); break;
      case "splash": this.splash(); break;
      case "win": this.win(); break;
      case "gameover": this.gameover(); break;
    }
  },
};
