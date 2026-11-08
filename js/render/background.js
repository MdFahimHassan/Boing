import { rng } from "./atlas.js";

/** Layered parallax scenery, drawn in screen space behind the level. */
export class Background {
  constructor(theme) {
    this.t = theme;
    const r = rng(7);
    this.clouds = Array.from({ length: 9 }, () => ({ x: r() * 2400, y: 0.08 + r() * 0.4, s: 0.6 + r() * 0.9, v: 4 + r() * 8 }));
    this.stars = Array.from({ length: 90 }, () => ({ x: r(), y: r() * 0.7, s: 0.6 + r() * 1.6, p: r() * 6 }));
    this.rocks = Array.from({ length: 28 }, () => ({ x: r() * 3000, w: 40 + r() * 90, h: 40 + r() * 130 }));
    this.bubbles = Array.from({ length: 40 }, () => ({ x: r() * 2000, y: r(), s: 2 + r() * 5, v: 12 + r() * 25 }));
  }

  draw(ctx, w, h, camX, camY, t, levelH) {
    const th = this.t;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, th.sky[0]); g.addColorStop(0.55, th.sky[1]); g.addColorStop(1, th.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    if (th.image) this.retroSun(ctx, w, h, camX, t);

    if (th.stars) {
      for (const s of this.stars) {
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 1.6 + s.p);
        ctx.fillStyle = "#fff";
        ctx.fillRect(s.x * w, s.y * h, s.s, s.s);
      }
      ctx.globalAlpha = 1;
    }

    if (th.sun) {
      const sx = th.sun.x * w - camX * 0.01, sy = th.sun.y * h;
      const halo = ctx.createRadialGradient(sx, sy, th.sun.r * 0.4, sx, sy, th.sun.r * 3);
      halo.addColorStop(0, th.sun.color + "aa"); halo.addColorStop(1, th.sun.color + "00");
      ctx.fillStyle = halo;
      ctx.fillRect(sx - th.sun.r * 3, sy - th.sun.r * 3, th.sun.r * 6, th.sun.r * 6);
      ctx.fillStyle = th.sun.color;
      ctx.beginPath(); ctx.arc(sx, sy, th.sun.r, 0, Math.PI * 2); ctx.fill();
      if (th.sun.moon) {
        ctx.fillStyle = th.sky[0];
        ctx.beginPath(); ctx.arc(sx + th.sun.r * 0.42, sy - th.sun.r * 0.1, th.sun.r * 0.92, 0, Math.PI * 2); ctx.fill();
      }
    }

