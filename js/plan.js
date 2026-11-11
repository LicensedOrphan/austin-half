// The 16-week plan from the Half Marathon Training Brief (Oct 29, 2026).
// Distances in miles, durations in seconds. Everything else in the app reads from here.

export const RACE = {
  name: 'Ascension Seton Austin Half Marathon',
  date: '2027-02-14',
  start: '07:00',
  distance: 13.1,
  startLine: '2nd & Congress',
  finishLine: '9th & Congress',
};

export const PLAN_START = '2026-10-26'; // Monday of week 1

export const PHASES = {
  base: 'Base',
  cutback: 'Cutback',
  build: 'Build',
  peak: 'Peak',
  taper: 'Taper',
  race: 'Race',
};

// Effort guide. Paces get filled in from the week-3 time trial (see paces.js).
export const EFFORTS = {
  easy: { label: 'Easy', feel: 'Relaxed, could go much longer', talk: 'Full sentences', rpe: '3–4' },
  hmp: { label: 'Half-marathon pace', feel: 'Steady, sustainable about 2 hours', talk: 'A few words', rpe: '6' },
  tempo: { label: 'Tempo', feel: 'Comfortably hard, about an hour', talk: 'Short phrases', rpe: '7' },
  interval: { label: 'Intervals', feel: 'About 5K race effort', talk: 'One or two words', rpe: '8–9' },
  stride: { label: 'Strides', feel: 'Quick and smooth, not a sprint', talk: 'Not relevant', rpe: '8, relaxed' },
  hill: { label: 'Hills', feel: 'Strong push up, easy jog down', talk: 'Hard breathing at top', rpe: '8' },
  race: { label: 'Time trial', feel: 'Hard but even, all-out by the last half mile', talk: 'None', rpe: '9' },
  recovery: { label: 'Recovery', feel: 'Walk or very easy jog', talk: 'Full sentences', rpe: '1–2' },
};

// ---- Step builders -------------------------------------------------------
// A step is { kind, effort, distance? | duration?, label }. A repeat is { repeat, steps }.

const run = (distance, effort = 'easy', label) => ({ kind: 'run', effort, distance, label: label || `${fmtMi(distance)} ${EFFORTS[effort].label.toLowerCase()}` });
const timed = (duration, effort, label) => ({ kind: 'run', effort, duration, label });
const walk = (duration, label = 'Walk recovery') => ({ kind: 'walk', effort: 'recovery', duration, label });
const jog = (opts, label = 'Easy jog recovery') => ({ kind: 'jog', effort: 'recovery', ...opts, label });
const WU = () => ({ ...run(1, 'easy'), label: 'Warm-up: 1 mi easy', phase: 'warmup' });
const CD = (d = 1) => ({ ...run(d, 'easy'), label: `Cool-down: ${fmtMi(d)} easy`, phase: 'cooldown' });

const strides = (n) => ({ repeat: n, steps: [timed(20, 'stride', 'Stride: 20 sec quick and smooth'), walk(70, 'Walk back, full recovery')] });

function fmtMi(d) {
  return `${+d.toFixed(2)} mi`;
}

// ---- Session builders ----------------------------------------------------

const easyRun = (d, extra) => ({ type: 'easy', title: `${fmtMi(d)} easy`, steps: [run(d)], ...extra });
const easyPlusStrides = (d, n) => ({ type: 'quality', title: `${fmtMi(d)} easy + ${n} strides`, steps: [run(d), strides(n)], distance: d });
const longRun = (d, extra = {}) => ({ type: 'long', title: `${fmtMi(d)} long run${extra.note ? ', ' + extra.note : ''}`, steps: extra.steps || [run(d)], distance: d, ...extra });
const quality = (title, steps, distance) => ({ type: 'quality', title, steps: [WU(), ...steps, CD()], distance });

const strength = (level) => ({ type: 'strength', title: level === 'light' ? 'Strength, light' : 'Strength', level, minutes: 30 });
const mobility = () => ({ type: 'mobility', title: 'Rest or 15 min mobility', optional: true, minutes: 15 });
const rest = () => ({ type: 'rest', title: 'Rest' });

// ---- The schedule --------------------------------------------------------
// Each week lists Tue/Thu/Sat/Sun runs; Mon/Wed/Fri follow the weekly rhythm.

