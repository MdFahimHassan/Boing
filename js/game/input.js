// Keyboard + touch → { left, right, jump }
const BINDINGS = {
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  jump: ["ArrowUp", "KeyW", "Space", "KeyZ"],
};
const GAME_KEYS = new Set([...Object.values(BINDINGS).flat(), "Escape"]);

const held = new Set();
const touch = { left: false, right: false, jump: false };
const listeners = new Set();

window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLElement && e.target.tagName === "INPUT") return;
  held.add(e.code);
  if (GAME_KEYS.has(e.code) && e.code !== "Escape" && !e.repeat) e.preventDefault();
  if (!e.repeat) listeners.forEach((fn) => fn(e.code));
});
window.addEventListener("keyup", (e) => held.delete(e.code));
window.addEventListener("blur", () => { held.clear(); Object.keys(touch).forEach((k) => (touch[k] = false)); });

export const input = {
  state() {
    const s = {};
    for (const a of Object.keys(BINDINGS)) s[a] = touch[a] || BINDINGS[a].some((c) => held.has(c));
    return s;
  },
  onPress(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  is: (action, code) => (BINDINGS[action] ?? []).includes(code),
  clear() { held.clear(); Object.keys(touch).forEach((k) => (touch[k] = false)); },

  /** Wire an on-screen button to an action (multi-touch safe). */
  bindTouch(el, action) {
    const on = (e) => { e.preventDefault(); touch[action] = true; el.classList.add("down"); try { el.setPointerCapture(e.pointerId); } catch {} };
    const off = (e) => { e.preventDefault(); touch[action] = false; el.classList.remove("down"); };
    el.addEventListener("pointerdown", on);
    el.addEventListener("pointerup", off);
    el.addEventListener("pointercancel", off);
    el.addEventListener("lostpointercapture", off);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  },
};
