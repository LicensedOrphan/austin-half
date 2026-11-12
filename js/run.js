// The in-run screen: pre-run check, live guide, finish. Always black, huge type.

import { flattenSteps, today, EFFORTS } from './plan.js';
import { fmtPace, fmtDuration } from './paces.js';
import { Recorder, METERS_PER_MILE } from './track.js';
import { Guide } from './guide.js';
import { unlock, say, beep } from './cues.js';
import { settings } from './db.js';
import { state, paces, sessionOn, saveRun, isRun } from './state.js';
import { html, render, fmtMiles, paceText } from './ui.js';
import { checkIn } from './views.js';

let active = null; // { recorder, guide, session, date, stepLog, timer }

const FX_ON_BLACK = { easy: '#2fc1b0', hmp: '#5b82ff', tempo: '#ffb02e', interval: '#ff5c45', stride: '#ff5c45', hill: '#a77cff', race: '#ffffff', recovery: '#3a4448' };

export function runScreen(root, date) {
  const free = date === 'free';
  const session = free ? null : sessionOn(date);
  const steps = session && isRun(session) ? flattenSteps(session.steps) : [];
  if (active && active.date === date) return mountActive(root);
  if (active) { location.hash = `#/run/${active.date}`; return; }
  if (state.activeRun?.date === date) return restore(root, date, session, steps);
  preRun(root, date, session, steps);
}

function preRun(root, date, session, steps) {
  let fixWatch = null;
  render(root, html`<div class="runscreen">
    <div class="status"><a href="#/${date === 'free' ? 'log' : 'day/' + date}" style="color:#9aa;text-decoration:none;font-size:15px">‹ Back</a><span id="gps">Finding GPS…</span></div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center">
      <div style="font-family:var(--body);font-weight:700;color:#9aa;letter-spacing:.06em;text-transform:uppercase;font-size:13px">${session ? 'Today’s run' : 'Free run'}</div>
      <div style="font-size:56px;font-weight:700;line-height:1">${session ? session.title : 'Just run'}</div>
      ${steps.length > 1 ? html`<ol style="font-family:var(--body);font-size:16px;color:#ccc;padding-left:20px;margin:14px 0 0">${compactSteps(session)}</ol>` : ''}
      <div style="font-family:var(--body);font-size:15px;color:#9aa;margin-top:18px;line-height:1.5">
        The screen stays on while you run. Keep the app open: if you switch apps or press the side button, GPS pauses until you come back.
        Tap <b style="color:#fff">Lock</b> once you’re moving so pocket taps don’t register.
      </div>
    </div>
    <div class="controls" style="grid-template-columns:1fr"><button class="go" id="start" style="min-height:88px;font-size:34px">Start</button></div>
  </div>`);
  const gps = root.querySelector('#gps');
  if ('geolocation' in navigator) {
    fixWatch = navigator.geolocation.watchPosition(
      (p) => { gps.textContent = p.coords.accuracy <= 20 ? `GPS ready · ±${Math.round(p.coords.accuracy)} m` : `GPS weak · ±${Math.round(p.coords.accuracy)} m`; gps.className = p.coords.accuracy <= 20 ? '' : 'bad'; },
      (e) => { gps.textContent = e.code === 1 ? 'Location is off for this app' : 'No GPS yet'; gps.className = 'bad'; },
      { enableHighAccuracy: true, maximumAge: 0 },
    );
  }
  root.querySelector('#start').addEventListener('click', async () => {
    unlock(); // must happen inside the tap for iOS to allow audio later
    if (fixWatch != null) navigator.geolocation.clearWatch(fixWatch);
    const recorder = new Recorder();
    active = { recorder, guide: new Guide(steps, { paces: paces()?.paces }), session, date, stepLog: [], startedAt: Date.now() };
    await recorder.start();
    play(active.guide.begin());
    mountActive(root);
  });
  // Leaving this screen before starting stops the GPS preview.
  addEventListener('hashchange', () => fixWatch != null && navigator.geolocation.clearWatch(fixWatch), { once: true });
}

function compactSteps(session) {
  return session.steps.map((s) => s.repeat
    ? html`<li>${s.repeat} × ${s.steps[0].label}${s.steps[1] ? ', ' + s.steps[1].label.toLowerCase() : ''}</li>`
    : html`<li>${s.label}</li>`);
}

async function restore(root, date, session, steps) {
  const saved = state.activeRun;
  const recorder = Recorder.restore(saved.track);
  // If the app was closed mid-run, freeze the clock at the last save and wait for Resume.
  if (!recorder.track.paused) {
    recorder.track.pause(saved.savedAt);
  }
  active = { recorder, guide: new Guide(steps, { paces: paces()?.paces, state: saved.guide }), session, date, stepLog: saved.stepLog || [], startedAt: saved.startedAt, restored: true };
  mountActive(root);
}

