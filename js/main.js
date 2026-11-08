import { Renderer } from "./render/renderer.js";
import { Session, DIFFICULTIES } from "./game/session.js";
import { input } from "./game/input.js";
import { sfx } from "./ui/sfx.js";
import { music } from "./ui/music.js";
import { save } from "./ui/storage.js";
import { THEMES } from "./render/themes.js";
import { MenuBackground } from "./render/menuBackground.js";
import { transition } from "./ui/transitions.js";

const $ = (id) => document.getElementById(id);

const screens = ["start", "difficulty", "levels", "pause", "win", "over", "settings"];
const el = Object.fromEntries(screens.map((s) => [s, $(`${s}-screen`)]));

let levelIndex = [];
const levelCache = new Map();
let difficulty = save.settings.difficulty in DIFFICULTIES ? save.settings.difficulty : "normal";
let currentId = 1;
let inGame = false;
let busy = false;
let prevScreen = "start";

const renderer = new Renderer($("game"));
const menuBg = new MenuBackground($("menu-bg"));

// ---------------- HUD ----------------------------------------------------------

const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
let lastLives = null;

function onHud(h) {
  if (h.time !== undefined && h.lives === undefined) { $("hud-time").textContent = fmt(h.time); return; }
  $("hud-rings").textContent = `${h.rings}/${h.totalRings}`;
  $("hud-title").textContent = `${String(h.id).padStart(2, "0")} · ${h.name}`;
  const hearts = $("hud-hearts");
  hearts.innerHTML = "";
  for (let i = 0; i < h.maxLives; i++) {
    const s = document.createElement("span");
    s.className = "heart" + (i >= h.lives ? " lost" : "");
    if (lastLives !== null && i === h.lives && h.lives < lastLives) s.classList.add("pop");
    s.textContent = "♥";
    hearts.append(s);
  }
  lastLives = h.lives;
}

const session = new Session(renderer, { onHud, onWin: showWin, onGameOver: showGameOver });

// ---------------- helpers ------------------------------------------------------

function show(name) {
  for (const s of screens) el[s].classList.toggle("hidden", s !== name);
  if (name) { el[name].classList.remove("enter"); void el[name].offsetWidth; el[name].classList.add("enter"); }
}
const hideAll = () => show(null);

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.add("hidden"), 2200);
}

async function loadLevel(id) {
  if (!levelCache.has(id)) {
    const entry = levelIndex.find((l) => l.id === id);
    const res = await fetch(`levels/${entry.file}`);
    if (!res.ok) throw new Error(`level ${id}: HTTP ${res.status}`);
    levelCache.set(id, await res.json());
  }
  return levelCache.get(id);
}

// ---------------- level select ------------------------------------------------

function buildLevelGrid() {
  const grid = $("level-grid");
  grid.innerHTML = "";
  for (const l of levelIndex) {
    const th = THEMES[l.theme] ?? THEMES.meadow;
    const rec = save.level(l.id);
    const locked = !save.isUnlocked(l.id);
    const b = document.createElement("button");
    b.className = "lvl" + (locked ? " locked" : "");
    b.style.background = `linear-gradient(160deg, ${th.sky[0]}, ${th.sky[1]} 60%, ${th.ground.base})`;
    const stars = [1, 2, 3].map((n) => `<span class="${rec && rec.stars >= n ? "on" : "off"}">★</span>`).join("");
    b.innerHTML = `<div class="n">${String(l.id).padStart(2, "0")}</div><div class="nm">${l.name}</div><div class="st">${stars}</div>`;
    b.addEventListener("click", () => {
      sfx.click();
      if (locked) return toast("Finish the previous level to unlock this one!");
      startLevel(l.id);
    });
    grid.append(b);
  }
  $("total-stars").textContent = `★ ${save.totalStars()} / ${levelIndex.length * 3}`;
}

function openLevelSelect() {
  buildLevelGrid();
  show("levels");
  prevScreen = "levels";
}

// ---------------- game flow ----------------------------------------------------

async function startLevel(id) {
  if (busy) return;
  busy = true;
  try {
    sfx.swoosh();
    await transition("iris", async () => {
      const def = await loadLevel(id);
      currentId = id;
      session.load(def, difficulty);
      inGame = true;
      hideAll();
      menuBg.stop();
      $("game").style.visibility = "visible";
      $("hud").classList.remove("hidden");
      $("touch").classList.toggle("hidden", !isTouchDevice());
      music.play("game", 0.16, 1200);
    });
  } catch (err) {
    console.error(err);
    toast("Couldn't load the level — run via a local web server (see README).");
  }
  busy = false;
}

function leaveGame(to = "levels") {
  sfx.swoosh();
  transition("iris", () => {
    session.stop();
    inGame = false;
    $("hud").classList.add("hidden");
    $("touch").classList.add("hidden");
    $("game").style.visibility = "hidden";
    menuBg.start();
    music.play("menu", 0.12, 1500);
    if (to === "levels") openLevelSelect();
    else show(to);
  });
}

