import { drawBall } from "../render/sprites.js";

/**
 * Full-screen transitions drawn on a canvas (no video files).
 *   transition("stripes", fn)  colourful slanted bars sweep down, blob bounces, bars sweep away
 *   transition("iris", fn)     screen closes to a dot and opens again
 * `fn` runs while the screen is fully covered — swap screens / load stuff there.
 */
const canvas = document.getElementById("transition");
const ctx = canvas.getContext("2d");
let running = false;

const COLORS = ["#8a4dea", "#ff8fe0", "#7ae8ff", "#ffe27a", "#6dffd0", "#ff8a5c", "#9b7bff", "#3b1d80"];
const BARS = 9;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function size() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function drawBlob(W, H, time, alpha) {
  const cx = W / 2, base = H / 2 + 40;
  const hop = Math.abs(Math.sin(time * 6));
  const y = base - hop * 70;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath(); ctx.ellipse(cx, base + 22, 26 - hop * 10, 7 - hop * 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(cx, y); ctx.scale(2, 2); ctx.translate(-cx, -y);
  const b = { x: cx, y, vx: 90, vy: Math.cos(time * 6) * -500, carry: 0, invuln: 0 };
  drawBall(ctx, b, { squash: hop < 0.12 ? 0.3 : 0, rot: time * 3, blink: 0 }, time);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawStripes(u, W, H) {
  const slant = -H * 0.18;
  const bw = (W - slant) / BARS + 2;
  const stag = 0.07;
  const span = 1 - (BARS - 1) * stag;
  for (let i = 0; i < BARS; i++) {
    const inP = easeInOut(clamp01((Math.min(u, 1) - i * stag) / span));
    const outP = u > 1 ? easeInOut(clamp01((u - 1 - (BARS - 1 - i) * stag) / span)) : 0;
    const yB = inP * H, yT = outP * H;
    if (yB <= yT) continue;
    const x = i * bw + slant * -0.0 - 10;
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.beginPath();
    ctx.moveTo(x, yT); ctx.lineTo(x + bw + 2, yT);
    ctx.lineTo(x + bw + 2 + slant, yB); ctx.lineTo(x + slant, yB);
    ctx.closePath(); ctx.fill();
  }
}

function drawIris(u, W, H, center) {
  const maxR = Math.hypot(Math.max(center.x, W - center.x), Math.max(center.y, H - center.y)) + 20;
  const r = u <= 1 ? maxR * (1 - easeOut(u)) : maxR * easeInOut(u - 1);
  ctx.fillStyle = "#1b1038";
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.arc(center.x, center.y, Math.max(0, r), 0, Math.PI * 2, true);
  ctx.fill("evenodd");
  // glowing rim
  if (r > 2) { ctx.strokeStyle = "#c9a7ff"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(center.x, center.y, r, 0, Math.PI * 2); ctx.stroke(); }
}

function animate(ms, fn) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const f = (now) => {
      const p = clamp01((now - t0) / ms);
      fn(p);
      p < 1 ? requestAnimationFrame(f) : resolve();
    };
    requestAnimationFrame(f);
  });
}

export async function transition(kind, onCovered, { center } = {}) {
  if (running) { await onCovered?.(); return; }
  running = true;
  size();
  const W = canvas.width, H = canvas.height;
  const c = center ?? { x: W / 2, y: H / 2 };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dur = reduce ? 200 : kind === "iris" ? 480 : 560;
  canvas.style.display = "block";
  const t0 = performance.now();
  const frame = (u, blobAlpha = 0) => {
    ctx.clearRect(0, 0, W, H);
    if (reduce) { ctx.fillStyle = `rgba(27,16,56,${u <= 1 ? u : 2 - u})`; ctx.fillRect(0, 0, W, H); return; }
    kind === "iris" ? drawIris(u, W, H, c) : drawStripes(u, W, H);
    if (blobAlpha > 0) drawBlob(W, H, (performance.now() - t0) / 1000, blobAlpha);
  };

  let error = null;
  try {
    await animate(dur, (p) => frame(p, p > 0.7 ? (p - 0.7) / 0.3 : 0));          // cover
    let done = false;
    const work = Promise.resolve().then(() => onCovered?.()).catch((e) => { error = e; }).finally(() => { done = true; });
    const holdStart = performance.now();
    await new Promise((res) => {                                                  // hold while work runs
      const f = (now) => { frame(1, 1); done && now - holdStart > 350 ? res() : requestAnimationFrame(f); };
      requestAnimationFrame(f);
    });
    await work;
    await animate(dur, (p) => frame(1 + p, p < 0.25 ? 1 - p / 0.25 : 0));          // reveal
  } finally {
    ctx.clearRect(0, 0, W, H);
    canvas.style.display = "none";
    running = false;
  }
  if (error) throw error;
}

export const isTransitioning = () => running;
