import { DT } from "../sim/constants.js";
import { World } from "../sim/world.js";
import { parseLevel } from "../sim/level.js";
import { input } from "./input.js";
import { sfx } from "../ui/sfx.js";

export const DIFFICULTIES = {
  easy: { label: "Easy", lives: 5 },
  normal: { label: "Normal", lives: 3 },
  hard: { label: "Hard", lives: 2 },
};

/** Runs one level: fixed-timestep simulation, event routing, results. */
export class Session {
  constructor(renderer, { onHud, onWin, onGameOver }) {
    this.renderer = renderer;
    this.onHud = onHud;
    this.onWin = onWin;
    this.onGameOver = onGameOver;
    this.world = null;
    this.paused = true;
    this.running = false;
    this.acc = 0;
    this.last = 0;
    this.raf = 0;
    this.finished = false;
  }

  load(levelDef, difficulty) {
    this.def = levelDef;
    this.difficulty = difficulty;
    this.level = parseLevel(levelDef);
    this.restart();
  }

  restart() {
    this.world = new World(this.level, { lives: DIFFICULTIES[this.difficulty].lives });
    this.renderer.setWorld(this.world);
    this.finished = false;
    this.acc = 0;
    this.paused = false;
    input.clear();
    this.pushHud();
    if (!this.running) this.run();
  }

  run() {
    this.running = true;
    this.last = performance.now();
    const frame = (now) => {
      if (!this.running) return;
      const dt = Math.min((now - this.last) / 1000, 0.1);
      this.last = now;
      this.tick(dt);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    input.clear();
  }

  setPaused(p) {
    this.paused = p;
    this.last = performance.now();
    if (p) input.clear();
  }

  tick(dt) {
    const w = this.world;
    if (!this.paused) {
      this.acc += dt;
      const inp = input.state();
      let guard = 0;
      while (this.acc >= DT && guard++ < 20) {
        w.step(inp);
        this.acc -= DT;
      }
      if (w.events.length) {
        const ev = w.events;
        w.events = [];
        ev.forEach((e) => sfx.forEvent(e));
        this.renderer.handleEvents(ev);
        if (ev.some((e) => ["ring", "heart", "death", "respawn"].includes(e.type))) this.pushHud();
      }
      this.pushHudTime();
      if (!this.finished) {
        if (w.status === "won") { this.finished = true; setTimeout(() => this.onWin(this.result()), 1100); }
        else if (w.status === "gameover") { this.finished = true; setTimeout(() => this.onGameOver(), 1200); }
      }
    }
    this.renderer.update(this.paused ? 0 : dt);
    this.renderer.draw();
  }

  result() {
    const w = this.world, d = this.def;
    const total = this.level.rings.length;
    const allRings = w.ringCount >= total;
    const onTime = w.time <= d.par;
    const stars = 1 + (allRings ? 1 : 0) + (onTime ? 1 : 0);
    const score = w.ringCount * 100 + w.stomps * 200 + Math.max(0, Math.round((d.par - w.time) * 10)) + w.lives * 50;
    return { stars, score, time: w.time, rings: w.ringCount, totalRings: total, deaths: w.deaths, allRings, onTime, par: d.par, stomps: w.stomps };
  }

  pushHud() {
    const w = this.world;
    this.onHud({ lives: w.lives, maxLives: Math.max(w.maxLives, w.lives), rings: w.ringCount, totalRings: this.level.rings.length, name: this.def.name, id: this.def.id });
  }

  pushHudTime() { this.onHud({ time: this.world.time }); }
}
