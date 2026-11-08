import { TILE, R, DT, P, CRUMBLE } from "./constants.js";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));

const NO_INPUT = Object.freeze({ left: false, right: false, jump: false });

/**
 * The whole game simulation. No DOM, no rendering — so it can run in Node
 * (tools/verify.mjs uses that to prove every level is beatable).
 *
 * Call step(input) at a fixed DT. Read & clear `events` to drive sound/particles.
 */
export class World {
  constructor(level, { lives = 3 } = {}) {
    this.L = level;
    this.maxLives = lives;
    this.lives = lives;
    this.time = 0; // seconds of play
    this.mt = 0; // mover clock
    this.status = "playing"; // playing | dead | won | gameover
    this.deadTimer = 0;
    this.events = [];
    this.stomps = 0;
    this.deaths = 0;
    this.ringGot = new Uint8Array(level.rings.length);
    this.ringCount = 0;
    this.heartGot = new Uint8Array(level.hearts.length);
    this.cpActive = -1;
    this.crState = new Uint8Array(level.crumbles.length); // 0 idle 1 shaking 2 gone
    this.crTimer = new Float32Array(level.crumbles.length);
    this.enemies = level.enemies.map((e) => ({ x: e.x, y: e.y, dir: -1, alive: true }));
    this.ball = { x: 0, y: 0, vx: 0, vy: 0, carry: 0, px: 0, py: 0, coyote: 0, jumpBuf: 0, prevJump: false, invuln: 0, inWater: false, wasInWater: false };
    this._spawnBall();
    this.ball.invuln = P.invuln;
  }

  // ---------- lifecycle ----------------------------------------------------

  get spawnPoint() {
    return this.cpActive >= 0 ? this.L.checkpoints[this.cpActive] : this.L.spawn;
  }

  _spawnBall() {
    const s = this.spawnPoint;
    Object.assign(this.ball, { x: s.x, y: s.y, vx: 0, vy: 0, carry: 0, px: s.x, py: s.y, coyote: 0, jumpBuf: 0 });
  }

  _die(kind) {
    if (this.status !== "playing") return;
    if (this.ball.invuln > 0 && kind !== "fall") return;
    this.status = "dead";
    this.deadTimer = P.deathTime;
    this.lives--;
    this.deaths++;
    this.events.push({ type: "death", x: this.ball.x, y: this.ball.y, kind });
  }

  _respawn() {
    this._spawnBall();
    this.ball.invuln = P.invuln;
    this.status = "playing";
    this.enemies.forEach((e, i) => Object.assign(e, { x: this.L.enemies[i].x, y: this.L.enemies[i].y, dir: -1, alive: true }));
    this.crState.fill(0);
    this.crTimer.fill(0);
    this.events.push({ type: "respawn", x: this.ball.x, y: this.ball.y });
  }

  clone() {
    const w = Object.create(World.prototype);
    Object.assign(w, this);
    w.events = [];
    w.ball = { ...this.ball };
    w.ringGot = this.ringGot.slice();
    w.heartGot = this.heartGot.slice();
    w.crState = this.crState.slice();
    w.crTimer = this.crTimer.slice();
    w.enemies = this.enemies.map((e) => ({ ...e }));
    return w;
  }

  // ---------- movers -------------------------------------------------------

  moverState(i, t = this.mt) {
    const m = this.L.movers[i];
    const ph = (2 * Math.PI * t) / m.period;
    const p = 0.5 - 0.5 * Math.cos(ph);
    const dp = 0.5 * Math.sin(ph) * ((2 * Math.PI) / m.period);
    return {
      x: m.ax + (m.bx - m.ax) * p,
      y: m.ay + (m.by - m.ay) * p,
      vx: (m.bx - m.ax) * dp,
      vy: (m.by - m.ay) * dp,
    };
  }

  // ---------- tile helpers -------------------------------------------------

  tileAt(tx, ty) {
    const { W, H } = this.L;
    if (tx < 0 || tx >= W || ty < 0 || ty >= H) return 0;
    return this.L.solid[ty * W + tx];
  }