const WEEKS = [
  { phase: 'base', tue: easyRun(2.5), thu: easyPlusStrides(3, 4), sat: 2.5, sun: longRun(4), total: 12 },
  { phase: 'base', tue: easyRun(3), thu: easyPlusStrides(3, 6), sat: 3, sun: longRun(5), total: 14 },
  {
    phase: 'base', tue: easyRun(3),
    thu: { ...quality('5K time trial', [{ kind: 'run', effort: 'race', distance: 3.107, label: '5K time trial: even effort, all-out finish', timeTrial: true }], 5.1), timeTrial: true },
    sat: 2.5, sun: longRun(6), total: 16.5,
  },
  { phase: 'cutback', tue: easyRun(3), thu: easyPlusStrides(3, 6), sat: 2.5, sun: longRun(4), total: 12.5 },
  {
    phase: 'build', tue: easyRun(3.5),
    thu: { ...quality('2 mi tempo', [run(2, 'tempo', '2 mi tempo')], 4), note: 'Or run the Thanksgiving turkey trot at tempo effort.' },
    sat: 3, sun: longRun(7), total: 17.5,
  },
  { phase: 'build', tue: easyRun(4), thu: quality('2.5 mi tempo', [run(2.5, 'tempo', '2.5 mi tempo')], 4.5), sat: 3, sun: longRun(8), total: 19.5 },
  {
    phase: 'build', tue: easyRun(4),
    thu: quality('5 × 800 m', [{ repeat: 5, steps: [run(0.497, 'interval', '800 m at interval effort'), jog({ distance: 0.249 }, '400 m easy jog')], dropLastRecovery: true }], 5),
    sat: 3, sun: longRun(9), total: 21,
  },
  {
    phase: 'cutback', tue: easyRun(3),
    thu: quality('6 × 60 sec hills', [{ repeat: 6, steps: [timed(60, 'hill', '60 sec strong uphill'), jog({ duration: 90 }, 'Jog back down easy')], dropLastRecovery: true }], 4),
    sat: 3, sun: longRun(6), total: 16,
  },
  { phase: 'peak', tue: easyRun(4), thu: quality('3 mi tempo', [run(3, 'tempo', '3 mi tempo')], 5), sat: 3, sun: longRun(10, { fuel: true }), total: 22 },
  {
    phase: 'peak', tue: easyRun(4),
    thu: quality('8 × 60 sec hills', [{ repeat: 8, steps: [timed(60, 'hill', '60 sec strong uphill'), jog({ duration: 90 }, 'Jog back down easy')], dropLastRecovery: true }], 5),
    sat: 3.5, sun: longRun(11, { note: 'hilly', fuel: true }), total: 23.5,
  },
  {
    phase: 'peak', tue: easyRun(4),
    thu: quality('4 × 1 mi tempo', [{ repeat: 4, steps: [run(1, 'tempo', '1 mi tempo'), jog({ duration: 120 }, '2 min easy jog')], dropLastRecovery: true }], 6),
    sat: 4, sun: longRun(10, { note: 'last 3 at HMP', fuel: true, steps: [run(7), run(3, 'hmp', 'Last 3 mi at half-marathon pace')] }), total: 24,
  },
  { phase: 'cutback', tue: easyRun(3.5), thu: quality('2 mi at HMP', [run(2, 'hmp', '2 mi at half-marathon pace')], 4), sat: 3, sun: longRun(7, { fuel: true }), total: 17.5 },
  { phase: 'peak', tue: easyRun(4), thu: quality('4 mi at HMP', [run(4, 'hmp', '4 mi at half-marathon pace')], 6), sat: 4, sun: longRun(11, { note: 'practice fueling', fuel: true }), total: 25 },
  {
    phase: 'peak', tue: easyRun(4),
    thu: quality('3 × 1.5 mi tempo', [{ repeat: 3, steps: [run(1.5, 'tempo', '1.5 mi tempo'), jog({ duration: 180 }, '3 min easy jog')], dropLastRecovery: true }], 6),
    sat: 4, sun: longRun(12, { note: 'race rehearsal', fuel: true, rehearsal: true }), total: 26,
  },
  { phase: 'taper', tue: easyRun(4), thu: quality('3 mi at HMP', [run(3, 'hmp', '3 mi at half-marathon pace')], 5), sat: 3, sun: longRun(8, { fuel: true }), total: 20 },
  {
    phase: 'race',
    tue: { ...easyPlusStrides(3, 4), type: 'easy' },
    thu: { type: 'quality', title: '3 mi with 1 at HMP', steps: [run(1), run(1, 'hmp', '1 mi at half-marathon pace'), run(1)], distance: 3 },
    sat: { type: 'easy', title: '2 mi shakeout + 4 strides', steps: [run(2, 'easy', '2 mi shakeout'), strides(4)], distance: 2 },
    sun: { type: 'race', title: 'Race day: 13.1', steps: [run(13.1, 'hmp', 'Austin Half Marathon')], distance: 13.1, fuel: true },
    total: 21.1,
  },
];

