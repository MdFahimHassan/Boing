import { TILE } from "../sim/constants.js";

/** Tiny deterministic RNG so procedural art is stable between runs. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

const roundedRect = (ctx, x, y, w, h, radii) => {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, radii); }
  else { ctx.beginPath(); ctx.rect(x, y, w, h); }
};

/**
 * Pre-renders every tile sprite once per theme/zoom, so drawing a frame is just drawImage.
 * `px` = on-screen pixels per tile.
 */
export function buildAtlas(theme, px) {
  const k = px / TILE; // scale factor from tile units
  const g = theme.ground;
  const atlas = { px, ground: new Map(), oneway: null, crumble: null, spikeUp: null, spikeDown: null, padBase: null };

  // ---- ground: 16 edge masks x 3 variants -------------------------------
  for (let mask = 0; mask < 16; mask++) {
    const variants = [];
    for (let v = 0; v < 3; v++) variants.push(groundTile(mask, v));
    atlas.ground.set(mask, variants);
  }

  function groundTile(mask, variant) {
    const up = mask & 1, right = mask & 2, down = mask & 4, left = mask & 8; // bit set = neighbour is solid
    const c = makeCanvas(px, px);
    const ctx = c.getContext("2d");
    const S = px;
    const r = S * 0.3;
    const rad = [!up && !left ? r : 0, !up && !right ? r : 0, !down && !right ? r : 0, !down && !left ? r : 0];
    roundedRect(ctx, 0, 0, S, S, rad);
    ctx.save();
    ctx.clip();

    ctx.fillStyle = g.base;
    ctx.fillRect(0, 0, S, S);
    // soft vertical shade
    const sh = ctx.createLinearGradient(0, 0, 0, S);
    sh.addColorStop(0, "rgba(255,255,255,0.05)");
    sh.addColorStop(1, "rgba(0,0,0,0.18)");
    ctx.fillStyle = sh;
    ctx.fillRect(0, 0, S, S);

    // specks / pebbles
    const rand = rng(mask * 31 + variant * 977 + 5);
    for (let i = 0; i < 9; i++) {
      const x = rand() * S, y = rand() * S, rr = (1.5 + rand() * 3.5) * k;
      ctx.fillStyle = rand() < 0.5 ? g.speck : g.dark;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.ellipse(x, y, rr * 1.3, rr, rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // top cap (grass / snow / crystal)
    if (!up) {
      const h = 11 * k;
      ctx.fillStyle = g.topDark;
      ctx.fillRect(0, 0, S, h + 4 * k);
      ctx.fillStyle = g.top;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(S, 0);
      ctx.lineTo(S, h);
      const step = S / 5;
      for (let i = 5; i >= 0; i--) {
        const x = i * step;
        ctx.lineTo(x + step * 0.5, h + (variant % 2 ? 4 : 2.5) * k);
        ctx.lineTo(x, h);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(0, 0, S, 2.5 * k);
    }
    // side & bottom shading where the block meets air
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    if (!left) ctx.fillRect(0, 0, 3 * k, S);
    if (!right) ctx.fillRect(S - 3 * k, 0, 3 * k, S);
    if (!down) { ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, S - 5 * k, S, 5 * k); }
    ctx.restore();

    // outline on exposed edges only
    ctx.strokeStyle = g.edge;
    ctx.lineWidth = 2.5 * k;
    ctx.lineCap = "round";
    const o = ctx.lineWidth / 2;
    ctx.beginPath();
    if (!up) { ctx.moveTo(rad[0] ? r : 0, o); ctx.lineTo(S - (rad[1] ? r : 0), o); }
    if (!down) { ctx.moveTo(rad[3] ? r : 0, S - o); ctx.lineTo(S - (rad[2] ? r : 0), S - o); }
    if (!left) { ctx.moveTo(o, rad[0] ? r : 0); ctx.lineTo(o, S - (rad[3] ? r : 0)); }
    if (!right) { ctx.moveTo(S - o, rad[1] ? r : 0); ctx.lineTo(S - o, S - (rad[2] ? r : 0)); }
    ctx.stroke();
    // rounded corner arcs
    const arc = (cx, cy, a0) => { ctx.beginPath(); ctx.arc(cx, cy, r - o, a0, a0 + Math.PI / 2); ctx.stroke(); };
    if (rad[0]) arc(r, r, Math.PI);
    if (rad[1]) arc(S - r, r, Math.PI * 1.5);
    if (rad[2]) arc(S - r, S - r, 0);
    if (rad[3]) arc(r, S - r, Math.PI / 2);
    return c;
  }

  // ---- one-way platform ---------------------------------------------------
  {
    const c = makeCanvas(px, px);
    const ctx = c.getContext("2d");
    const h = 12 * k;
    roundedRect(ctx, 0, 1.5 * k, px, h, [5 * k]);
    ctx.fillStyle = g.top;
    ctx.fill();
    ctx.lineWidth = 2.5 * k;
    ctx.strokeStyle = g.edge;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillRect(4 * k, 4 * k, px - 8 * k, 2.5 * k);
    atlas.oneway = c;
  }

  // ---- crumble block ------------------------------------------------------
  {
    const c = makeCanvas(px, px);
    const ctx = c.getContext("2d");
    roundedRect(ctx, 1 * k, 1 * k, px - 2 * k, px - 2 * k, [6 * k]);
    ctx.fillStyle = g.speck;
    ctx.fill();
    ctx.lineWidth = 2.5 * k;
    ctx.strokeStyle = g.edge;
    ctx.stroke();
    ctx.strokeStyle = g.dark;
    ctx.lineWidth = 2 * k;
    ctx.beginPath();
    ctx.moveTo(px * 0.3, 2 * k); ctx.lineTo(px * 0.42, px * 0.35); ctx.lineTo(px * 0.28, px * 0.6); ctx.lineTo(px * 0.4, px - 3 * k);
    ctx.moveTo(px * 0.72, 3 * k); ctx.lineTo(px * 0.62, px * 0.45); ctx.lineTo(px * 0.78, px * 0.7);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(4 * k, 4 * k, px - 8 * k, 3 * k);
    atlas.crumble = c;
  }

  // ---- spikes ---------------------------------------------------------------
  const spike = (flip) => {
    const c = makeCanvas(px, px);
    const ctx = c.getContext("2d");
    if (flip) { ctx.translate(0, px); ctx.scale(1, -1); }
    const base = px - 3 * k;
    const tip = px * 0.28;
    for (let i = 0; i < 2; i++) {
      const x0 = px * (0.04 + i * 0.5), x1 = x0 + px * 0.44;
      const grad = ctx.createLinearGradient(x0, tip, x1, base);
      grad.addColorStop(0, "#f4f8ff");
      grad.addColorStop(0.5, "#aab6c8");
      grad.addColorStop(1, "#6a7488");
      ctx.beginPath();
      ctx.moveTo(x0, base); ctx.lineTo((x0 + x1) / 2, tip); ctx.lineTo(x1, base); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
      ctx.lineWidth = 2 * k; ctx.strokeStyle = "#2c3244"; ctx.lineJoin = "round"; ctx.stroke();
    }
    ctx.fillStyle = "#3a4258";
    ctx.fillRect(0, base - 1 * k, px, 4 * k);
    return c;
  };
  atlas.spikeUp = spike(false);
  atlas.spikeDown = spike(true);

  // ---- spring pad base ------------------------------------------------------
  {
    const c = makeCanvas(px, px);
    const ctx = c.getContext("2d");
    roundedRect(ctx, 3 * k, px * 0.82, px - 6 * k, px * 0.18, [4 * k, 4 * k, 0, 0]);
    ctx.fillStyle = "#e0527a"; ctx.fill();
    ctx.lineWidth = 2.5 * k; ctx.strokeStyle = "#5a1730"; ctx.stroke();
    atlas.padBase = c;
  }
  return atlas;
}
