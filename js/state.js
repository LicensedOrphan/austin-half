// In-memory app state, backed by IndexedDB. Views read from here; writes go through save*.

import { db, settings } from './db.js';
import { SCHEDULE, sessionFor, addDays, daysBetween, today, weekOf, RESTART } from './plan.js';
import { trainingPaces, FIVE_K_METERS } from './paces.js';

export const state = {
  logs: new Map(), // date -> log
  runs: [], // newest first
  timeTrial: null, // { date, seconds, meters }
  moves: {}, // toDate -> fromDate
};

export async function loadState() {
  await seed();
  await seedRestart();
  const [logs, runs, tt, moves] = await Promise.all([db.all('logs'), db.all('runs'), settings.get('timeTrial'), settings.get('moves', {})]);
  state.logs = new Map(logs.map((l) => [l.date, l]));
  state.runs = runs.sort((a, b) => b.startedAt - a.startedAt);
  state.timeTrial = tt;
  state.moves = moves;
}

// The brief's progress log up to Oct 29, entered once on first launch.
async function seed() {
  if (await settings.get('seeded')) return;
  const run = { id: 'seed-2026-10-27', date: '2026-10-27', startedAt: new Date(2026, 9, 27, 7).getTime(), manual: true, miles: 2.5, seconds: 1551, title: '2.5 mi easy', points: [], splits: [], note: 'First run of prep; 2 Strava achievements.' };
  await db.put('runs', run);
  await db.put('logs', { date: '2026-10-26', status: 'done' });
  await db.put('logs', { date: '2026-10-27', status: 'done', runId: run.id, stretched: true });
  await db.put('logs', { date: '2026-10-28', status: 'skipped', note: 'Skipped, not made up, to avoid stacking hard days.' });
  await settings.set('seeded', true);
}

// Nov 11 restart: nothing done Oct 29–Nov 10 except an ~11 mi walk around the Town Lake loop on Sat Nov 7.
async function seedRestart() {
  if (await settings.get('seedRestart')) return;
  for (const s of SCHEDULE) {
    if (s.date < '2026-10-29' || s.date >= RESTART.date) continue;
    if (!['easy', 'quality', 'long', 'strength'].includes(s.type)) continue;
    if (await db.get('logs', s.date)) continue;
    await db.put('logs', { date: s.date, status: 'skipped', ...(s.date === '2026-11-07' ? { note: 'Walked the Town Lake loop instead (~11 mi).' } : {}) });
  }
  await db.put('runs', { id: 'seed-2026-11-07-walk', kind: 'walk', date: '2026-11-07', startedAt: new Date(2026, 10, 7, 9).getTime(), manual: true, miles: 11, seconds: null, title: 'Town Lake loop walk', points: [], splits: [] });
  await settings.set('seedRestart', true);
}

export function paces() {
  if (!state.timeTrial) return null;
  return trainingPaces(state.timeTrial.meters || FIVE_K_METERS, state.timeTrial.seconds);
}

export async function saveTimeTrial(seconds, date = today(), meters = FIVE_K_METERS) {
  state.timeTrial = { date, seconds, meters };
  await settings.set('timeTrial', state.timeTrial);
}

export async function saveLog(log) {
  const prev = state.logs.get(log.date) || {};
  const merged = { ...prev, ...log };
  state.logs.set(log.date, merged);
  await db.put('logs', merged);
  return merged;
}

export async function saveRun(run) {
  state.runs = [run, ...state.runs.filter((r) => r.id !== run.id)].sort((a, b) => b.startedAt - a.startedAt);
  await db.put('runs', run);
}

export async function deleteRun(id) {
  state.runs = state.runs.filter((r) => r.id !== id);
  await db.del('runs', id);
  for (const l of state.logs.values()) if (l.runId === id) await saveLog({ date: l.date, runId: null, status: null });
}

export const runById = (id) => state.runs.find((r) => r.id === id);

// Walks and rucks are logged but don't count toward running mileage or the spike check.
export const isRunActivity = (r) => (r.kind || 'run') === 'run';

// The session on a date, accounting for sessions moved within the week.
export function sessionOn(date) {
  const from = state.moves[date];
  if (from) return { ...sessionFor(from), date, movedFrom: from };
  if (Object.values(state.moves).includes(date)) {
    const s = sessionFor(date);
    return s && { ...s, movedAway: Object.keys(state.moves).find((k) => state.moves[k] === date) };
  }
  return sessionFor(date);
}

export async function moveSession(fromDate, toDate) {
  state.moves = { ...state.moves, [toDate]: fromDate };
  await settings.set('moves', state.moves);
  await saveLog({ date: fromDate, status: 'moved', movedTo: toDate });
}

export async function undoMove(toDate) {
  const from = state.moves[toDate];
  const { [toDate]: _, ...rest } = state.moves;
  state.moves = rest;
  await settings.set('moves', state.moves);
  if (from) await saveLog({ date: from, status: null, movedTo: null });
}

const HARD = new Set(['quality', 'long', 'race']);
export const isHard = (s) => s && HARD.has(s.type);
export const isRun = (s) => s && ['easy', 'quality', 'long', 'race'].includes(s.type);

export function statusOf(date) {
  return state.logs.get(date)?.status || null;
}

// Unlogged runs from earlier this week that could still happen today without stacking hard days.
export function movableTo(date) {
  const wk = weekOf(date);
  if (!wk) return [];
  // Only offer on a day without its own run, and never twice.
  if (isRun(sessionOn(date)) || statusOf(date) || state.moves[date]) return [];
  // A neighbor counts as hard unless it was skipped or moved away.
  const hardOn = (d) => isHard(sessionOn(d)) && !['skipped', 'moved'].includes(statusOf(d));
  const out = [];
  for (let back = 1; back <= 6; back++) {
    const d = addDays(date, -back);
    if (weekOf(d) !== wk) break;
    const s = sessionFor(d);
    if (!isRun(s) || statusOf(d)) continue;
    // The candidate's own (now empty) day doesn't count as a hard neighbor.
    const nextToHard = [addDays(date, -1), addDays(date, 1)].some((n) => n !== d && hardOn(n));
    out.push({ date: d, session: s, blocked: isHard(s) && nextToHard });
  }
  return out;
}

export function longestRecent(date, days = 30) {
  let max = 0;
  for (const r of state.runs.filter(isRunActivity)) {
    const ago = daysBetween(r.date, date);
    if (ago > 0 && ago <= days) max = Math.max(max, r.miles || 0);
  }
  return max;
}

// BJSM 2025: single runs >10% longer than the 30-day longest raise injury risk.
// The plan itself climbs 1 mi a week, so only flag real jumps (usually after missed weeks).
export function spikeWarning(session) {
  if (!isRun(session) || !session.distance) return null;
  const longest = longestRecent(session.date);
  if (!longest) return null;
  const pct = (session.distance - longest) / longest;
  if (pct > 0.1 && session.distance - longest >= 1.5) {
    return { longest, pct, suggest: Math.round(longest * 1.15 * 2) / 2 };
  }
  return null;
}

export function weekMiles(week) {
  let done = 0;
  for (const s of SCHEDULE.filter((x) => x.week === week)) {
    for (const r of runsOn(s.date)) done += r.miles || 0;
  }
  return done;
}

export function runsOn(date, { all = false } = {}) {
  return state.runs.filter((r) => r.date === date && (all || isRunActivity(r)));
}