  isBlocking(tx, ty) {
    // for enemies: ground and live crumbles block
    const t = this.tileAt(tx, ty);
    if (t === 1) return true;
    if (t === 2) return this.crState[this.L.crIndex[ty * this.L.W + tx]] !== 2;
    return false;
  }

  waterAt(x, y) {
    const { W, H, water } = this.L;
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    return tx >= 0 && tx < W && ty >= 0 && ty < H && water[ty * W + tx] === 1;
  }

  /** y of the first solid surface below (x,y) — used for the ball's shadow. */
  groundBelow(x, y) {
    const { H } = this.L;
    const tx = Math.floor(x / TILE);
    for (let ty = Math.max(0, Math.floor(y / TILE)); ty < H; ty++) {
      const t = this.tileAt(tx, ty);
      if (t === 1 || t === 3 || (t === 2 && this.crState[this.L.crIndex[ty * this.L.W + tx]] !== 2)) return ty * TILE;
    }
    return null;
  }

  // ---------- main step ----------------------------------------------------

  step(input = NO_INPUT) {
    if (this.status === "won" || this.status === "gameover") return;

    if (this.status === "dead") {
      this.deadTimer -= DT;
      if (this.deadTimer <= 0) {
        if (this.lives <= 0) {
          this.status = "gameover";
          this.events.push({ type: "gameover" });
        } else this._respawn();
      }
      this.mt += DT;
      return;
    }

    this.time += DT;
    this.mt += DT;
    const b = this.ball;
    if (b.invuln > 0) b.invuln -= DT;

    this._stepCrumbles();
    this._stepEnemies();
    this._stepBall(input);
    if (this.status === "playing") this._interactions();
  }

  _stepCrumbles() {
    for (let i = 0; i < this.crState.length; i++) {
      const s = this.crState[i];
      if (s === 0) continue;
      this.crTimer[i] -= DT;
      if (this.crTimer[i] > 0) continue;
      if (s === 1) {
        this.crState[i] = 2;
        this.crTimer[i] = CRUMBLE.gone;
        const c = this.L.crumbles[i];
        this.events.push({ type: "crumbled", x: c.tx * TILE + TILE / 2, y: c.ty * TILE + TILE / 2 });
      } else {
        // regrow, unless the ball is standing in the way
        const c = this.L.crumbles[i];
        const bx = this.ball.x, by = this.ball.y;
        const near = Math.abs(bx - (c.tx * TILE + TILE / 2)) < TILE / 2 + R && Math.abs(by - (c.ty * TILE + TILE / 2)) < TILE / 2 + R;
        if (near) this.crTimer[i] = 0.2;
        else this.crState[i] = 0;
      }
    }
  }

