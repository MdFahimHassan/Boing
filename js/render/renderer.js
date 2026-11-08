import { TILE, R } from "../sim/constants.js";
import { THEMES } from "./themes.js";
import { buildAtlas } from "./atlas.js";
import { Background } from "./background.js";
import { Particles } from "./particles.js";
import { drawBall, drawShadow, drawRing, drawHeart, drawEnemy, drawPad, drawCheckpoint, drawGoal, drawMover } from "./sprites.js";

const VIEW_H = 12 * TILE; // logical view height: 12 tiles tall
const MIN_VIEW_W = 13 * TILE;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.particles = new Particles();
    this.cam = { x: 0, y: 0 };
    this.scale = 1;
    this.shake = 0;
    this.t = 0;
    this.world = null;
    window.addEventListener("resize", () => this.resize());
  }

  setWorld(world) {
    this.world = world;
    this.theme = THEMES[world.L.def.theme] ?? THEMES.meadow;
    this.bg = new Background(this.theme);
    this.particles.clear();
    this.padAnim = new Map();
    this.anim = { squash: 0, rot: 0, blink: 0, nextBlink: 2, trail: 0 };
    this.ringPop = new Set();
    this.resize();
    this.snapCamera();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.scale = Math.min(this.canvas.height / VIEW_H, this.canvas.width / MIN_VIEW_W);
    this.viewW = this.canvas.width / this.scale;
    this.viewH = this.canvas.height / this.scale;
    if (this.theme) this.atlas = buildAtlas(this.theme, Math.round(TILE * this.scale));
  }

  // ---- camera ---------------------------------------------------------------

  cameraTarget() {
    const b = this.world.ball, L = this.world.L;
    let tx = b.x + Math.max(-110, Math.min(110, b.vx * 0.35));
    let ty = b.y - 30 + Math.max(-40, Math.min(110, b.vy * 0.1));
    const lw = L.W * TILE, lh = L.H * TILE;
    tx = lw <= this.viewW ? lw / 2 : Math.max(this.viewW / 2, Math.min(lw - this.viewW / 2, tx));
    ty = lh <= this.viewH ? lh / 2 : Math.max(this.viewH / 2, Math.min(lh - this.viewH / 2, ty));
    return { x: tx, y: ty };
  }

  snapCamera() {
    const t = this.cameraTarget();
    this.cam.x = t.x; this.cam.y = t.y;
  }

  // ---- events -> effects ----------------------------------------------------

  handleEvents(events) {
    const P = this.particles;
    for (const e of events) {
      switch (e.type) {
        case "land": {
          const k = Math.min(1, e.impact / 900);
          if (e.impact > 140) this.anim.squash = Math.max(this.anim.squash, 0.12 + k * 0.35);
          if (e.impact > 260) P.burst(e.x, e.y, 3 + Math.round(k * 6), { speed: 90 + k * 90, spread: Math.PI * 0.9, color: "rgba(255,255,255,0.75)", size: 3.5, g: 220, drag: 2 });
          if (e.impact > 780) this.shake = Math.max(this.shake, 3);
          break;
        }
        case "jump": P.burst(e.x, e.y, 6, { speed: 110, spread: Math.PI * 1.1, angle: Math.PI / 2, color: "rgba(255,255,255,0.7)", size: 3, g: 100, drag: 2 }); break;
        case "spring":
          this.padAnim.set(`${e.tx},${e.ty}`, 0);
          P.add({ type: "ring", x: (e.tx + 0.5) * TILE, y: e.ty * TILE + 12, size: 36, life: 0.4, color: "#ffe27a" });
          this.anim.squash = 0.35;
          break;
        case "ring":
          P.burst(e.x, e.y, 10, { speed: 160, type: "star", color: "#ffe27a", size: 7, life: 0.6, drag: 3, spin: 6 });
          P.add({ type: "ring", x: e.x, y: e.y, size: 26, life: 0.35, color: "#fff3b0" });
          P.add({ type: "text", x: e.x, y: e.y - 14, vy: -50, life: 0.7, text: "+100", color: "#ffe27a" });
          break;
        case "heart":
          P.burst(e.x, e.y, 14, { speed: 180, type: "star", color: "#ff7aa0", size: 8, life: 0.8, drag: 3 });
          P.add({ type: "text", x: e.x, y: e.y - 14, vy: -50, life: 0.9, text: "+1 ♥", color: "#ff9ab8" });
          break;
        case "checkpoint":
          P.burst(e.x, e.y, 22, { speed: 220, type: "star", color: "#6dffd0", size: 8, life: 0.9, drag: 2.5, spin: 4 });
          P.add({ type: "text", x: e.x, y: e.y - 30, vy: -40, life: 1.2, text: "CHECKPOINT", color: "#6dffd0" });
          break;
        case "stomp":
          P.burst(e.x, e.y, 16, { speed: 240, color: "#ff8a5c", size: 5, g: 600, drag: 1 });
          P.burst(e.x, e.y, 8, { speed: 200, type: "star", color: "#fff", size: 8, life: 0.5, spin: 8 });
          P.add({ type: "text", x: e.x, y: e.y - 20, vy: -50, life: 0.8, text: "+200", color: "#ffb38a" });
          this.shake = Math.max(this.shake, 4);
          break;
        case "death":
          P.burst(e.x, e.y, 34, { speed: 380, color: "#9b5cff", size: 7, g: 900, life: 0.9, drag: 0.8 });
          P.burst(e.x, e.y, 12, { speed: 300, type: "debris", color: "#d6baff", size: 8, g: 900, life: 1, spin: 10 });
          P.add({ type: "ring", x: e.x, y: e.y, size: 70, life: 0.5, color: "#d6baff" });
          this.shake = 12;
          break;
        case "respawn":
          P.burst(e.x, e.y, 18, { speed: 220, type: "star", color: "#d6baff", size: 7, life: 0.7, drag: 3 });
          this.snapCamera();
          break;
        case "crumbleStart": P.burst(e.x, e.y + 6, 6, { speed: 60, color: "#b8b0a8", size: 3, g: 500, life: 0.5 }); break;
        case "crumbled": P.burst(e.x, e.y, 14, { speed: 160, type: "debris", color: "#b8b0a8", size: 8, g: 900, life: 1, spin: 8 }); break;
        case "splash": {
          const n = Math.min(14, 4 + Math.abs(e.vy) / 80);
          P.burst(e.x, e.y, n, { speed: 140, spread: Math.PI * 0.9, color: "rgba(255,255,255,0.85)", size: 3.5, g: 700, life: 0.6 });
          break;
        }
        case "win":
          for (let i = 0; i < 70; i++) {
            const cols = ["#ffe27a", "#ff8fe0", "#9b7bff", "#7ae8ff", "#6dffd0"];
            P.add({ type: "debris", x: e.x, y: e.y, vx: (Math.random() - 0.5) * 700, vy: -300 - Math.random() * 500, g: 800, life: 1.6 + Math.random(), size: 8, color: cols[i % 5], spin: (Math.random() - 0.5) * 14, drag: 0.5 });
          }
          break;
      }
    }
  }

  // ---- per-frame update ------------------------------------------------------

  update(dt) {
    if (!this.world) return;
    const w = this.world, b = w.ball;
    this.t += dt;
    this.particles.update(dt);

    for (const [k, v] of this.padAnim) { if (v > 0.5) this.padAnim.delete(k); else this.padAnim.set(k, v + dt); }

    const a = this.anim;
    a.squash *= Math.exp(-13 * dt);
    a.rot += ((b.vx + b.carry) * dt) / R;
    a.nextBlink -= dt;
    if (a.nextBlink <= 0) { a.blink = 0.12; a.nextBlink = 1.8 + Math.random() * 2.6; }
    if (a.blink > 0) a.blink -= dt;

    if (w.status === "playing") {
      const sp = Math.hypot(b.vx + b.carry, b.vy);
      a.trail -= dt;
      if (sp > 420 && a.trail <= 0) { this.particles.add({ type: "ghost", x: b.x, y: b.y, size: R, life: 0.28, color: "#a56bff" }); a.trail = 0.035; }
      if (b.inWater && Math.random() < dt * 6) this.particles.add({ type: "bubble", x: b.x + (Math.random() - 0.5) * 12, y: b.y - 8, vy: -50, vx: 0, size: 2 + Math.random() * 3, life: 0.9 });
    }

    // camera: smooth follow + shake
    const t = this.cameraTarget();
    const f = 1 - Math.exp(-(w.status === "dead" ? 2 : 6.5) * dt);
    this.cam.x += (t.x - this.cam.x) * f;
    this.cam.y += (t.y - this.cam.y) * f;
    this.shake *= Math.exp(-9 * dt);
  }

  // ---- drawing -----------------------------------------------------------------

  draw() {
    if (!this.world) return;
    const ctx = this.ctx, w = this.world, L = w.L, t = this.t, atlas = this.atlas;
    const cw = this.canvas.width, ch = this.canvas.height;
    const sc = this.scale;

    // background in screen space
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.bg.draw(ctx, cw, ch, this.cam.x * sc, this.cam.y * sc, t, L.H * TILE);

    // world space
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    const ox = cw / 2 - this.cam.x * sc + sx * sc, oy = ch / 2 - this.cam.y * sc + sy * sc;
    ctx.setTransform(sc, 0, 0, sc, ox, oy);
    ctx.imageSmoothingEnabled = true;

    const vx0 = this.cam.x - this.viewW / 2 - TILE, vx1 = this.cam.x + this.viewW / 2 + TILE;
    const vy0 = this.cam.y - this.viewH / 2 - TILE, vy1 = this.cam.y + this.viewH / 2 + TILE;
    const tx0 = Math.max(0, Math.floor(vx0 / TILE)), tx1 = Math.min(L.W - 1, Math.floor(vx1 / TILE));
    const ty0 = Math.max(0, Math.floor(vy0 / TILE)), ty1 = Math.min(L.H - 1, Math.floor(vy1 / TILE));
    const solidAt = (x, y) => (x < 0 || x >= L.W ? 1 : y < 0 ? 1 : y >= L.H ? 1 : +(L.solid[y * L.W + x] === 1 || L.solid[y * L.W + x] === 2));

    // checkpoints & goal sit behind the ball
    L.checkpoints.forEach((c, i) => drawCheckpoint(ctx, c, w.cpActive >= i && w.cpActive === i, t));
    drawGoal(ctx, L.goal, t);

    // tiles
    for (let y = ty0; y <= ty1; y++) {
      for (let x = tx0; x <= tx1; x++) {
        const i = y * L.W + x;
        const s = L.solid[i];
        if (!s) continue;
        const px = x * TILE, py = y * TILE;
        if (s === 1) {
          const mask = solidAt(x, y - 1) | (solidAt(x + 1, y) << 1) | (solidAt(x, y + 1) << 2) | (solidAt(x - 1, y) << 3);
          const v = ((x * 73856093) ^ (y * 19349663)) % 3;
          ctx.drawImage(atlas.ground.get(mask)[Math.abs(v)], px, py, TILE, TILE);
        } else if (s === 3) ctx.drawImage(atlas.oneway, px, py, TILE, TILE);
        else if (s === 2) {
          const ci = L.crIndex[i], st = w.crState[ci];
          if (st === 2) {
            if (w.crTimer[ci] < 0.5) { ctx.globalAlpha = 0.35 * (1 - w.crTimer[ci] / 0.5); ctx.drawImage(atlas.crumble, px, py, TILE, TILE); ctx.globalAlpha = 1; }
          } else {
            const shake = st === 1 ? (Math.random() - 0.5) * 3.5 : 0;
            ctx.drawImage(atlas.crumble, px + shake, py + (st === 1 ? Math.random() * 1.5 : 0), TILE, TILE);
          }
        }
      }
    }

    // spikes, pads
    for (const s of L.spikes) {
      if (s.tx < tx0 || s.tx > tx1) continue;
      ctx.drawImage(s.dir === "up" ? atlas.spikeUp : atlas.spikeDown, s.tx * TILE, s.ty * TILE, TILE, TILE);
    }
    for (const p of L.pads) {
      const a = this.padAnim.get(`${p.tx},${p.ty}`);
      const comp = a === undefined ? 0 : a < 0.08 ? a / 0.08 : -Math.sin((a - 0.08) * 22) * 0.3 * Math.max(0, 1 - a * 2.2);
      drawPad(ctx, atlas, p.tx, p.ty, comp, t);
    }

    // movers
    for (let i = 0; i < L.movers.length; i++) {
      const m = L.movers[i], s = w.moverState(i);
      if (s.x + m.w < vx0 || s.x > vx1) continue;
      drawMover(ctx, s.x, s.y, m.w, m.h);
    }

    // pickups
    L.rings.forEach((r, i) => { if (!w.ringGot[i] && r.x > vx0 && r.x < vx1) drawRing(ctx, r.x, r.y, t, i); });
    L.hearts.forEach((h, i) => { if (!w.heartGot[i]) drawHeart(ctx, h.x, h.y, t); });
    w.enemies.forEach((e, i) => { if (e.alive && e.x > vx0 && e.x < vx1) drawEnemy(ctx, e, t, i); });

    // the hero
    if (w.status !== "dead") {
      drawShadow(ctx, w.ball, w.groundBelow(w.ball.x, w.ball.y));
      drawBall(ctx, w.ball, this.anim, t, w.status === "gameover");
    }

    this.particles.draw(ctx);
    this.drawWater(ctx, L, tx0, tx1, ty0, ty1, t);

    // soft vignette (screen space)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const vg = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.45, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, cw, ch);
  }

  drawWater(ctx, L, tx0, tx1, ty0, ty1, t) {
    const col = this.theme.water ?? "#3b8fe0";
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.38;
    for (let y = ty0; y <= ty1; y++) {
      let runStart = -1;
      for (let x = tx0; x <= tx1 + 1; x++) {
        const wet = x <= tx1 && L.water[y * L.W + x] === 1;
        if (wet && runStart < 0) runStart = x;
        if (!wet && runStart >= 0) { ctx.fillRect(runStart * TILE, y * TILE, (x - runStart) * TILE, TILE + 0.6); runStart = -1; }
      }
    }
    ctx.globalAlpha = 1;
    // animated surface
    ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 3; ctx.lineCap = "round";
    for (let y = ty0; y <= ty1; y++) {
      for (let x = tx0; x <= tx1; x++) {
        if (L.water[y * L.W + x] !== 1 || (y > 0 && L.water[(y - 1) * L.W + x] === 1)) continue;
        ctx.beginPath();
        for (let k = 0; k <= 8; k++) {
          const px = x * TILE + (k / 8) * TILE;
          const py = y * TILE + 2 + Math.sin(t * 2.4 + px * 0.05) * 2.2;
          k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
    }
  }
}
