import { R, TILE } from "../sim/constants.js";

const TAU = Math.PI * 2;

/** The hero: an original purple bouncy blob with a squashy, expressive face. */
export function drawBall(ctx, b, anim, t, dead = false) {
  const speed = Math.hypot(b.vx + b.carry, b.vy);
  const stretch = Math.min(0.28, Math.abs(b.vy) / 2800);
  let sx = 1 / (1 + stretch), sy = 1 + stretch;
  sx *= 1 + anim.squash;
  sy *= 1 - anim.squash * 0.85;

  ctx.save();
  ctx.translate(b.x, b.y + R * (1 - sy)); // keep the bottom planted while squashing
  ctx.scale(sx, sy);

  if (b.invuln > 0 && Math.floor(t * 14) % 2 === 0) ctx.globalAlpha = 0.45;

  // body
  const grad = ctx.createRadialGradient(-5, -7, 2, 0, 0, R + 2);
  grad.addColorStop(0, "#d6baff");
  grad.addColorStop(0.45, "#8a4dea");
  grad.addColorStop(1, "#4b1fa6");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();

  // rolling stripes (rotate with travel so you can see it spin)
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, R - 1, 0, TAU); ctx.clip();
  ctx.rotate(anim.rot);
  ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 5;
  for (const off of [-9, 9]) { ctx.beginPath(); ctx.arc(off * 2.2, 0, R * 1.05, 0, TAU); ctx.stroke(); }
  ctx.restore();

  ctx.lineWidth = 3; ctx.strokeStyle = "#2a0f66";
  ctx.beginPath(); ctx.arc(0, 0, R - 1.2, 0, TAU); ctx.stroke();

  // glossy highlight
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath(); ctx.ellipse(-6, -8, 5, 3, -0.6, 0, TAU); ctx.fill();

  // face (stays upright, looks where it's going)
  const look = Math.max(-1, Math.min(1, (b.vx + b.carry) / 220));
  const lookY = Math.max(-1, Math.min(1, b.vy / 500));
  const blink = anim.blink > 0;
  for (const ex of [-5.5, 5.5]) {
    const x = ex + look * 3.2;
    if (dead) {
      ctx.strokeStyle = "#1d0a4a"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 3, -4); ctx.lineTo(x + 3, 2); ctx.moveTo(x + 3, -4); ctx.lineTo(x - 3, 2); ctx.stroke();
    } else if (blink) {
      ctx.strokeStyle = "#1d0a4a"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 3, -1); ctx.lineTo(x + 3, -1); ctx.stroke();
    } else {
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.ellipse(x, -2, 3.8, 4.8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = "#1d0a4a";
      ctx.beginPath(); ctx.arc(x + look * 1.6, -1.5 + lookY * 1.8, 2.1, 0, TAU); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(x + look * 1.6 - 0.7, -2.5 + lookY * 1.8, 0.7, 0, TAU); ctx.fill();
    }
  }
  ctx.strokeStyle = "#1d0a4a"; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath();
  if (b.vy < -420) ctx.arc(look * 3, 8, 2.6, 0, TAU);           // "wheee" mouth
  else if (anim.squash > 0.18) ctx.arc(look * 3, 7.5, 3.4, 0, Math.PI); // landing "oof"
  else ctx.arc(look * 3, 5, 4, 0.15 * Math.PI, 0.85 * Math.PI);  // smile
  ctx.stroke();
  ctx.restore();
  return speed;
}

export function drawShadow(ctx, b, groundY) {
  if (groundY == null) return;
  const dist = groundY - (b.y + R);
  if (dist < 0 || dist > 420) return;
  const k = 1 - dist / 420;
  ctx.fillStyle = `rgba(0,0,0,${0.28 * k})`;
  ctx.beginPath(); ctx.ellipse(b.x, groundY + 1, R * (0.5 + 0.6 * k), 4 * (0.4 + k * 0.6), 0, 0, TAU); ctx.fill();
}

export function drawRing(ctx, x, y, t, i) {
  const bob = Math.sin(t * 3 + i * 0.7) * 3;
  const spin = Math.abs(Math.cos(t * 2.2 + i * 0.5)) * 0.65 + 0.35;
  ctx.save();
  ctx.translate(x, y + bob);
  const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, 24);
  halo.addColorStop(0, "rgba(255,226,120,0.45)"); halo.addColorStop(1, "rgba(255,226,120,0)");
  ctx.fillStyle = halo; ctx.fillRect(-24, -24, 48, 48);
  ctx.scale(spin, 1);
  ctx.lineWidth = 6; ctx.strokeStyle = "#b8741a";
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.stroke();
  ctx.lineWidth = 4; ctx.strokeStyle = "#ffd447";
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = "#fff6c2";
  ctx.beginPath(); ctx.arc(0, 0, 11, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
  ctx.restore();
}