    if (th.rays) {
      ctx.save();
      for (let i = 0; i < 6; i++) {
        const x = ((i * 0.22 + 0.05) * w * 1.3 - camX * 0.08 + Math.sin(t * 0.3 + i) * 30) % (w * 1.4);
        const gr = ctx.createLinearGradient(x, 0, x + 80, h);
        gr.addColorStop(0, "rgba(255,255,255,0.18)"); gr.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 70, 0); ctx.lineTo(x + 240, h); ctx.lineTo(x + 120, h); ctx.fill();
      }
      ctx.restore();
    }

    if (th.clouds) {
      ctx.fillStyle = "#fff";
      ctx.globalAlpha = th.cloudAlpha ?? 0.85;
      for (const c of this.clouds) {
        const span = w + 400;
        let x = (c.x + t * c.v - camX * 0.15 * c.s) % span;
        if (x < 0) x += span;
        x -= 200;
        const y = c.y * h - camY * 0.02;
        const s = c.s * (th.cloudsBig ? 1.5 : 1);
        puff(ctx, x, y, 46 * s);
      }
      ctx.globalAlpha = 1;
    }

    // hill silhouettes (or cave rock)
    if (th.cave) this.caveRock(ctx, w, h, camX, t);
    else {
      this.hills(ctx, w, h, camX, camY, th.hills[0], 0.1, 0.62, 70, 1);
      this.hills(ctx, w, h, camX, camY, th.hills[1], 0.22, 0.74, 50, 2.7);
    }

    if (th.rays || th.water) this.drawBubbles(ctx, w, h, camX, t);
  }

  /** Big striped sunset sun + drifting birds (the "dusk" theme). */
  retroSun(ctx, w, h, camX, t) {
    const r = Math.min(w, h) * 0.2, cx = w * 0.62 - camX * 0.01, cy = h * 0.55;
    const halo = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 2.6);
    halo.addColorStop(0, "rgba(255,170,90,0.55)"); halo.addColorStop(1, "rgba(255,120,120,0)");
    ctx.fillStyle = halo; ctx.fillRect(cx - r * 3, cy - r * 3, r * 6, r * 6);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    g.addColorStop(0, "#ffe27a"); g.addColorStop(0.55, "#ff9a5c"); g.addColorStop(1, "#ff4f8b");
    ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = this.t.sky[1]; // sky-coloured slats cut into the lower half
    for (let i = 0; i < 6; i++) { const y = cy + r * (0.05 + i * 0.16), th2 = 2 + i * 2.2; ctx.fillRect(cx - r, y, r * 2, th2); }
    ctx.restore();
    ctx.strokeStyle = "#2a1236"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      const x = ((i * 0.23 * w + t * (22 + i * 4) - camX * 0.05) % (w + 100)) - 50, y = h * (0.18 + (i % 3) * 0.08) + Math.sin(t * 1.5 + i) * 8;
      const flap = Math.sin(t * 9 + i * 2) * 5;
      ctx.beginPath(); ctx.moveTo(x - 9, y - flap); ctx.quadraticCurveTo(x - 4, y - 5 - flap, x, y); ctx.quadraticCurveTo(x + 4, y - 5 - flap, x + 9, y - flap); ctx.stroke();
    }
  }

  hills(ctx, w, h, camX, camY, color, par, base, amp, seed) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    const off = camX * par;
    const yoff = -camY * par * 0.15;
    for (let x = 0; x <= w + 12; x += 12) {
      const wx = x + off;
      const y = base * h + yoff + Math.sin(wx * 0.004 + seed) * amp + Math.sin(wx * 0.011 + seed * 2) * amp * 0.35;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  caveRock(ctx, w, h, camX, t) {
    const th = this.t;
    for (const [par, col, hs] of [[0.12, th.hills[0], 1], [0.25, th.hills[1], 1.4]]) {
      ctx.fillStyle = col;
      const off = camX * par;
      ctx.beginPath(); ctx.moveTo(0, 0);
      for (const r of this.rocks) {
        const x = ((r.x - off) % 3000 + 3000) % 3000 - 200;
        if (x > w + 200) continue;
        ctx.lineTo(x - r.w / 2, 0); ctx.lineTo(x, r.h * hs); ctx.lineTo(x + r.w / 2, 0);
      }
      ctx.lineTo(w, 0); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, h);
      for (const r of this.rocks) {
        const x = ((r.x * 0.9 - off) % 3000 + 3000) % 3000 - 200;
        if (x > w + 200) continue;
        ctx.lineTo(x - r.w / 2, h); ctx.lineTo(x, h - r.h * hs * 0.7); ctx.lineTo(x + r.w / 2, h);
      }
      ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    }
    // glowing crystals
    for (let i = 0; i < 14; i++) {
      const x = ((i * 370 - camX * 0.18) % (w + 200) + w + 200) % (w + 200) - 100;
      const y = h * (0.25 + ((i * 53) % 50) / 100);
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 1.5 + i);
      ctx.fillStyle = i % 2 ? "#8ea2ff" : "#7fffd4";
      ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 14); ctx.lineTo(x - 6, y); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawBubbles(ctx, w, h, camX, t) {
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.5;
    for (const b of this.bubbles) {
      const x = ((b.x - camX * 0.3) % (w + 100) + w + 100) % (w + 100) - 50;
      const y = h - (((b.y * h + t * b.v) % (h + 60)) - 30);
      ctx.beginPath(); ctx.arc(x + Math.sin(t + b.x) * 6, y, b.s, 0, Math.PI * 2); ctx.stroke();
    }
  }
}

function puff(ctx, x, y, s) {
  ctx.beginPath();
  ctx.arc(x, y, s * 0.55, 0, Math.PI * 2);
  ctx.arc(x + s * 0.6, y - s * 0.2, s * 0.7, 0, Math.PI * 2);
  ctx.arc(x + s * 1.25, y, s * 0.55, 0, Math.PI * 2);
  ctx.arc(x + s * 0.6, y + s * 0.2, s * 0.6, 0, Math.PI * 2);
  ctx.fill();
}
