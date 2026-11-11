import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEDULE, WEEK_TOTALS, sessionFor, flattenSteps, weekOf } from '../js/plan.js';
import { trainingPaces, parseDuration, fmtPace, fmtDuration } from '../js/paces.js';
import { Track, METERS_PER_MILE } from '../js/track.js';
import { Guide } from '../js/guide.js';

test('schedule covers 16 weeks ending on race day', () => {
  assert.equal(SCHEDULE.length, 112);
  assert.equal(SCHEDULE.at(-1).date, '2027-02-14');
  assert.equal(SCHEDULE.at(-1).type, 'race');
  assert.equal(sessionFor('2026-11-12').timeTrial, true);
  assert.equal(weekOf('2026-11-11'), 3);
});

test('weekly mileage matches the brief', () => {
  for (const w of WEEK_TOTALS) {
    const sum = SCHEDULE.filter((s) => s.week === w.week && s.distance).reduce((a, s) => a + s.distance, 0);
    assert.ok(Math.abs(sum - w.total) < 0.15, `week ${w.week}: ${sum} vs ${w.total}`);
  }
});

test('repeats flatten and drop the trailing recovery', () => {
  const s = sessionFor('2026-12-10'); // 5 x 800
  const flat = flattenSteps(s.steps);
  assert.equal(flat.filter((x) => x.effort === 'interval').length, 5);
  assert.equal(flat.filter((x) => x.kind === 'jog').length, 4);
  assert.equal(flat[0].phase, 'warmup');
  assert.equal(flat.at(-1).phase, 'cooldown');
});

test('VDOT paces for a 25:00 5K are in the expected bands', () => {
  const r = trainingPaces(5000, parseDuration('25:00'));
  assert.ok(r.vdot > 37.5 && r.vdot < 39);
  assert.ok(r.paces.easy.fast < r.paces.easy.slow);
  assert.ok(r.paces.tempo.fast < r.paces.hmp.target && r.paces.hmp.target < r.paces.easy.fast);
  assert.ok(r.halfPrediction > 6600 && r.halfPrediction < 7200);
  assert.equal(fmtPace(599.6), '10:00');
  assert.equal(fmtDuration(3725), '1:02:05');
});

// Walk due north at a steady pace; 1 deg latitude ~ 111.2 km.
function feed(track, seconds, mps, t0 = 0, lat0 = 30.27) {
  for (let i = 0; i <= seconds; i++) track.addFix({ lat: lat0 + (i * mps) / 111195, lon: -97.74, acc: 5, t: t0 + i * 1000 });
}

test('track accumulates distance, splits and ignores glitches', () => {
  const t = new Track();
  t.start(0);
  const mps = METERS_PER_MILE / 600; // 10:00/mi
  feed(t, 1250, mps);
  assert.ok(Math.abs(t.miles() - 1250 / 600) < 0.02, `miles ${t.miles()}`);
  assert.equal(t.splits.length, 2);
  assert.ok(Math.abs(t.splits[0] - 600) <= 2);
  assert.ok(Math.abs(t.currentPace() - 600) < 10);
  const before = t.meters;
  t.addFix({ lat: 31, lon: -97.74, acc: 5, t: 1251000 }); // teleport
  t.addFix({ lat: 30.3, lon: -97.74, acc: 80, t: 1252000 }); // inaccurate
  assert.equal(t.meters, before);
});

test('pausing stops the clock', () => {
  const t = new Track();
  t.start(0);
  t.pause(60000);
  t.resume(120000);
  assert.equal(t.elapsed(180000), 120000);
});

test('guide walks through strides with cues', () => {
  const s = sessionFor('2026-10-29'); // 3 easy + 4 strides
  const g = new Guide(flattenSteps(s.steps), { paces: null });
  assert.match(g.begin()[0].say, /3 miles, easy/);
  let cues = g.update({ sec: 1800, mi: 3.0 });
  assert.match(cues.map((c) => c.say).join(' '), /Stride 1 of 4/);
  cues = g.update({ sec: 1817, mi: 3.05 });
  assert.ok(cues.some((c) => c.beep === 'tick'));
  cues = g.update({ sec: 1820, mi: 3.06 });
  assert.match(cues.map((c) => c.say).join(' '), /walk/i);
  // Finish the remaining stride/walk pairs.
  let sec = 1820;
  let all = [];
  for (let i = 0; i < 400; i++) all = all.concat(g.update({ sec: ++sec, mi: 3.1 }));
  assert.ok(g.done);
  assert.match(all.map((c) => c.say).join(' '), /Workout complete/);
});

test('guide nudges when easy run goes too fast', () => {
  const paces = trainingPaces(5000, parseDuration('25:00')).paces;
  const g = new Guide(flattenSteps(sessionFor('2026-11-10').steps), { paces });
  g.begin();
  let said = [];
  for (let sec = 1; sec < 200; sec++) said = said.concat(g.update({ sec, mi: sec / 480, pace: 480 }));
  assert.ok(said.some((c) => /Ease off/.test(c.say || '')));
});

test('background gaps are bridged with a straight line', () => {
  const t = new Track();
  t.start(0);
  const mps = METERS_PER_MILE / 600;
  feed(t, 300, mps); // 5 min
  t.markGap(300000, 420000); // 2 min in background
  feed(t, 300, mps, 420000, 30.27 + (420 * mps) / 111195);
  assert.ok(Math.abs(t.miles() - 720 / 600) < 0.03, `miles ${t.miles()}`);
  assert.equal(t.segments.length, 2);
});
