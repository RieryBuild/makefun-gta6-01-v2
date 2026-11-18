// Deterministic randomness: one seed builds the same city every time.
// One job: a small mulberry32 generator with forks, so each subsystem gets
// its own stream and a change in one never reshuffles the others.

export function createRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range(min, max) { return min + next() * (max - min); },
    int(min, max) { return min + Math.floor(next() * (max - min + 1)); },
    pick(list) { return list[Math.floor(next() * list.length)]; },
    chance(p) { return next() < p; },
    // A child stream, decorrelated from its parent by a big odd stride.
    fork(salt) { return createRng(((seed >>> 0) + salt * 2654435761) >>> 0); },
  };
}

export function seedFromQuery(fallback) {
  const raw = new URLSearchParams(window.location.search).get('seed');
  const parsed = raw === null ? NaN : parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
