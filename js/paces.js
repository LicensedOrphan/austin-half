// Training paces from a race result, using Jack Daniels' VDOT equations.
// Times in seconds, paces in seconds per mile.

const METERS_PER_MILE = 1609.344;
export const HALF_METERS = 21097.5;
export const FIVE_K_METERS = 5000;
export const HMP_BUFFER = 15;

// Oxygen cost (ml/kg/min) of running at v meters per minute.
function vo2AtVelocity(v) {
  return -4.6 + 0.182258 * v + 0.000104 * v * v;
}

// Fraction of VO2max sustainable for a race lasting t minutes.
function fractionForDuration(t) {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
}

// Velocity (m/min) whose oxygen cost equals vo2. Inverse of vo2AtVelocity.
function velocityAtVo2(vo2) {
  const a = 0.000104, b = 0.182258, c = -4.6 - vo2;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

export function vdot(meters, seconds) {
  const t = seconds / 60;
  return vo2AtVelocity(meters / t) / fractionForDuration(t);
}

// Race time at a given distance for a VDOT, solved by bisection.
export function predictTime(vdotValue, meters) {
  let lo = 60, hi = 60 * 60 * 8;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (vdot(meters, mid) > vdotValue) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function paceAtFraction(vdotValue, fraction) {
  const v = velocityAtVo2(vdotValue * fraction);
  return (METERS_PER_MILE / v) * 60;
}

// Daniels intensity bands as a fraction of VDOT. Easy is a wide range on purpose.
const BANDS = {
  easy: [0.62, 0.70],
  tempo: [0.84, 0.88],
  interval: [0.95, 1.0],
  stride: [1.03, 1.07],
  hill: null, // effort-based; hills ignore pace
};

export function trainingPaces(meters, seconds) {
  const v = vdot(meters, seconds);
  const range = ([lo, hi]) => ({ slow: paceAtFraction(v, lo), fast: paceAtFraction(v, hi) });
  const half = predictTime(v, HALF_METERS);
  // Goal HMP sits 15 s/mi slower than the equivalent-performance pace: first half, hilly course.
  const hmp = (half / HALF_METERS) * METERS_PER_MILE + HMP_BUFFER;
  return {
    vdot: Math.round(v * 10) / 10,
    halfPrediction: half,
    paces: {
      easy: range(BANDS.easy),
      hmp: { slow: hmp + 5, fast: hmp - 5, target: hmp },
      tempo: range(BANDS.tempo),
      interval: range(BANDS.interval),
      stride: range(BANDS.stride),
      race: { slow: (seconds / meters) * METERS_PER_MILE, fast: (seconds / meters) * METERS_PER_MILE },
    },
  };
}

// Riegel, for a quick sanity check against VDOT.
export function riegel(seconds, fromMeters, toMeters) {
  return seconds * Math.pow(toMeters / fromMeters, 1.06);
}

export function fmtPace(secPerMile) {
  if (!isFinite(secPerMile) || secPerMile <= 0) return '–:––';
  let m = Math.floor(secPerMile / 60);
  let s = Math.round(secPerMile % 60);
  if (s === 60) { m += 1; s = 0; }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function parseDuration(text) {
  const parts = text.trim().split(':').map(Number);
  if (parts.some((n) => !isFinite(n))) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}
