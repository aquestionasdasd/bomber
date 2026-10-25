export const CAREER_COIN_REWARDS = Object.freeze({ kill: 10, win: 100 });
export const CAREER_COIN_KEY = 'bomber-489coin-v1';
const LIMIT = 999999999, RECEIPTS = 64;
let serial = 0;
const empty = () => ({ version: 1, balance: 0, runs: [] });
const integer = n => Number.isSafeInteger(n) && n >= 0;
function decode(raw) {
  if (!raw) return empty();
  if (raw.length > 32768) throw Error('Oversized wallet');
  const value = JSON.parse(raw);
  if (value.version !== 1 || !integer(value.balance) || value.balance > LIMIT || !Array.isArray(value.runs) || value.runs.length > RECEIPTS) throw Error('Invalid wallet');
  const ids = new Set();
  for (const r of value.runs) {
    if (!r || typeof r.id !== 'string' || !r.id || r.id.length > 128 || ids.has(r.id) || !integer(r.kills) || r.kills > 100000 || typeof r.won !== 'boolean') throw Error('Invalid receipt');
    ids.add(r.id);
  }
  return value;
}
function runId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${++serial}`;
}

// This is a browser-local reward wallet, independent of round purchase credits.
// No account, spending, network payload, or client-predicted kill grants.
export function createCareerCoins({ storage = () => globalThis.localStorage, onChange = () => {}, makeId = runId } = {}) {
  let state = empty(), dirty = false, saved = true, active = null;
  function read() {
    try { const next = decode(storage().getItem(CAREER_COIN_KEY)); saved = true; return next; }
    catch { saved = false; return null; }
  }
  state = read() || state;
  const notify = () => onChange({ balance: state.balance, saved });
  function refresh() {
    if (!dirty) state = read() || state;
    notify();
    return state.balance;
  }
  function begin({ eligible = false, guest = false } = {}) {
    active = eligible ? { id: makeId(), baseline: guest ? null : 0, seen: 0, won: false, paidKills: 0, paidWin: false } : null;
  }
  function progress({ kills, won = false, finished = false } = {}) {
    if (!active || !integer(kills) || kills > 100000) return 0;
    // A late join starts at its first confirmed score, never claiming old kills
    // or a match already over when this client arrived.
    if (active.baseline === null) {
      active.baseline = kills;
      if (finished) active = null;
      return 0;
    }
    active.seen = Math.max(active.seen, kills - active.baseline);
    active.won ||= finished && won;
    if (active.seen <= active.paidKills && (!active.won || active.paidWin) && !dirty) return 0;
    if (!dirty) state = read() || state;
    let receipt = state.runs.find(r => r.id === active.id);
    if (!receipt) { receipt = { id: active.id, kills: active.paidKills, won: active.paidWin }; state.runs.push(receipt); state.runs = state.runs.slice(-RECEIPTS); }
    const amount = Math.max(0, active.seen - receipt.kills) * CAREER_COIN_REWARDS.kill + (active.won && !receipt.won ? CAREER_COIN_REWARDS.win : 0);
    receipt.kills = Math.max(receipt.kills, active.seen); receipt.won ||= active.won;
    active.paidKills = receipt.kills; active.paidWin = receipt.won;
    if (!amount && !dirty) return 0;
    state.balance = Math.min(LIMIT, state.balance + amount);
    state.runs = state.runs.slice(-RECEIPTS);
    try { storage().setItem(CAREER_COIN_KEY, JSON.stringify(state)); saved = true; dirty = false; }
    catch { saved = false; dirty = true; }
    notify();
    return amount;
  }
  notify();
  return { begin, progress, refresh, stop() { active = null; }, get balance() { return state.balance; } };
}
