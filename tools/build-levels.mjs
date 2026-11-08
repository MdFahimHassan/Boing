// Generates levels/*.json from small drawing scripts, so levels are easy to author.
// Run: npm run levels   (the JSON files are what the game actually loads)
import { writeFileSync } from "node:fs";

class Grid {
  constructor(W, H) { this.W = W; this.H = H; this.rows = Array.from({ length: H }, () => Array(W).fill(".")); this.movers = []; this.waterRects = []; }
  at(x, y, c) { if (x >= 0 && x < this.W && y >= 0 && y < this.H) this.rows[y][x] = c; return this; }
  rect(x, y, w, h, c = "#") { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.at(x + i, y + j, c); return this; }
  ground(x0, x1, top, c = "#") { return this.rect(x0, top, x1 - x0 + 1, this.H - top, c); }
  hole(x0, x1) { return this.rect(x0, 0, x1 - x0 + 1, this.H, ".").clearBelow(); }
  clearBelow() { return this; }
  carve(x0, y0, x1, y1) { return this.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, "."); }
  plat(x, y, w) { return this.rect(x, y, w, 1, "-"); }
  spikes(x0, x1, y, c = "^") { for (let x = x0; x <= x1; x++) this.at(x, y, c); return this; }
  rings(x0, x1, y) { for (let x = x0; x <= x1; x++) this.at(x, y, "o"); return this; }
  arc(cx, y, n, h = 1) { // n rings in an arch centred on cx, peaking h tiles above y
    for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1); this.at(Math.round(cx - (n - 1) / 2 + i), Math.round(y - h * Math.sin(Math.PI * t)), "o"); }
    return this;
  }
  water(x0, y0, x1, y1) { this.waterRects.push([x0, y0, x1, y1]); return this; } // flooded region (pickups & platforms may sit inside it)
  mover(x, y, w, toX, toY, speed) { this.movers.push({ x, y, w, toX, toY, speed }); return this; }
  out(def) { return { ...def, map: this.rows.map((r) => r.join("")), movers: this.movers, water: this.waterRects }; }
}

const levels = [];

// 1 ───────────────────────────────────────────────────────────────────────────
{
  const g = new Grid(78, 14);
  g.ground(0, 77, 11);
  g.hole(30, 31);
  g.at(3, 10, "S");
  g.rings(8, 11, 9);
  g.rect(16, 10, 6, 1);                 // gentle step
  g.rings(17, 20, 8);
  g.arc(30.5, 9, 4, 1.5);
  g.at(36, 10, "B");                    // spring up to the sky platform
  g.plat(34, 5, 6); g.rings(35, 38, 3); g.at(39, 4, "h");
  g.at(43, 10, "C");
  g.spikes(49, 50, 10); g.arc(49.5, 9, 5, 1.5);
  g.rect(56, 9, 4, 2); g.rings(56, 59, 7);
  g.at(66, 10, "e"); g.rings(62, 64, 9);
  g.at(73, 10, "G");
  levels.push(g.out({ id: 1, name: "Hello, Hills", theme: "meadow", par: 48 }));
}

// 2 ───────────────────────────────────────────────────────────────────────────
{
  const g = new Grid(100, 14);
  g.ground(0, 99, 11);
  g.at(3, 10, "S");
  g.spikes(12, 14, 10); g.arc(13, 9, 5, 2);
  g.spikes(19, 19, 10); g.rings(18, 20, 8);
  g.hole(26, 28); g.arc(27, 9, 5, 2);
  g.at(35, 10, "e"); g.at(41, 10, "e"); g.rings(33, 43, 8);
  g.at(47, 10, "C");
  g.rect(51, 10, 2, 1); g.rect(54, 9, 2, 2); g.rect(57, 8, 5, 3);   // stairs up
  g.rings(51, 52, 8); g.rings(54, 55, 7); g.rings(58, 61, 6);
  g.rect(66, 5, 9, 1); g.spikes(66, 74, 6, "v");                    // spiked ceiling: stay low!
  g.rings(67, 73, 10);
  g.at(78, 10, "h");
  g.hole(80, 82); g.plat(80, 9, 3); g.arc(81, 8, 3, 1);
  g.hole(86, 87); g.spikes(89, 89, 10); g.at(92, 10, "e");
  g.at(96, 10, "G");
  levels.push(g.out({ id: 2, name: "Spike Garden", theme: "meadow", par: 60 }));
}

