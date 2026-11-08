/** Small pooled particle system: dots, sparkles, debris, bubbles, expanding rings, floating text. */
export class Particles {
  constructor(max = 700) { this.max = max; this.list = []; }

  add(p) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({ vx: 0, vy: 0, g: 0, drag: 0, life: 0.6, age: 0, size: 3, color: "#fff", type: "dot", spin: 0, rot: 0, ...p });
  }

  burst(x, y, n, opts = {}) {
    const { speed = 200, spread = Math.PI * 2, angle = -Math.PI / 2, ...rest } = opts;
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * (0.35 + Math.random() * 0.65);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + Math.random() * 0.5, ...rest, size: (rest.size ?? 4) * (0.6 + Math.random() * 0.8) });
    }
  }

  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.age += dt;
      if (p.age >= p.life) { L.splice(i, 1); continue; }
      p.vy += p.g * dt;
      if (p.drag) { const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy *= d; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
    }
  }

  draw(ctx) {
    for (const p of this.list) {
      const k = 1 - p.age / p.life;
      ctx.globalAlpha = Math.min(1, k * 1.5);
      switch (p.type) {
        case "ring":
          ctx.strokeStyle = p.color; ctx.lineWidth = 3 * k + 0.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - k) + 4, 0, Math.PI * 2); ctx.stroke();
          break;
        case "star":
          ctx.fillStyle = p.color;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          const s = p.size * (0.4 + k * 0.6);
          ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.25, -s * 0.25); ctx.lineTo(s, 0); ctx.lineTo(s * 0.25, s * 0.25);
          ctx.lineTo(0, s); ctx.lineTo(-s * 0.25, s * 0.25); ctx.lineTo(-s, 0); ctx.lineTo(-s * 0.25, -s * 0.25); ctx.fill();
          ctx.restore();
          break;
        case "debris":
          ctx.fillStyle = p.color;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
          ctx.restore();
          break;
        case "bubble":
          ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.stroke();
          break;
        case "text":
          ctx.fillStyle = p.color; ctx.font = "bold 22px ByteBounce, monospace"; ctx.textAlign = "center";
          ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.strokeText(p.text, p.x, p.y); ctx.fillText(p.text, p.x, p.y);
          break;
        case "ghost":
          ctx.fillStyle = p.color; ctx.globalAlpha = k * 0.28;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + k * 0.4), 0, Math.PI * 2); ctx.fill();
          break;
        default:
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.3 + k * 0.7), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  clear() { this.list.length = 0; }
}