// Strength: weeks 1–2 bodyweight 2 sets; 3–13 full sets with load; 14–16 one light session.
function strengthLevel(week) {
  if (week <= 2) return 'intro';
  if (week <= 13) return 'full';
  return 'light';
}

// ---- Date helpers (local dates as YYYY-MM-DD, no time zones) ------------

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}

export function today() {
  return isoDate(new Date());
}

// ---- Expanded schedule ---------------------------------------------------

// Which plan week runs in each calendar week. Restart on Nov 11, 2026 after ~2 weeks off:
// week 3's slot repeats week 1, week 4's slot runs week 3 (time trial Nov 19), and the
// break stands in for the week-4 cutback. Back on the original plan from week 5.
export const WEEK_SOURCE = [1, 2, 1, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
export const RESTART = { date: '2026-11-11', note: 'Eased back in after two weeks off: repeated week 1, time trial moved to Nov 19, week-4 cutback dropped.' };

function buildSchedule() {
  const days = [];
  WEEK_SOURCE.forEach((src, i) => {
    const w = WEEKS[src - 1];
    const week = i + 1;
    const monday = addDays(PLAN_START, i * 7);
    const lvl = strengthLevel(src);
    const sat = typeof w.sat === 'number'
      ? { ...easyRun(w.sat), title: `${fmtMi(w.sat)} easy${lvl !== 'light' ? ' + strength' : ''}` }
      : w.sat;
    const dayList = [
      mobility(),
      w.tue,
      { ...strength(lvl), title: lvl === 'light' ? 'Strength, light' : 'Strength', walkOptional: true },
      w.thu,
      rest(),
      sat,
      w.sun,
    ];
    dayList.forEach((s, d) => {
      const date = addDays(monday, d);
      const session = { ...s, date, week, dow: d, phase: w.phase, ...(src !== week ? { repeatOf: src } : {}) };
      if (session.steps && session.distance == null) session.distance = totalDistance(session.steps);
      // Saturday strength rides along with the easy run, except in the light weeks.
      if (d === 5 && lvl !== 'light' && session.type === 'easy' && week < 16) session.strength = lvl;
      days.push(session);
    });
  });
  return days;
}

export function totalDistance(steps) {
  let mi = 0;
  for (const s of steps) {
    if (s.repeat) mi += s.repeat * totalDistance(s.steps);
    else if (s.distance) mi += s.distance;
  }
  return Math.round(mi * 100) / 100;
}

export const SCHEDULE = buildSchedule();
export const WEEK_TOTALS = WEEK_SOURCE.map((src, i) => ({ week: i + 1, phase: WEEKS[src - 1].phase, total: WEEKS[src - 1].total, monday: addDays(PLAN_START, i * 7), repeatOf: src !== i + 1 ? src : null }));

export function sessionFor(date) {
  return SCHEDULE.find((s) => s.date === date) || null;
}

export function weekOf(date) {
  const n = Math.floor(daysBetween(PLAN_START, date) / 7) + 1;
  return n >= 1 && n <= 16 ? n : null;
}

// Flatten repeats into a linear list of steps for the in-run guide.
export function flattenSteps(steps) {
  const out = [];
  for (const s of steps) {
    if (s.repeat) {
      for (let r = 0; r < s.repeat; r++) {
        s.steps.forEach((inner, j) => {
          const isLastRecovery = s.dropLastRecovery && r === s.repeat - 1 && j === s.steps.length - 1;
          if (!isLastRecovery) out.push({ ...inner, rep: r + 1, reps: s.repeat });
        });
      }
    } else out.push({ ...s });
  }
  return out;
}

export const RULES = {
  missed: 'Skip it and carry on; never stack two hard days. Miss a full week and repeat the previous week.',
  fueling: 'Water only under 75 min. From week 9, a gel or chews about every 40 min on long runs.',
  rucking: 'Cross-training only. A 45–60 min ruck can replace the Wednesday walk through week 8; 25 lb or less from week 9; never the day before a long run.',
  shoes: 'Get fitted at a running store before week 3; race shoes broken in by week 13.',
  injury: [
    'Soreness that fades during warm-up is normal. Sharp, localized pain that worsens while running means 2 to 3 days off.',
    'Pinpoint shin-bone pain or pain lasting into the next morning warrants a doctor or physical therapist.',
    'Shins and calves adapt slower than lungs; don’t add miles early even if it feels easy.',
  ],
};