// 3 ───────────────────────────────────────────────────────────────────────────
{
  const g = new Grid(108, 15);
  g.ground(0, 12, 12); g.at(3, 11, "S");
  g.ground(13, 20, 11); g.ground(21, 27, 10); g.ground(28, 34, 11);
  g.rings(14, 19, 9); g.rings(22, 26, 8);
  g.spikes(24, 24, 9);
  // crumble bridge over a pit
  g.hole(35, 46); g.rect(35, 11, 12, 1, "c"); g.rings(37, 44, 9);
  g.ground(47, 52, 11); g.at(49, 10, "C");
  // wide gap crossed by a moving platform
  g.hole(53, 66); g.mover(53, 11, 3, 63, 11, 90); g.arc(59, 9, 7, 2);
  g.ground(67, 73, 11);
  g.at(70, 10, "e"); g.at(72, 10, "B"); g.plat(70, 5, 6); g.rings(71, 74, 3); g.at(75, 4, "h");
  g.ground(74, 84, 9); g.ground(85, 90, 11);
  g.rings(76, 83, 7); g.spikes(80, 81, 8);
  g.hole(91, 94); g.rect(91, 11, 4, 1, "c"); g.rings(91, 94, 9);
  g.ground(95, 107, 10);
  g.at(98, 9, "C"); g.at(100, 9, "e"); g.at(104, 9, "G");
  levels.push(g.out({ id: 3, name: "Sunset Ridge", theme: "dusk", par: 75 }));
}

// 4 ───────────────────────────────────────────────────────────────────────────
{
  const g = new Grid(104, 15);
  g.ground(0, 103, 12);
  g.rect(0, 0, 104, 3);                                   // ceiling
  g.at(3, 11, "S");
  g.spikes(10, 13, 3, "v"); g.spikes(24, 26, 3, "v");
  g.rect(16, 8, 9, 2);                                    // low tunnel: only hops fit under
  g.rings(17, 23, 11);
  g.rect(30, 9, 3, 1); g.rect(30, 10, 1, 2); g.rings(30, 32, 8);
  g.hole(36, 38); g.arc(37, 10, 3, 1);
  g.at(43, 11, "e"); g.at(49, 11, "e"); g.rings(41, 51, 9);
  g.at(54, 11, "C");
  g.at(58, 11, "B"); g.plat(56, 5, 8); g.rings(57, 62, 4); g.at(63, 4, "h");
  g.spikes(66, 69, 11); g.arc(67.5, 10, 5, 2);
  g.rect(72, 8, 10, 1); g.spikes(72, 81, 9, "v"); g.rings(73, 80, 11);
  g.at(84, 11, "e");
  g.hole(88, 90); g.plat(88, 9, 3); g.rings(88, 90, 7);
  g.at(94, 11, "C"); g.spikes(97, 98, 11); g.rings(96, 99, 9);
  g.at(101, 11, "G");
  levels.push(g.out({ id: 4, name: "Crystal Cavern", theme: "cave", par: 70 }));
}

// 5 ───────────────────────────────────────────────────────────────────────────
{
  const g = new Grid(104, 16);
  g.ground(0, 103, 14);
  g.ground(0, 11, 8); g.at(3, 7, "S");
  g.ground(92, 103, 8); g.at(100, 7, "G");
  g.carve(12, 0, 91, 13);
  g.water(12, 8, 91, 13);
  g.at(10, 7, "C");
  g.rect(20, 11, 3, 3); g.spikes(20, 22, 10);               // spiky pillar
  g.arc(14.5, 7, 5, 2);
  g.rect(30, 8, 3, 3); g.spikes(30, 32, 11, "v");           // hanging spiky block
  g.rings(29, 33, 13);
  g.rect(40, 10, 2, 4); g.rect(46, 8, 2, 6); g.spikes(40, 41, 9); g.rings(36, 47, 12);
  g.plat(52, 10, 4); g.rings(52, 55, 8); g.at(56, 7, "h");
  g.rect(62, 8, 2, 3); g.spikes(62, 63, 11, "v"); g.rect(62, 13, 2, 1); g.rings(60, 66, 10);
  g.rect(70, 10, 2, 4); g.spikes(70, 71, 9); g.rect(76, 8, 2, 3); g.spikes(76, 77, 11, "v");
  g.rings(72, 75, 12); g.at(82, 9, "e");
  g.at(86, 13, "C");
  g.rect(84, 9, 1, 3); g.rings(86, 90, 10);
  levels.push(g.out({ id: 5, name: "Deep Blue", theme: "lagoon", par: 85 }));
}

