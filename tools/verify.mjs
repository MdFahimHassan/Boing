// Proves every level is beatable: a beam-search bot plays the *real* simulation.
//   npm run verify            all levels
//   npm run verify -- 3 5     only levels 3 and 5
// Also reports which rings the bot can reach, and a suggested par time.
import { readFileSync } from "node:fs";
import { World } from "../js/sim/world.js";
import { parseLevel } from "../js/sim/level.js";
import { TILE, DT } from "../js/sim/constants.js";

const ACTIONS = [];
for (const dir of [1, -1, 0]) for (const jump of [true, false]) ACTIONS.push({ left: dir < 0, right: dir > 0, jump });
const HOLD = 18; // physics steps per action (0.15 s)

function distanceField(L, tx0, ty0) {
  const { W, H } = L;
  const blocked = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (L.solid[i] === 1 || L.solid[i] === 2) blocked[i] = 1;
  for (const s of L.spikes) blocked[s.ty * W + s.tx] = 1;
  const d = new Float32Array(W * H).fill(1e9);
  const q = [[tx0, ty0]]; d[ty0 * W + tx0] = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const [x, y] = q[qi];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const i = ny * W + nx;
      if (blocked[i]) continue;
      const nd = d[y * W + x] + (dx && dy ? 1.4 : 1);
      if (nd < d[i]) { d[i] = nd; q.push([nx, ny]); }
    }
  }
  return d;
}

function search(start, L, target, { beam = 160, maxIter = 600, goal = (w) => w.status === "won" } = {}) {
  const df = distanceField(L, Math.floor(target.x / TILE), Math.floor(target.y / TILE));
  const score = (w) => {
    const tx = Math.min(L.W - 1, Math.max(0, Math.floor(w.ball.x / TILE))), ty = Math.min(L.H - 1, Math.max(0, Math.floor(w.ball.y / TILE)));
    return df[ty * L.W + tx] * TILE + Math.hypot(w.ball.x - target.x, w.ball.y - target.y) * 0.3;
  };
  let frontier = [{ w: start, parent: null, act: null, s: score(start) }];
  const seen = new Set();
  let best = frontier[0];
  for (let it = 0; it < maxIter; it++) {
    const next = [];
    for (const n of frontier) {
      for (const a of ACTIONS) {
        const w = n.w.clone();
        for (let k = 0; k < HOLD && w.status === "playing"; k++) {
          w.step(a);
          if (goal(w)) break;
        }
        if (w.status === "dead" || w.status === "gameover") continue;
        const child = { w, parent: n, act: a, s: score(w), it };
        if (goal(w)) return { found: true, node: child, iters: it + 1 };
        const b = w.ball;
        const key = `${Math.round(b.x / 14)}|${Math.round(b.y / 14)}|${Math.round(b.vx / 100)}|${Math.round(b.vy / 220)}|${w.cpActive}|${w.ringCount}|${w.enemies.map((e) => +e.alive).join("")}`;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(child);
      }
    }
    if (!next.length) break;
    next.sort((a, b) => a.s - b.s);
    // keep the best few per screen-cell so "waiting on a platform" isn't crowded out by "rushing ahead"
    const perCell = new Map();
    frontier = [];
    for (const n of next) {
      const k = `${Math.floor(n.w.ball.x / 96)}|${Math.floor(n.w.ball.y / 96)}`;
      const c = perCell.get(k) ?? 0;
      if (c >= 8) continue;
      perCell.set(k, c + 1);
      frontier.push(n);
      if (frontier.length >= beam) break;
    }
    if (frontier[0].s < best.s) best = frontier[0];
  }
  return { found: false, node: best };
}

const pathOf = (node) => { const out = []; for (let n = node; n; n = n.parent) out.push(n); return out.reverse(); };

const index = JSON.parse(readFileSync("levels/index.json", "utf8"));
const only = process.argv.slice(2).map(Number);
let failed = 0;

for (const entry of index) {
  if (only.length && !only.includes(entry.id)) continue;
  const def = JSON.parse(readFileSync(`levels/${entry.file}`, "utf8"));
  const L = parseLevel(def);
  const t0 = Date.now();
  const res = search(new World(L, { lives: 99 }), L, L.goal, { beam: 300, maxIter: 900 });
  if (!res.found) {
    const b = res.node.w.ball;
    console.log(`✗ ${def.id} ${def.name}: bot got stuck near tile (${Math.floor(b.x / TILE)}, ${Math.floor(b.y / TILE)})`);
    failed++;
    continue;
  }
  const path = pathOf(res.node);
  const w = res.node.w;
  console.log(`✓ ${def.id} ${def.name}: beaten in ${w.time.toFixed(1)}s of play, ${w.ringCount}/${L.rings.length} rings on the way (par ${def.par}s)  [${((Date.now() - t0) / 1000).toFixed(0)}s to verify]`);

  // can each missed ring be reached from the nearest point on the winning route?
  const missed = [];
  for (let i = 0; i < L.rings.length; i++) {
    if (w.ringGot[i]) continue;
    const r = L.rings[i];
    let from = path[0];
    for (const n of path) if (Math.hypot(n.w.ball.x - r.x, n.w.ball.y - r.y) < Math.hypot(from.w.ball.x - r.x, from.w.ball.y - r.y)) from = n;
    const start = from.w.clone(); start.status = "playing";
    const rr = search(start, L, r, { beam: 120, maxIter: 120, goal: (x) => x.ringGot[i] === 1 });
    if (!rr.found) missed.push(`#${i}@(${Math.floor(r.x / TILE)},${Math.floor(r.y / TILE)})`);
  }
  if (missed.length) { console.log(`    ⚠ rings the bot could not reach: ${missed.join(" ")}`); }
}
process.exit(failed ? 1 : 0);