function setPaused(p) {
  if (!inGame || session.finished) return;
  session.setPaused(p);
  show(p ? "pause" : null);
}

function showWin(r) {
  const rec = save.record(currentId, r);
  show("win");
  const stats = [
    ["Time", `${fmt(r.time)}`, r.onTime],
    ["Rings", `${r.rings} / ${r.totalRings}`, r.allRings],
    ["Deaths", r.deaths, false],
    ["Score", r.score, false],
  ];
  $("win-stats").innerHTML = stats.map(([k, v, ok]) => `<li class="${ok ? "ok" : ""}"><span>${k}</span><b>${v}</b></li>`).join("") +
    `<li><span>Par</span><b>${fmt(r.par)}</b></li>`;
  $("win-best").textContent = rec.newBest ? "★ New best score! ★" : "";
  const spans = [...$("win-stars").children];
  spans.forEach((s) => s.classList.remove("on"));
  for (let i = 0; i < r.stars; i++) setTimeout(() => { spans[i].classList.add("on"); sfx.star(); }, 400 + i * 380);
  const hasNext = levelIndex.some((l) => l.id === currentId + 1);
  $("next-btn").classList.toggle("hidden", !hasNext);
}

function showGameOver() { show("over"); }

// ---------------- settings -------------------------------------------------------

function syncSettings() {
  $("set-music").textContent = `Music: ${music.enabled ? "On" : "Off"}`;
  $("set-sfx").textContent = `Sound effects: ${sfx.enabled ? "On" : "Off"}`;
  $("music-btn").classList.toggle("off", !music.enabled);
}

function isTouchDevice() {
  return matchMedia("(pointer: coarse)").matches || new URLSearchParams(location.search).has("touch");
}

// ---------------- wiring ---------------------------------------------------------

function on(id, fn) { $(id).addEventListener("click", () => { sfx.click(); fn(); }); }

on("start-btn", async () => {
  if (busy) return;
  busy = true;
  sfx.swoosh();
  await transition("stripes", () => show("difficulty"));
  busy = false;
});
on("settings-btn", () => { syncSettings(); show("settings"); });

document.querySelectorAll(".diff").forEach((b) => b.addEventListener("click", async () => {
  sfx.click();
  if (busy) return;
  busy = true;
  difficulty = b.dataset.diff;
  save.setSetting("difficulty", difficulty);
  sfx.swoosh();
  await transition("stripes", () => openLevelSelect());
  busy = false;
}));
document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", () => { sfx.click(); show(b.dataset.back); }));

on("resume-btn", () => setPaused(false));
on("pause-btn", () => setPaused(true));
on("retry-btn", () => { session.restart(); show(null); });
on("quit-btn", () => leaveGame("levels"));
on("next-btn", () => startLevel(currentId + 1));
on("replay-btn", () => startLevel(currentId));
on("win-menu-btn", () => leaveGame("levels"));
on("over-retry-btn", () => startLevel(currentId));
on("over-menu-btn", () => leaveGame("levels"));

on("music-btn", () => { music.setEnabled(!music.enabled); save.setSetting("music", music.enabled); syncSettings(); });
on("set-music", () => { music.setEnabled(!music.enabled); save.setSetting("music", music.enabled); syncSettings(); });
on("set-sfx", () => { sfx.setEnabled(!sfx.enabled); save.setSetting("sfx", sfx.enabled); syncSettings(); });
on("set-reset", () => {
  if (confirm("Erase all stars and scores?")) { save.reset(); toast("Progress reset"); }
});

input.bindTouch($("t-left"), "left");
input.bindTouch($("t-right"), "right");
input.bindTouch($("t-jump"), "jump");

input.onPress((code) => {
  if (code === "Enter" && !inGame && !el.start.classList.contains("hidden")) $("start-btn").click();
  else if (inGame && (code === "Escape" || code === "KeyP")) setPaused(!session.paused);
  else if (inGame && code === "KeyR" && !session.paused && !session.finished) session.restart();
});
document.addEventListener("visibilitychange", () => { if (document.hidden) setPaused(true); });

// ---------------- boot ---------------------------------------------------------------

music.setEnabled(save.settings.music);
sfx.setEnabled(save.settings.sfx);
syncSettings();
music.play("menu", 0.12, 3000);
show("start");
menuBg.start();

fetch("levels/index.json").then((r) => r.json()).then((idx) => { levelIndex = idx; }).catch((e) => {
  console.error(e);
  toast("Couldn't load levels — run via a local web server (see README).");
});

// debugging / tests: ?level=3 jumps straight in
const params = new URLSearchParams(location.search);
if (params.has("level")) {
  const go = () => levelIndex.length ? startLevel(+params.get("level")) : setTimeout(go, 50);
  go();
}

if (params.has("debug")) window.__boing = { session, renderer, save };
