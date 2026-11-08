import { TILE } from "./constants.js";

/**
 * Level JSON:
 *  { id, name, theme, par, map: ["....", ...], movers: [{x,y,w,toX,toY,speed}] }
 *
 * Map legend:
 *  #  ground            -  one-way platform      c  crumble block
 *  ^  spike (floor)     v  spike (ceiling)       B  spring pad
 *  o  ring              h  heart (+1 life)       C  checkpoint
 *  S  start             G  goal portal           e  walker enemy
 *  ~  water             .  empty
 * plus optional "water": [[x0,y0,x1,y1],...] flooded rectangles and "movers".
 */
export function parseLevel(def) {
  const H = def.map.length;
  const W = def.map[0].length;
  const L = {
    def, W, H,
    solid: new Uint8Array(W * H), // 1 ground, 2 crumble, 3 one-way
    water: new Uint8Array(W * H),
    crIndex: new Int16Array(W * H).fill(-1),
    crumbles: [], pads: [], spikes: [], rings: [], hearts: [],
    checkpoints: [], enemies: [], movers: [],
    spawn: null, goal: null,
  };

  for (let ty = 0; ty < H; ty++) {
    if (def.map[ty].length !== W) throw new Error(`${def.name}: row ${ty} has ${def.map[ty].length} cols, expected ${W}`);
    for (let tx = 0; tx < W; tx++) {
      const ch = def.map[ty][tx];
      const i = ty * W + tx;
      const cx = tx * TILE + TILE / 2;
      const cy = ty * TILE + TILE / 2;
      switch (ch) {
        case "#": L.solid[i] = 1; break;
        case "-": L.solid[i] = 3; break;
        case "c": L.solid[i] = 2; L.crIndex[i] = L.crumbles.length; L.crumbles.push({ tx, ty }); break;
        case "^": L.spikes.push({ tx, ty, dir: "up" }); break;
        case "v": L.spikes.push({ tx, ty, dir: "down" }); break;
        case "B": L.pads.push({ tx, ty }); break;
        case "o": L.rings.push({ x: cx, y: cy }); break;
        case "h": L.hearts.push({ x: cx, y: cy }); break;
        case "C": L.checkpoints.push({ tx, ty, x: cx, y: ty * TILE + TILE - 17 }); break;
        case "S": L.spawn = { x: cx, y: cy }; break;
        case "G": L.goal = { tx, ty, x: cx, y: cy }; break;
        case "e": L.enemies.push({ x: cx, y: ty * TILE + TILE - 16 }); break;
        case "~": L.water[i] = 1; break;
        case ".": case " ": break;
        default: throw new Error(`${def.name}: unknown tile '${ch}' at ${tx},${ty}`);
      }
    }
  }
  for (const m of def.movers ?? []) {
    const ax = m.x * TILE, ay = m.y * TILE;
    const bx = (m.toX ?? m.x) * TILE, by = (m.toY ?? m.y) * TILE;
    const len = Math.hypot(bx - ax, by - ay) || 1;
    L.movers.push({ ax, ay, bx, by, w: m.w * TILE, h: 18, period: (2 * len) / (m.speed ?? 80) });
  }
  for (const [x0, y0, x1, y1] of def.water ?? []) {
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (tx >= 0 && tx < W && ty >= 0 && ty < H && L.solid[ty * W + tx] !== 1 && L.solid[ty * W + tx] !== 2) L.water[ty * W + tx] = 1;
    }
  }
  if (!L.spawn) throw new Error(`${def.name}: no start tile 'S'`);
  if (!L.goal) throw new Error(`${def.name}: no goal tile 'G'`);
  return L;
}