export function drawHeart(ctx, x, y, t) {
  const bob = Math.sin(t * 3) * 3, s = 1 + Math.sin(t * 6) * 0.06;
  ctx.save();
  ctx.translate(x, y + bob); ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 9);
  ctx.bezierCurveTo(-16, -1, -9, -13, 0, -5);
  ctx.bezierCurveTo(9, -13, 16, -1, 0, 9);
  ctx.fillStyle = "#ff4f7b"; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = "#7d1237"; ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.beginPath(); ctx.ellipse(-5, -4, 2.5, 1.6, -0.6, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawEnemy(ctx, e, t, i) {
  const wob = Math.sin(t * 8 + i) * 0.06;
  ctx.save();
  ctx.translate(e.x, e.y + 2);
  ctx.scale(1 + wob, 1 - wob);
  // spiky body
  ctx.beginPath();
  const n = 12;
  for (let k = 0; k < n * 2; k++) {
    const a = (k / (n * 2)) * TAU + t * 0.6;
    const r = k % 2 ? 12.5 : 18;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r - 1);
  }
  ctx.closePath();
  ctx.fillStyle = "#ff6a3d"; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = "#661b0a"; ctx.lineJoin = "round"; ctx.stroke();
  ctx.fillStyle = "#ff9b6a";
  ctx.beginPath(); ctx.arc(0, -1, 11, 0, TAU); ctx.fill();
  // grumpy face
  for (const ex of [-4.5, 4.5]) {
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex, -2, 3.4, 0, TAU); ctx.fill();
    ctx.fillStyle = "#2a0a05"; ctx.beginPath(); ctx.arc(ex + e.dir * 1.3, -1.6, 1.7, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = "#2a0a05"; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(-2, -5); ctx.moveTo(8, -8); ctx.lineTo(2, -5); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 6.5, 3.2, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  ctx.restore();
}

/** compress: 0 = relaxed, 1 = fully squashed; may overshoot negative for the pop. */
export function drawPad(ctx, atlas, tx, ty, compress, t) {
  const x = tx * TILE, y = ty * TILE;
  ctx.drawImage(atlas.padBase, x, y, TILE, TILE);
  const bottom = y + TILE * 0.82;
  const h = TILE * 0.44 * (1 - compress * 0.6);
  const top = bottom - h;
  ctx.strokeStyle = "#cfd6e4"; ctx.lineWidth = 3.5; ctx.lineJoin = "round";
  ctx.beginPath();
  const coils = 4;
  ctx.moveTo(x + TILE * 0.5, bottom);
  for (let i = 1; i <= coils; i++) ctx.lineTo(x + TILE * (i % 2 ? 0.28 : 0.72), bottom - (h * i) / (coils + 1));
  ctx.lineTo(x + TILE * 0.5, top);
  ctx.stroke();
  ctx.fillStyle = "#ffcf40"; ctx.strokeStyle = "#7a5200"; ctx.lineWidth = 2.5;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x + 4, top - 7, TILE - 8, 8, 4); else ctx.rect(x + 4, top - 7, TILE - 8, 8);
  ctx.fill(); ctx.stroke();
}

export function drawCheckpoint(ctx, c, active, t) {
  const x = c.x, base = c.ty * TILE + TILE;
  ctx.strokeStyle = "#e8ecf4"; ctx.lineWidth = 4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, base - 62); ctx.stroke();
  ctx.fillStyle = "#e8ecf4"; ctx.beginPath(); ctx.arc(x, base - 64, 4, 0, TAU); ctx.fill();
  const fy = active ? base - 60 : base - 34;
  ctx.fillStyle = active ? "#35d6a0" : "#8a93a8";
  ctx.beginPath(); ctx.moveTo(x + 2, fy);
  const wv = active ? 4 : 1;
  for (let i = 0; i <= 8; i++) ctx.lineTo(x + 2 + i * 3.6, fy + Math.sin(t * 6 + i * 0.8) * wv * (i / 8));
  for (let i = 8; i >= 0; i--) ctx.lineTo(x + 2 + i * 3.6, fy + 20 + Math.sin(t * 6 + i * 0.8) * wv * (i / 8));
  ctx.closePath(); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.stroke();
  if (active) {
    const halo = ctx.createRadialGradient(x + 14, fy + 10, 2, x + 14, fy + 10, 40);
    halo.addColorStop(0, "rgba(80,255,190,0.35)"); halo.addColorStop(1, "rgba(80,255,190,0)");
    ctx.fillStyle = halo; ctx.fillRect(x - 30, fy - 30, 90, 90);
  }
}

export function drawGoal(ctx, g, t) {
  const { x, y } = g;
  ctx.save();
  ctx.translate(x, y - 4);
  const halo = ctx.createRadialGradient(0, 0, 10, 0, 0, 90);
  halo.addColorStop(0, "rgba(255,210,255,0.55)"); halo.addColorStop(1, "rgba(180,120,255,0)");
  ctx.fillStyle = halo; ctx.fillRect(-90, -90, 180, 180);
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate(t * (0.9 + i * 0.35) * (i % 2 ? -1 : 1));
    ctx.lineWidth = 4 - i * 0.6;
    ctx.strokeStyle = ["#ffe27a", "#ff8fe0", "#9b7bff", "#7ae8ff"][i];
    ctx.beginPath(); ctx.ellipse(0, 0, 30 - i * 5, 40 - i * 7, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = "#fff";
  ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 5);
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function drawMover(ctx, x, y, w, h) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, 7); else ctx.rect(x, y, w, h);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "#ffd26a"); g.addColorStop(1, "#d9892a");
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = "#5b3410"; ctx.stroke();
  ctx.fillStyle = "#5b3410";
  for (let rx = x + 10; rx < x + w - 6; rx += 22) { ctx.beginPath(); ctx.arc(rx, y + h / 2, 2, 0, TAU); ctx.fill(); }
}