  _stepEnemies() {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const nx = e.x + e.dir * P.enemySpeed * DT;
      const frontX = nx + e.dir * 15;
      const tx = Math.floor(frontX / TILE);
      const wall = this.isBlocking(tx, Math.floor(e.y / TILE));
      const floor = this.isBlocking(tx, Math.floor((e.y + 22) / TILE));
      if (wall || !floor) e.dir = -e.dir;
      else e.x = nx;
    }
  }

  _stepBall(input) {
    const b = this.ball;
    b.px = b.x; b.py = b.y;

    b.wasInWater = b.inWater;
    b.inWater = this.waterAt(b.x, b.y);
    if (b.inWater !== b.wasInWater) this.events.push({ type: "splash", x: b.x, y: b.y, vy: b.vy, entering: b.inWater });

    const water = b.inWater;
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

    // jump buffering / coyote
    const pressed = input.jump && !b.prevJump;
    b.prevJump = input.jump;
    b.coyote -= DT;
    b.jumpBuf -= DT;
    if (pressed) {
      if (b.coyote > 0 && b.vy < 0 && !water) {
        b.vy = Math.min(b.vy, -P.jump);
        b.coyote = 0;
        this.events.push({ type: "jump", x: b.x, y: b.y });
      } else b.jumpBuf = P.jumpBuffer;
    }

    // horizontal
    const maxS = P.speed * (water ? P.waterSpeed : 1);
    if (dir !== 0) {
      if (dir * b.vx < maxS) b.vx = clamp(b.vx + dir * P.accel * DT, -maxS, maxS);
      else b.vx = approach(b.vx, dir * maxS, P.decel * DT);
    } else b.vx = approach(b.vx, 0, P.decel * DT);
    b.carry *= 1 - 2.5 * DT;

    // vertical
    b.vy += P.gravity * (water ? P.waterGravity : 1) * DT;
    if (water) {
      b.vy -= b.vy * P.waterDrag * DT;
      if (input.jump) b.vy = Math.max(b.vy - P.swimAccel * DT, -P.swimMaxUp);
    }
    if (b.vy > P.maxFall) b.vy = P.maxFall;

    b.x += (b.vx + b.carry) * DT;
    b.y += b.vy * DT;

    // level borders act as walls
    const maxX = this.L.W * TILE - R;
    if (b.x < R) { b.x = R; if (b.vx < 0) b.vx = 0; }
    if (b.x > maxX) { b.x = maxX; if (b.vx > 0) b.vx = 0; }

    this._resolve(input);

    if (b.y > this.L.H * TILE + 240) this._die("fall");
  }

  // ---------- collision ----------------------------------------------------

  _rects(b) {
    const { W, H, solid, crIndex } = this.L;
    const out = [];
    const x0 = Math.floor((b.x - R) / TILE), x1 = Math.floor((b.x + R) / TILE);
    const y0 = Math.floor((b.y - R) / TILE), y1 = Math.floor((b.y + R) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      if (ty < 0 || ty >= H) continue;
      for (let tx = x0; tx <= x1; tx++) {
        if (tx < 0 || tx >= W) continue;
        const i = ty * W + tx;
        const s = solid[i];
        if (s === 1) out.push({ x0: tx * TILE, y0: ty * TILE, x1: tx * TILE + TILE, y1: ty * TILE + TILE, vx: 0, vy: 0 });
        else if (s === 2 && this.crState[crIndex[i]] !== 2) out.push({ x0: tx * TILE, y0: ty * TILE, x1: tx * TILE + TILE, y1: ty * TILE + TILE, vx: 0, vy: 0, cr: crIndex[i] });
        else if (s === 3) out.push({ x0: tx * TILE, y0: ty * TILE, x1: tx * TILE + TILE, y1: ty * TILE + 12, vx: 0, vy: 0, oneway: true });
      }
    }
    for (const p of this.L.pads) {
      if (Math.abs(p.tx * TILE + TILE / 2 - b.x) < TILE + R && Math.abs(p.ty * TILE + TILE / 2 - b.y) < TILE + R)
        out.push({ x0: p.tx * TILE + 2, y0: p.ty * TILE + TILE * 0.55, x1: p.tx * TILE + TILE - 2, y1: p.ty * TILE + TILE, vx: 0, vy: 0, pad: p });
    }
    for (let i = 0; i < this.L.movers.length; i++) {
      const m = this.L.movers[i];
      const s = this.moverState(i);
      out.push({ x0: s.x, y0: s.y, x1: s.x + m.w, y1: s.y + m.h, vx: s.vx, vy: s.vy });
    }
    return out;
  }

  _resolve(input) {
    const b = this.ball;
    for (let iter = 0; iter < 3; iter++) {
      let any = false;
      for (const r of this._rects(b)) {
        const cx = clamp(b.x, r.x0, r.x1), cy = clamp(b.y, r.y0, r.y1);
        const dx = b.x - cx, dy = b.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= R * R) continue;

        let nx, ny, pen;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          nx = dx / d; ny = dy / d; pen = R - d;
        } else {
          const l = b.x - r.x0, rt = r.x1 - b.x, t = b.y - r.y0, bt = r.y1 - b.y;
          const m = Math.min(l, rt, t, bt);
          if (m === t) { nx = 0; ny = -1; pen = R + t; }
          else if (m === bt) { nx = 0; ny = 1; pen = R + bt; }
          else if (m === l) { nx = -1; ny = 0; pen = R + l; }
          else { nx = 1; ny = 0; pen = R + rt; }
        }

        if (r.oneway && (ny > -0.5 || b.py + R > r.y0 + 10 || b.vy - r.vy < 0)) continue;

        b.x += nx * pen;
        b.y += ny * pen;
        any = true;

        const rvx = b.vx + b.carry - r.vx;
        const rvy = b.vy - r.vy;
        const vn = rvx * nx + rvy * ny;
        if (vn >= 0) continue;

        if (ny < -0.55) this._land(r, rvy, input);
        else if (ny > 0.55) b.vy = r.vy + Math.max(40, -rvy * 0.3);
        else {
          b.vx = r.vx - rvx * P.wallRestitution;
          b.carry = 0;
        }
      }
      if (!any) break;
    }
  }

  _land(r, impact, input) {
    const b = this.ball;
    let v;
    let kind = "land";
    if (r.pad) {
      v = P.padLaunch;
      kind = "spring";
      this.events.push({ type: "spring", tx: r.pad.tx, ty: r.pad.ty });
    } else if ((b.jumpBuf > 0 || input.jump) && !b.inWater) {
      v = P.jump;
      kind = "jump";
    } else {
      v = clamp(impact * P.rest, P.hop, P.maxBounce);
      if (b.inWater) v *= 0.55;
    }
    b.vy = r.vy - v;
    b.jumpBuf = 0;
    b.coyote = P.coyote;
    b.carry = r.vx;
    if (kind === "jump") this.events.push({ type: "jump", x: b.x, y: b.y + R });
    this.events.push({ type: "land", impact, x: b.x, y: b.y + R, pad: !!r.pad });
    if (r.cr !== undefined && this.crState[r.cr] === 0) {
      this.crState[r.cr] = 1;
      this.crTimer[r.cr] = CRUMBLE.shake;
      this.events.push({ type: "crumbleStart", x: (this.L.crumbles[r.cr].tx + 0.5) * TILE, y: this.L.crumbles[r.cr].ty * TILE });
    }
  }

  // ---------- pickups, hazards, goal --------------------------------------

  _interactions() {
    const b = this.ball, L = this.L;

    for (let i = 0; i < L.rings.length; i++) {
      if (this.ringGot[i]) continue;
      const r = L.rings[i];
      if (Math.hypot(b.x - r.x, b.y - r.y) < R + 13) {
        this.ringGot[i] = 1;
        this.ringCount++;
        this.events.push({ type: "ring", x: r.x, y: r.y, index: i });
      }
    }
    for (let i = 0; i < L.hearts.length; i++) {
      if (this.heartGot[i]) continue;
      const h = L.hearts[i];
      if (Math.hypot(b.x - h.x, b.y - h.y) < R + 14) {
        this.heartGot[i] = 1;
        if (this.lives < 5) this.lives++;
        this.events.push({ type: "heart", x: h.x, y: h.y });
      }
    }
    for (let i = 0; i < L.checkpoints.length; i++) {
      const c = L.checkpoints[i];
      if (i !== this.cpActive && Math.abs(b.x - c.x) < 34 && Math.abs(b.y - (c.ty * TILE + TILE / 2)) < 70) {
        this.cpActive = i;
        this.events.push({ type: "checkpoint", x: c.x, y: c.ty * TILE + TILE / 2, index: i });
      }
    }

    for (const s of L.spikes) {
      const x0 = s.tx * TILE + 8, x1 = s.tx * TILE + TILE - 8;
      const y0 = s.dir === "up" ? s.ty * TILE + TILE * 0.42 : s.ty * TILE;
      const y1 = s.dir === "up" ? s.ty * TILE + TILE : s.ty * TILE + TILE * 0.58;
      const dx = b.x - clamp(b.x, x0, x1), dy = b.y - clamp(b.y, y0, y1);
      if (dx * dx + dy * dy < (R * 0.8) ** 2) { this._die("spike"); return; }
    }

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(b.x - e.x, b.y - e.y);
      if (d < R + 14) {
        if (b.vy > 40 && b.y < e.y - 4) {
          e.alive = false;
          this.stomps++;
          b.vy = -P.stompBounce;
          this.events.push({ type: "stomp", x: e.x, y: e.y });
        } else { this._die("enemy"); return; }
      }
    }

    if (Math.hypot(b.x - L.goal.x, b.y - L.goal.y) < 34) {
      this.status = "won";
      this.events.push({ type: "win", x: L.goal.x, y: L.goal.y });
    }
  }
}