// 6 ───────────────────────────────────────────────────────────────────────────
{
  const g = new Grid(116, 14);
  g.ground(0, 9, 11); g.at(3, 10, "S");
  g.mover(10, 11, 3, 18, 11, 100); g.rings(12, 17, 9);
  g.ground(20, 26, 11); g.at(23, 10, "e");
  g.rect(28, 11, 5, 1, "c"); g.rect(34, 10, 5, 1, "c"); g.rect(40, 9, 5, 1, "c"); g.rings(29, 43, 7);
  g.ground(46, 52, 8); g.at(49, 7, "C"); g.spikes(50, 51, 7);
  g.mover(53, 8, 3, 53, 12, 70); g.mover(58, 6, 3, 64, 6, 90);
  g.ground(68, 76, 9); g.at(72, 8, "e"); g.at(70, 8, "e"); g.rings(69, 75, 6);
  g.at(77, 8, "B"); g.plat(79, 3, 6); g.rings(79, 84, 1); g.at(85, 2, "h");
  g.ground(78, 84, 9);
  g.hole(85, 92); g.mover(85, 9, 3, 90, 9, 100); g.arc(88, 8, 6, 2);
  g.ground(93, 100, 9); g.at(96, 8, "C"); g.spikes(98, 99, 8);
  g.rect(103, 9, 3, 1, "c"); g.rect(107, 8, 3, 1, "c"); g.rings(103, 109, 6);
  g.ground(111, 115, 8); g.at(113, 7, "G");
  levels.push(g.out({ id: 6, name: "Moonlit Run", theme: "night", par: 90 }));
}

// 7 ───────────────────────────────────────────────────────────────────────────
{
  const g = new Grid(124, 16);
  const isle = (x0, x1, top) => g.rect(x0, top, x1 - x0 + 1, 2, "#");
  isle(0, 8, 12); g.at(3, 11, "S");
  isle(12, 17, 11); g.rings(12, 17, 9);
  isle(21, 25, 10); g.at(23, 9, "e");
  g.plat(28, 8, 3); g.plat(33, 6, 3); g.plat(38, 8, 3); g.rings(28, 40, 4);
  isle(43, 49, 10); g.at(46, 9, "C"); g.at(48, 9, "B");
  g.plat(46, 3, 6); g.rings(46, 51, 1); g.at(52, 2, "h");
  isle(54, 58, 10); g.spikes(55, 56, 9);
  g.mover(60, 9, 3, 68, 9, 80); g.mover(70, 7, 3, 76, 7, 80);
  isle(79, 85, 8); g.at(82, 7, "e");
  g.plat(88, 7, 3); g.plat(92, 5, 3); g.plat(96, 7, 3); g.rings(88, 98, 3);
  isle(101, 106, 10); g.at(103, 9, "C");
  g.rect(108, 10, 1, 1, "c"); g.rect(111, 9, 1, 1, "c"); g.rect(114, 8, 1, 1, "c"); g.rings(108, 114, 6);
  isle(117, 123, 8); g.at(120, 7, "G");
  levels.push(g.out({ id: 7, name: "Cloud Nine", theme: "sky", par: 95 }));
}

// 8 ───────────────────────────────────────────────────────────────────────────
{
  const g = new Grid(24, 48);
  g.rect(0, 0, 2, 48); g.rect(22, 0, 2, 48); g.rect(0, 46, 24, 2);
  g.at(11, 45, "S");
  const row = (y, x0, x1, c = "-") => g.rect(x0, y, x1 - x0 + 1, 1, c);
  // climb: every step is 2 tiles up with a <=3 tile gap, alternating sides
  row(44, 13, 20); g.at(17, 43, "o");
  row(42, 3, 10); g.at(6, 41, "o");
  row(40, 13, 20); g.at(16, 39, "o");
  row(38, 3, 10); g.at(7, 37, "o");
  row(36, 12, 20, "#"); g.spikes(14, 15, 35); g.at(19, 35, "C"); g.rings(16, 18, 34);
  row(34, 3, 10, "c"); g.rings(4, 9, 32);
  row(32, 12, 20, "#"); g.at(16, 31, "e"); g.at(13, 31, "h");
  row(30, 3, 10); g.at(5, 29, "o");
  row(28, 13, 20);
  row(26, 3, 10, "#"); g.at(6, 25, "B"); g.rings(3, 4, 24);
  row(20, 3, 10); g.rings(4, 9, 18);
  row(18, 13, 20); g.at(16, 17, "o");
  row(16, 7, 12, "c"); g.at(9, 15, "o");
  row(14, 13, 20, "#"); g.spikes(15, 16, 13); g.at(19, 13, "C"); g.rings(13, 18, 11);
  row(12, 3, 10); g.at(6, 11, "o");
  g.mover(3, 10, 3, 17, 10, 90); g.rings(8, 14, 8);
  row(8, 13, 20);
  row(6, 3, 10); g.rings(4, 9, 4);
  row(4, 11, 17, "#"); g.at(14, 3, "G"); g.rings(12, 13, 2);
  levels.push(g.out({ id: 8, name: "Boing Tower", theme: "night", par: 110 }));
}

for (const lv of levels) writeFileSync(`levels/level${String(lv.id).padStart(2, "0")}.json`, JSON.stringify(lv));
writeFileSync("levels/index.json", JSON.stringify(levels.map((l) => ({ id: l.id, file: `level${String(l.id).padStart(2, "0")}.json`, name: l.name, theme: l.theme }))));
console.log(`wrote ${levels.length} levels`);