function mountActive(root) {
  const a = active;
  render(root, html`<div class="runscreen" id="rs">
    <div class="status"><span id="st-gps">GPS</span><span id="st-wake"></span><span id="st-clock"></span></div>
    <div class="stepbar" id="bar"><div class="lbl" id="lbl"></div><div class="left" id="left"></div><div class="sub" id="sub"></div><div class="prog"><span id="prog"></span></div></div>
    <div class="next" id="next"></div>
    <div class="metrics">
      <div class="metric wide"><b id="m-dist">0.00</b><span>miles</span></div>
      <div class="metric"><b id="m-time">0:00</b><span>time</span></div>
      <div class="metric"><b id="m-pace">–:––</b><span id="m-pace-l">pace /mi</span></div>
    </div>
    <div class="controls" id="controls"></div>
    <div class="lockveil" id="veil" hidden><button id="unlock"><i id="unlock-fill"></i>Hold to unlock</button></div>
  </div>`);
  const $ = (id) => root.querySelector('#' + id);
  a.recorder.onStatus = (s) => {
    if ('wakeLock' in s) $('st-wake').textContent = s.wakeLock ? 'Screen on' : 'Screen may sleep';
    if (s.gpsError) { $('st-gps').textContent = 'GPS: ' + s.gpsError; $('st-gps').className = 'bad'; }
    if (s.gap) say('Welcome back. GPS was paused while the app was in the background.');
  };
  $('st-wake').textContent = a.recorder.wakeLock ? 'Screen on' : '';

  const controls = () => {
    const paused = a.recorder.track.paused;
    render($('controls'), paused
      ? html`<button class="go" data-c="resume">Resume</button><button class="stop" data-c="finish">Finish</button><button data-c="discard">Discard</button>`
      : html`<button data-c="pause">Pause</button><button data-c="lock">Lock</button><button data-c="skip" ${a.guide.done ? 'disabled style="opacity:.35"' : ''}>Skip step</button>`);
  };
  controls();
  const mountedAt = Date.now();
  $('controls').addEventListener('click', async (e) => {
    const c = e.target.closest('[data-c]')?.dataset.c;
    // The Start tap lands where these buttons appear; ignore it.
    if (!c || Date.now() - mountedAt < 700) return;
    if (c === 'pause') { a.recorder.pause(); say('Paused.'); }
    if (c === 'resume') {
      unlock();
      if (a.restored) { a.restored = false; await a.recorder.start(); } else a.recorder.resume();
      say('Resumed.');
    }
    if (c === 'lock') lock(true);
    if (c === 'skip') { const t = now(); logStep(t); play(a.guide.skip(t.sec, t.mi)); }
    if (c === 'finish') {
      const b = e.target.closest('button');
      if (!b.dataset.confirm) { b.dataset.confirm = 1; b.textContent = 'Tap to save'; return; }
      return finish(root);
    }
    if (c === 'discard') {
      const b = e.target.closest('button');
      if (!b.dataset.confirm) { b.dataset.confirm = 1; b.textContent = 'Really?'; return; }
      await a.recorder.stop();
      await clearActive();
      location.hash = a.date === 'free' ? '#/log' : `#/day/${a.date}`;
      return;
    }
    controls();
    tick();
  });

  // Hold-to-unlock: prevents pocket and armband taps.
  const lock = (on) => { $('veil').hidden = !on; a.locked = on; };
  let holdT = null;
  const fill = $('unlock-fill');
  const btn = $('unlock');
  const cancel = () => { clearInterval(holdT); holdT = null; fill.style.width = 0; };
  btn.addEventListener('pointerdown', (e) => {
    cancel();
    try { btn.setPointerCapture(e.pointerId); } catch {} // a small finger slide shouldn't reset the hold
    const t0 = Date.now();
    holdT = setInterval(() => {
      const f = Math.min(1, (Date.now() - t0) / 900);
      fill.style.width = f * 100 + '%';
      if (f >= 1) { cancel(); lock(false); }
    }, 30);
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(ev, cancel);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  if (a.locked) lock(true);

  const now = () => ({ sec: a.recorder.track.elapsed(Date.now()) / 1000, mi: a.recorder.track.miles() });

  function logStep(t) {
    const s = a.guide.step;
    if (!s) return;
    const rec = { label: s.label, effort: s.effort, miles: t.mi - a.guide.stepStartMi, seconds: t.sec - a.guide.stepStartSec };
    a.stepLog.push(rec);
    // Only a completed 5K counts as a time-trial result.
    if (s.timeTrial && rec.miles >= 3.0) a.timeTrialSeconds = Math.round(rec.seconds);
  }
  a.logStep = logStep;

  let lastSave = 0;
  function tick() {
    if (!document.body.contains($('rs'))) { clearInterval(a.timer); a.timer = null; return; }
    const t = now();
    const track = a.recorder.track;
    const pace = track.currentPace();
    if (!track.paused) {
      const prevIndex = a.guide.index;
      const s = a.guide.step;
      const before = { ...t };
      // Log the step before the guide moves past it.
      const p = a.guide.progress(t.sec, t.mi);
      if (s && p && p.frac >= 1) logStep(before);
      play(a.guide.update({ sec: t.sec, mi: t.mi, pace }));
      if (a.guide.index !== prevIndex) controls();
    }
    // Step bar
    const s = a.guide.step;
    const bar = $('bar');
    if (s) {
      const p = a.guide.progress(t.sec, t.mi);
      bar.style.setProperty('--fx', FX_ON_BLACK[s.effort] || '#333');
      bar.className = `stepbar fx-${s.effort}`;
      $('lbl').textContent = s.reps ? `${s.label} · ${s.rep} of ${s.reps}` : s.label;
      $('left').textContent = p.remainingSec != null ? fmtDuration(Math.ceil(p.remainingSec)) : `${p.remainingMi.toFixed(2)} mi`;
      const target = paceText(s.effort, paces());
      const stepMi = t.mi - a.guide.stepStartMi, stepSec = t.sec - a.guide.stepStartSec;
      const stepPace = stepMi > 0.05 ? fmtPace(stepSec / stepMi) : '–:––';
      $('sub').textContent = s.effort === 'easy' || s.effort === 'recovery'
        ? EFFORTS[s.effort].talk
        : target && s.effort !== 'stride' && s.effort !== 'hill' ? `Target ${target} · this step ${stepPace}` : EFFORTS[s.effort].feel;
      $('prog').style.width = `${Math.round(p.frac * 100)}%`;
      const nx = a.guide.steps[a.guide.index + 1];
      $('next').textContent = nx ? `Next: ${nx.label}` : 'Last step';
    } else {
      bar.style.setProperty('--fx', '#1c1c1e');
      bar.className = 'stepbar';
      bar.style.color = '#fff';
      $('lbl').textContent = a.session ? 'Workout complete' : 'Free run';
      $('left').textContent = fmtMiles(t.mi);
      $('sub').textContent = a.session ? 'Keep going or finish when ready.' : 'No plan steps. Splits every mile.';
      $('prog').style.width = '100%';
      $('next').textContent = '';
    }
    $('m-dist').textContent = fmtMiles(t.mi);
    $('m-time').textContent = fmtDuration(t.sec);
    $('m-pace').textContent = pace ? fmtPace(pace) : '–:––';
    $('st-clock').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const fix = a.recorder.lastFix;
    const stale = !fix || Date.now() - fix.t > 15000;
    $('st-gps').textContent = track.paused ? 'Paused' : stale ? 'GPS searching…' : `GPS ±${Math.round(fix.acc)} m`;
    $('st-gps').className = stale && !track.paused ? 'bad' : '';
    if (Date.now() - lastSave > 5000) { lastSave = Date.now(); persist(); }
  }
  if (!a.timer) a.timer = setInterval(tick, 1000);
  tick();
}

function play(cues) {
  for (const c of cues || []) {
    if (c.beep) beep(c.beep);
    if (c.say) setTimeout(() => say(c.say), c.beep ? 450 : 0);
  }
}

async function persist() {
  const a = active;
  if (!a) return;
  state.activeRun = { date: a.date, startedAt: a.startedAt, savedAt: Date.now(), track: a.recorder.track.toJSON(), guide: a.guide.toJSON(), stepLog: a.stepLog };
  await settings.set('activeRun', state.activeRun);
}

async function clearActive() {
  if (active?.timer) clearInterval(active.timer);
  active = null;
  state.activeRun = null;
  await settings.set('activeRun', null);
}

async function finish(root) {
  const a = active;
  const tr = a.recorder.track;
  // Record the step in progress, so a cut-short workout still shows what was done.
  if (!a.guide.done && a.logStep && tr.miles() - a.guide.stepStartMi > 0.01) a.logStep({ sec: tr.elapsed(Date.now()) / 1000, mi: tr.miles() });
  await a.recorder.stop();
  const date = a.date === 'free' ? today() : a.date;
  const run = {
    id: `r-${a.startedAt}`,
    date,
    startedAt: a.startedAt,
    title: a.session?.title || 'Free run',
    miles: Math.round(tr.miles() * 100) / 100,
    seconds: Math.round(tr.elapsedMs / 1000),
    points: tr.points,
    segments: tr.segments,
    splits: tr.splits,
    gaps: tr.gaps,
    elevGainFt: tr.points.some((p) => p[3] != null) ? tr.elevationGain() * 3.28084 : null,
    steps: a.stepLog.map((s) => ({ ...s, miles: Math.round(s.miles * 100) / 100, seconds: Math.round(s.seconds) })),
    timeTrialSeconds: a.timeTrialSeconds,
  };
  beep('done');
  await saveRun(run);
  await clearActive();
  location.hash = `#/runs/${run.id}`;
  setTimeout(() => checkIn(date, run.id, () => dispatchEvent(new HashChangeEvent('hashchange'))), 300);
}

export const METERS = METERS_PER_MILE;
