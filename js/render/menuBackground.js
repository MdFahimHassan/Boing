import { rng } from "./atlas.js";
import { drawBall } from "./sprites.js";

/** Animated twilight scene behind the menus (replaces the old photo). */
export class MenuBackground {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext("2d");
    this.t = 0;
    this.raf = 0;
    const r = rng(11);
    this.stars = Array.from({ length: 110 }, () => ({ x: r(), y: r() * 0.62, s: 0.7 + r() * 1.8, p: r() * 6 }));
    this.rings = Array.from({ length: 14 }, () => ({ x: r(), y: 0.15 + r() * 0.55, s: 0.6 + r() * 0.8, v: 0.01 + r() * 0.02, p: r() * 6 }));
    this.blobs = Array.from({ length: 4 }, (_, i) => ({ x: 0.15 + i * 0.22 + r() * 0.08, phase: r() * 3, hue: i }));
    this.shoot = { x: 0, y: 0, life: 0, next: 3 };
    window.addEventListener("resize", () => this.resize());
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.c.width = Math.round(window.innerWidth * dpr);
    this.c.height = Math.round(window.innerHeight * dpr);
    this.c.style.width = "100%"; this.c.style.height = "100%";
    this.k = this.c.height / 720;
  }

  start() {
    if (this.raf) return;
    this.c.style.display = "block";
    let last = performance.now();
    const f = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      this.t += dt; this.draw(dt);
      this.raf = requestAnimationFrame(f);
    };
    this.raf = requestAnimationFrame(f);
  }

  stop() {
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.c.style.display = "none";
  }

  draw(dt) {
    const { ctx, c, t } = this;
    const W = c.width, H = c.height, k = this.k;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#150b3a"); g.addColorStop(0.45, "#4a1f86"); g.addColorStop(0.75, "#c14a9a"); g.addColorStop(1, "#ff9a6a");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    for (const s of this.stars) {
      ctx.globalAlpha = (0.35 + 0.65 * Math.sin(t * 1.7 + s.p) ** 2) * (1 - s.y);
      ctx.fillStyle = "#fff"; ctx.fillRect(s.x * W, s.y * H, s.s * k, s.s * k);
    }
    ctx.globalAlpha = 1;

    // shooting star
    const sh = this.shoot;
    sh.next -= dt;
    if (sh.next <= 0 && sh.life <= 0) { sh.life = 0.7; sh.x = (0.3 + Math.random() * 0.6) * W; sh.y = Math.random() * 0.3 * H; sh.next = 4 + Math.random() * 5; }
    if (sh.life > 0) {
      sh.life -= dt; sh.x -= 900 * k * dt; sh.y += 380 * k * dt;
      ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, sh.life / 0.7)})`; ctx.lineWidth = 2.5 * k;
      ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(sh.x + 110 * k, sh.y - 46 * k); ctx.stroke();
    }

    // ringed planet
    const px = W * 0.76, py = H * 0.3, pr = 92 * k;
    const halo = ctx.createRadialGradient(px, py, pr * 0.5, px, py, pr * 3);
    halo.addColorStop(0, "rgba(255,170,230,0.45)"); halo.addColorStop(1, "rgba(255,170,230,0)");
    ctx.fillStyle = halo; ctx.fillRect(px - pr * 3, py - pr * 3, pr * 6, pr * 6);
    const pg = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, pr * 0.1, px, py, pr);
    pg.addColorStop(0, "#ffe9a8"); pg.addColorStop(1, "#ff8fb0");
    const ring = (back) => {
      ctx.save(); ctx.translate(px, py); ctx.rotate(-0.35);
      ctx.strokeStyle = "rgba(255,240,200,0.8)"; ctx.lineWidth = 9 * k;
      ctx.beginPath(); ctx.ellipse(0, 0, pr * 1.7, pr * 0.42, 0, back ? Math.PI : 0, back ? Math.PI * 2 : Math.PI); ctx.stroke();
      ctx.restore();
    };
    ring(true);
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(120,30,90,0.18)";
    ctx.beginPath(); ctx.ellipse(px + pr * 0.1, py + pr * 0.35, pr * 0.8, pr * 0.14, -0.2, 0, Math.PI * 2); ctx.fill();
    ring(false);

    // floating golden rings
    for (const r of this.rings) {
      const x = ((r.x + t * r.v) % 1.1) * W - 0.05 * W;
      const y = r.y * H + Math.sin(t * 1.3 + r.p) * 14 * k;
      ctx.save(); ctx.translate(x, y); ctx.scale(Math.abs(Math.cos(t * 1.6 + r.p)) * 0.6 + 0.4, 1);
      ctx.globalAlpha = 0.55; ctx.lineWidth = 5 * k * r.s; ctx.strokeStyle = "#ffd447";
      ctx.beginPath(); ctx.arc(0, 0, 13 * k * r.s, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    ctx.globalAlpha = 1;

    // hills (slow drift)
    const hill = (col, base, amp, par, seed) => {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W + 10; x += 10) {
        const wx = x + t * par * k;
        ctx.lineTo(x, H * base + Math.sin(wx * 0.004 / k + seed) * amp * k + Math.sin(wx * 0.011 / k + seed * 2) * amp * 0.3 * k);
      }
      ctx.lineTo(W, H); ctx.fill();
    };
    hill("#5b2a8f", 0.74, 55, 6, 1);
    hill("#3a1a6b", 0.82, 45, 14, 2.4);
    hill("#1f0f45", 0.91, 30, 26, 4.1);

    // little bouncing blobs on the front hill
    const ground = H * 0.935;
    for (const b of this.blobs) {
      const tt = t * 2.2 + b.phase * 5;
      const hop = Math.abs(Math.sin(tt));
      const x = b.x * W, y = ground - hop * 70 * k - 14 * k;
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(x, ground, (18 - hop * 7) * k, 4 * k, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(x, y); ctx.scale(k * 1.0, k * 1.0); ctx.translate(-x, -y);
      drawBall(ctx, { x, y, vx: 0, vy: Math.cos(tt) * -420, carry: 0, invuln: 0 }, { squash: hop < 0.1 ? 0.28 : 0, rot: tt, blink: 0 }, t);
      ctx.restore();
    }
  }
}
