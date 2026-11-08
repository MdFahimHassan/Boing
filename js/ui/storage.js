const KEY = "boing.save.v2";

const fresh = () => ({ levels: {}, settings: { music: true, sfx: true, difficulty: "normal" } });

let data = fresh();
try {
  const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
  if (raw && typeof raw === "object") data = { ...fresh(), ...raw, settings: { ...fresh().settings, ...(raw.settings ?? {}) } };
} catch { /* private mode or corrupt save: start fresh */ }

const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} };

export const save = {
  get settings() { return data.settings; },
  setSetting(k, v) { data.settings[k] = v; persist(); },
  level: (id) => data.levels[id] ?? null,
  /** Merge a result, keeping the best of everything. Returns { newBest }. */
  record(id, r) {
    const old = data.levels[id];
    const next = {
      stars: Math.max(old?.stars ?? 0, r.stars),
      score: Math.max(old?.score ?? 0, r.score),
      time: old?.time ? Math.min(old.time, r.time) : r.time,
    };
    data.levels[id] = next;
    persist();
    return { newBest: !old || r.score > old.score };
  },
  isUnlocked(id) {
    if (new URLSearchParams(location.search).has("unlock")) return true;
    return id === 1 || !!data.levels[id - 1];
  },
  totalStars: () => Object.values(data.levels).reduce((n, l) => n + l.stars, 0),
  reset() { data = fresh(); persist(); },
};
