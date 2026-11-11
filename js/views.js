// Screens. Each view returns a template; app.js mounts it and calls bind() for events.

import { SCHEDULE, WEEK_TOTALS, RACE, RULES, EFFORTS, RESTART, today, addDays, weekOf, daysBetween, sessionFor, parseDate } from './plan.js';
import { fmtPace, fmtDuration, parseDuration, parseFiveK, HALF_METERS } from './paces.js';
import { state, paces, saveLog, saveRun, saveTimeTrial, deleteRun, sessionOn, statusOf, movableTo, moveSession, undoMove, spikeWarning, weekMiles, runsOn, runById, isRun, isRunActivity } from './state.js';
import { html, raw, render, band, stepRows, whyFor, effortLine, sessionFx, fmtDay, dowName, fmtMiles, tabs, sheet, daysToRace, STATUS_LABEL, phaseName, paceText, esc } from './ui.js';
import { LEG_FEEL } from './content.js';
import { exportAll, importAll, settings } from './db.js';
import { cueSettings } from './cues.js';
import { BUILD } from './version.js';
import { toGPX } from './gpx.js';

const go = (hash) => { location.hash = hash; };

// ---- Today / any day -----------------------------------------------------

export function dayView(date = today()) {
  const isToday = date === today();
  const s = sessionOn(date);
  const p = paces();
  if (!s) return beforeOrAfter(date);
  const wk = weekOf(date);
  const log = state.logs.get(date);
  const st = log?.status;
  const runs = runsOn(date, { all: true });
  const fx = sessionFx(s);
  const spike = !st && spikeWarning(s);
  const movable = isToday ? movableTo(date) : [];
  const gap = isToday && welcomeBack(date);
  const tomorrow = sessionOn(addDays(date, 1));
  const ttRun = runs.find((r) => r.timeTrialSeconds);

  return html`
    <header class="dayline">
      <div><div class="date">${fmtDay(date, true)}</div>${!isToday ? html`<a class="linkbtn" href="#/today">Back to today</a>` : ''}</div>
      <div class="meta">Week ${wk} of 16 · ${phaseName(s.phase)}<br>${daysToRace()} days to race</div>
    </header>

    ${state.activeRun ? html`<a class="note warn" style="display:block;margin-bottom:12px" href="#/run/${state.activeRun.date}"><b>Run in progress.</b> Tap to go back to it.</a>` : ''}
    ${gap ? html`<div class="note" style="margin-bottom:12px"><b>Welcome back.</b> ${gap}</div>` : ''}
    ${movable.length ? html`<div class="note" style="margin-bottom:12px">
        ${movable.map((m) => html`<div class="spread"><span>${dowName(m.date)}’s ${m.session.title} wasn’t logged.</span>
          ${m.blocked ? html`<span class="small muted">Can’t move: next to a hard day</span>` : html`<button class="btn small" data-move="${m.date}">Do it today</button>`}</div>`)}
        <div class="small muted" style="margin-top:6px">Or skip it and carry on. Never stack two hard days.</div>
      </div>` : ''}

    <article class="card session fx-${fx}">
      <div class="spread"><span class="eyebrow">${s.timeTrial ? 'Time trial' : s.type === 'quality' ? 'Quality run' : s.type === 'long' ? 'Long run' : s.type === 'race' ? 'Race' : s.type === 'easy' ? 'Easy run' : s.type === 'strength' ? 'Strength' : s.optional ? 'Recovery' : 'Rest'}</span>
        ${st ? html`<span class="tag">${STATUS_LABEL[st]}</span>` : ''}</div>
      <h1 class="title">${s.title}</h1>
      ${s.movedFrom ? html`<p class="small muted">Moved from ${fmtDay(s.movedFrom)}. <button class="linkbtn" data-undomove="${date}">Undo</button></p>` : ''}
      ${s.movedAway ? html`<p class="small muted">Moved to ${fmtDay(s.movedAway)}.</p>` : ''}
      <p class="why">${whyFor(s)}</p>
      ${s.repeatOf && !s.movedFrom ? html`<p class="small muted">${s.repeatOf < s.week ? `Repeating week ${s.repeatOf} to ease back in.` : `Week ${s.repeatOf}’s session, a week later than first planned.`}</p>` : ''}
      ${s.steps ? stepRows(s, p) : ''}
      ${effortLine(s)}
      ${s.note ? html`<p class="small">${s.note}</p>` : ''}
      ${s.fuel && s.type !== 'race' ? html`<p class="small"><b>Fuel:</b> ${s.rehearsal ? 'Full race-morning rehearsal: same breakfast, shoes and kit, start at 7 AM, and a gel about every 40 min.' : 'A gel or chews about every 40 min. Practice with what the course serves (BPN).'}</p>` : ''}
      ${s.strength ? html`<p class="small"><b>Plus strength</b> after the run (${s.strength === 'intro' ? 'bodyweight, 2 sets' : 'full sets with load'}).</p>` : ''}
      ${s.type === 'strength' && s.walkOptional && wk <= 8 ? html`<p class="small"><b>Optional:</b> a walk, or a 45–60 min ruck. Never the day before a long run.</p>` : ''}
      ${s.type === 'strength' && s.walkOptional && wk > 8 ? html`<p class="small"><b>Optional:</b> a walk or light ruck, 25 lb or less.</p>` : ''}
      ${spike ? html`<p class="note warn small">This is ${Math.round(spike.pct * 100)}% longer than your longest run in the past 30 days (${fmtMiles(spike.longest)} mi). One-run jumps like this are linked to injury. Consider stopping around ${spike.suggest} mi.</p>` : ''}
      ${s.timeTrial && !p ? html`<p class="note small">Run the 5K at the most even hard effort you can hold, finishing with nothing left. The app times the 5K segment on its own; you can correct the time afterward.</p>` : ''}

      ${actions(s, date, st, runs, isToday)}
    </article>

    ${ttRun && !state.timeTrial ? html`<div class="card" style="margin-top:12px">
        <h3>Your 5K: ${fmtDuration(ttRun.timeTrialSeconds)}</h3>
        <p class="small muted">Use this to set every training pace? GPS can be off by a few percent; edit the time if your watch or a track says otherwise.</p>
        <div class="row"><input type="text" inputmode="numeric" id="tt-time" value="${fmtDuration(ttRun.timeTrialSeconds)}" aria-label="5K time"><button class="btn" id="tt-save">Set paces</button></div>
      </div>` : ''}

    ${runs.length ? html`<section><h3 style="margin-bottom:6px">Logged</h3><div class="runlist">${runs.map(runRow)}</div></section>` : ''}

    ${isToday && tomorrow ? html`<section><div class="eyebrow">Tomorrow</div><a class="day fx-${sessionFx(tomorrow)}" style="padding-left:0" href="#/day/${tomorrow.date}"><i class="sw"></i><span class="what">${tomorrow.title}</span></a></section>` : ''}

    <section><div class="spread" style="margin-bottom:8px"><h3>The plan</h3><a class="linkbtn" href="#/plan">All weeks</a></div>${band()}</section>
    ${p ? pacesCard(p, wk) : html`<section><div class="card"><h3>Training paces</h3><p class="small muted" style="margin:6px 0 0">Paces get set from your week-3 5K time trial. Until then, go by effort and the talk test. <a href="#/settings">Enter a 5K time</a></p></div></section>`}
    ${tabs(isToday ? 'today' : 'plan')}
  `;
}

function actions(s, date, st, runs, isToday) {
  const past = daysBetween(today(), date) < 0;
  const future = daysBetween(today(), date) > 0;
  const btns = [];
  if (isRun(s) && !st) {
    btns.push(html`<a class="btn primary block" href="#/run/${date}">${future ? 'Start this run early' : 'Start run'}</a>`);
    btns.push(html`<div class="btns" style="margin-top:10px"><a class="btn" href="#/guide/warmup/${date}">Leg swings</a><button class="btn" data-manual="${date}">Log manually</button></div>`);
  } else if (s.type === 'strength' && !st) {
    btns.push(html`<a class="btn primary block" href="#/guide/strength/${date}">Start strength</a>`);
  } else if (s.type === 'mobility' && !st) {
    btns.push(html`<a class="btn primary block" href="#/guide/mobility/${date}">Start 15 min mobility</a>`);
  }
  if (st === 'done' || st === 'partial') {
    if (isRun(s)) btns.push(html`<a class="btn block" href="#/guide/stretch/${date}">Post-run stretches${state.logs.get(date)?.stretched ? ' ✓' : ''}</a>`);
    if (s.strength && !state.logs.get(date)?.strengthDone) btns.push(html`<a class="btn primary block" style="margin-top:10px" href="#/guide/strength/${date}">Start strength</a>`);
  }
  const marks = [];
  if (!st && !s.movedAway) {
    if (s.type === 'rest' || s.type === 'mobility') marks.push(html`<button class="linkbtn" data-mark="done">Mark rested</button>`);
    if (s.type === 'strength') marks.push(html`<button class="linkbtn" data-mark="done">Mark done</button>`);
    if (s.type !== 'rest' && !future) marks.push(html`<button class="linkbtn" data-mark="skipped">Skip ${past ? 'it' : 'today'}</button>`);
  } else if (st && !s.movedAway) marks.push(html`<button class="linkbtn" data-mark="">Clear status</button>`);
  if (!future && !(isRun(s) && !st)) marks.push(html`<button class="linkbtn" data-manual="${date}" data-kind-default="walk">Log a walk or ruck</button>`);
  return html`<div style="margin-top:6px">${btns}<div class="row" style="margin-top:8px;gap:18px">${marks}</div></div>`;
}

function welcomeBack(date) {
  // Days since the last completed run, if the plan had runs in between.
  const done = [...state.logs.values()].filter((l) => l.status === 'done' && isRun(sessionFor(l.date))).map((l) => l.date).sort();
  const last = done.at(-1);
  if (!last) return null;
  const gap = daysBetween(last, date);
  if (gap < 5) return null;
  const missedRuns = SCHEDULE.filter((s) => s.date > last && s.date < date && isRun(s) && !statusOf(s.date)).length;
  if (missedRuns < 2) return null;
  if (date === RESTART.date || (date > RESTART.date && last < RESTART.date)) return 'This week repeats week 1 so your shins and calves can catch up. The time trial moved to Thu Nov 19. Keep every run easy.';
  return gap >= 9
    ? `It’s been ${gap} days since your last run. The plan’s rule: after a full missed week, repeat the previous week rather than jumping ahead. Start easy today.`
    : 'Pick up with today’s session. No need to make anything up.';
}

function beforeOrAfter(date) {
  const after = date > RACE.date;
  return html`<header class="dayline"><div class="date">${fmtDay(date, true)}</div></header>
    <div class="card"><h1 class="title">${after ? 'Race done' : 'Plan starts Oct 26'}</h1><p class="why">${after ? 'Recovery week: walk, sleep, eat. Easy jogs only once nothing hurts.' : ''}</p></div>
    <section>${band()}</section>${tabs('today')}`;
}

function pacesCard(p, wk) {
  const rows = ['easy', 'hmp', 'tempo', 'interval', 'stride'].map((k) => html`<li class="fx-${k}"><i class="sw"></i><span>${EFFORTS[k].label}</span><span class="pace">${paceText(k, p)}</span></li>`);
  return html`<section><div class="card">
    <div class="spread"><h3>Training paces</h3><span class="small muted">from ${fmtDuration(state.timeTrial.seconds)} 5K</span></div>
    <ul class="steps" style="margin-top:8px">${rows}</ul>
    <p class="small muted" style="margin:0">Paces are a guide; on hot or hilly days, run the effort. HMP includes a 15 s/mi cushion for a first half on a hilly course.${wk >= 11 ? ` Equivalent half time: ${fmtDuration(p.halfPrediction)}.` : ''}</p>
  </div></section>`;
}

const KIND = { run: 'Run', walk: 'Walk', ruck: 'Ruck' };

function runRow(r) {
  const kind = r.kind || 'run';
  return html`<a href="#/runs/${r.id}"><span><b class="num" style="font-size:22px">${fmtMiles(r.miles)} mi</b> <span class="muted small">${fmtDay(r.date)}${kind !== 'run' ? ` · ${KIND[kind]}` : ''}</span><br><span class="small muted">${r.title || ''}</span></span>
    <span class="num" style="font-size:19px;text-align:right">${r.seconds ? fmtDuration(r.seconds) : ''}<br><span class="muted">${r.miles && r.seconds ? fmtPace(r.seconds / r.miles) + '/mi' : ''}</span></span></a>`;
}

export function bindDay(root, date, rerender) {
  root.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', async () => { await moveSession(b.dataset.move, date); rerender(); }));
  root.querySelectorAll('[data-undomove]').forEach((b) => b.addEventListener('click', async () => { await undoMove(b.dataset.undomove); rerender(); }));
  root.querySelectorAll('[data-mark]').forEach((b) => b.addEventListener('click', async () => { await saveLog({ date, status: b.dataset.mark || null }); rerender(); }));
  root.querySelectorAll('[data-manual]').forEach((b) => b.addEventListener('click', () => manualLog(date, rerender, b.dataset.kindDefault)));
  root.querySelector('#tt-save')?.addEventListener('click', async () => {
    const sec = parseFiveK(root.querySelector('#tt-time').value);
    if (sec) { await saveTimeTrial(sec, date); rerender(); }
  });
}

// ---- Check-in & manual log ----------------------------------------------

export function checkIn(date, runId, onDone) {
  let rpe = null, legs = null;
  const s = sessionOn(date);
  sheet(html`<h2>How did that feel?</h2>
    <p class="small muted">Two taps. This is how the app tracks load without a heart-rate strap.</p>
    <div class="eyebrow" style="margin:14px 0 6px">Effort, 0 to 10</div>
    <div class="rpe">${Array.from({ length: 11 }, (_, i) => html`<button data-rpe="${i}" aria-pressed="false">${i}</button>`)}</div>
    <div class="spread small muted" style="margin-top:4px"><span>Rest</span><span>Easy 3–4</span><span>Max</span></div>
    <div class="eyebrow" style="margin:16px 0 6px">Legs</div>
    <div class="chips">${LEG_FEEL.map((l) => html`<button data-legs="${l.id}" aria-pressed="false">${l.label}</button>`)}</div>
    <div id="pain" hidden><p class="note warn small" style="margin-top:12px">${RULES.injury[0]} ${RULES.injury[1]}</p></div>
    <label class="field" style="margin-top:14px"><span>Note (optional)</span><input type="text" id="ci-note" placeholder="Hot, hilly, felt strong..."></label>
    ${s && isRun(s) && s.type !== 'race' ? html`<div class="chips" style="margin-top:12px"><button data-st="done" aria-pressed="true">Did the whole thing</button><button data-st="partial" aria-pressed="false">Cut it short</button></div>` : ''}
    <button class="btn primary block" style="margin-top:16px" id="ci-save">Save</button>`,
  (el, close) => {
    let status = 'done';
    const pick = (attr, cb) => el.querySelectorAll(`[data-${attr}]`).forEach((b) => b.addEventListener('click', () => {
      el.querySelectorAll(`[data-${attr}]`).forEach((x) => x.setAttribute('aria-pressed', x === b));
      cb(b.dataset[attr]);
    }));
    pick('rpe', (v) => { rpe = +v; });
    pick('legs', (v) => { legs = v; el.querySelector('#pain').hidden = v !== 'pain'; });
    pick('st', (v) => { status = v; });
    el.querySelector('#ci-save').addEventListener('click', async () => {
      const note = el.querySelector('#ci-note').value.trim();
      await saveLog({ date, status, runId, rpe, legs, note: note || undefined });
      const run = runById(runId);
      if (run) await saveRun({ ...run, rpe, legs, note: note || run.note });
      close();
      onDone?.();
    });
  });
}

function manualLog(date, rerender, initialKind = 'run') {
  const s = sessionOn(date);
  let kind = initialKind;
  sheet(html`<h2>Log an activity</h2><p class="small muted">For runs recorded somewhere else or without GPS, and for walks and rucks. Walks and rucks don’t count toward running miles.</p>
    <div class="chips" style="margin-top:12px">${Object.entries(KIND).map(([k, l]) => html`<button data-kind="${k}" aria-pressed="${k === initialKind}">${l}</button>`)}</div>
    <div class="row" style="margin-top:12px">
      <label class="field" style="flex:1"><span>Miles</span><input type="number" step="0.01" inputmode="decimal" id="ml-mi" value="${initialKind === 'run' ? s?.distance || '' : ''}"></label>
      <label class="field" style="flex:1"><span>Time (mm:ss)</span><input type="text" inputmode="numeric" id="ml-time" placeholder="31:20"></label>
    </div>
    ${s?.timeTrial ? html`<label class="field" style="margin-top:12px" id="ml-tt-wrap" ${initialKind !== 'run' ? raw('hidden') : ''}><span>5K time trial (mm:ss)</span><input type="text" inputmode="numeric" id="ml-tt" placeholder="27:45"></label>` : ''}
    <p class="small" id="ml-err" style="color:var(--interval)" hidden></p>
    <button class="btn primary block" style="margin-top:16px" id="ml-save">Save</button>`,
  (el, close) => {
    el.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => {
      kind = b.dataset.kind;
      el.querySelectorAll('[data-kind]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      if (kind !== 'run') el.querySelector('#ml-mi').value = '';
      const tt = el.querySelector('#ml-tt-wrap');
      if (tt) tt.hidden = kind !== 'run';
    }));
    el.querySelector('#ml-save').addEventListener('click', async () => {
      const err = el.querySelector('#ml-err');
      const miles = parseFloat(el.querySelector('#ml-mi').value);
      const timeText = el.querySelector('#ml-time').value.trim();
      const seconds = timeText ? parseDuration(timeText) : null;
      if (!(miles > 0)) { err.textContent = 'Enter the distance in miles.'; err.hidden = false; return; }
      if (kind === 'run' && !(seconds > 60)) { err.textContent = 'Enter a time like 31:20.'; err.hidden = false; return; }
      const ttText = kind === 'run' ? el.querySelector('#ml-tt')?.value.trim() : null;
      const tt = ttText ? parseFiveK(ttText) : null;
      if (ttText && !tt) { err.textContent = 'Enter the 5K time like 27:45.'; err.hidden = false; return; }
      const run = { id: `m-${Date.now()}`, kind, date, startedAt: parseDate(date).getTime() + 7 * 3600e3, manual: true, miles, seconds, title: kind === 'run' ? s?.title : KIND[kind], points: [], splits: [], timeTrialSeconds: tt || undefined };
      await saveRun(run);
      if (tt) await saveTimeTrial(tt, date);
      close();
      if (kind === 'run') checkIn(date, run.id, rerender);
      else rerender();
    });
  });
}

// ---- Plan ------------------------------------------------------------------

export function planView() {
  const t = today();
  const cur = weekOf(t);
  return html`<header class="dayline"><h1>Plan</h1><div class="meta">${RACE.name}<br>Sun Feb 14, 7:00 AM</div></header>
    <p class="small muted" style="margin-top:0">${RULES.missed}</p>
    ${WEEK_TOTALS.map((w) => {
      const days = SCHEDULE.filter((s) => s.week === w.week);
      const done = weekMiles(w.week);
      return html`<div class="week ${w.week === cur ? 'now' : ''}" id="wk-${w.week}">
        <header><b>Week ${w.week} · ${w.repeatOf ? (w.repeatOf < w.week ? `repeats wk ${w.repeatOf}` : `wk ${w.repeatOf} plan`) : phaseName(w.phase)}</b><span class="small muted">${done ? fmtMiles(done) + ' of ' : ''}${w.total} mi</span></header>
        ${days.map((d0) => {
          const s = sessionOn(d0.date);
          const st = statusOf(d0.date);
          const isRest = s.type === 'rest' || s.type === 'mobility';
          return html`<a class="day fx-${sessionFx(s)} ${isRest ? 'rest' : ''} ${d0.date === t ? 'is-today' : ''}" href="#/day/${d0.date}">
            <span class="dn">${dowName(d0.date)}<b>${parseDate(d0.date).getDate()}</b></span><i class="sw"></i>
            <span class="what">${s.title}${s.strength ? ' + strength' : ''}</span><span class="st">${st ? STATUS_LABEL[st] : ''}</span></a>`;
        })}</div>`;
    })}
    ${tabs('plan')}`;
}

// ---- Progress ------------------------------------------------------------

export function progressView() {
  const t = today();
  const wk = weekOf(t) || (t > RACE.date ? 16 : 1);
  const plannedSoFar = WEEK_TOTALS.slice(0, wk).reduce((a, w) => a + w.total, 0);
  const total = state.runs.filter(isRunActivity).reduce((a, r) => a + (r.miles || 0), 0);
  const left = WEEK_TOTALS.slice(wk).reduce((a, w) => a + w.total, 0);
  const runsDone = [...state.logs.values()].filter((l) => l.status === 'done' && isRun(sessionFor(l.date))).length;
  const late = wk >= 9;
  return html`<header class="dayline"><h1>Progress</h1><div class="meta">Week ${wk} of 16<br>${daysToRace()} days to race</div></header>
    <div class="stat-row">
      <div class="stat"><b>${fmtMiles(weekMiles(wk))}</b><span>of ${WEEK_TOTALS[wk - 1].total} mi this week</span></div>
      ${late
        ? html`<div class="stat"><b>${Math.round(left)}</b><span>planned miles left</span></div>`
        : html`<div class="stat"><b>${Math.round(total)}</b><span>miles run of ${Math.round(plannedSoFar)} planned so far</span></div>`}
      <div class="stat"><b>${runsDone}</b><span>runs done</span></div>
    </div>
    <section><h3>Weekly miles</h3><p class="small muted" style="margin:2px 0 8px">Outline is the plan; fill is what you ran.</p>${weeklyChart(wk)}</section>
    <section><h3>Long-run ladder</h3><p class="small muted" style="margin:2px 0 8px">Every Sunday, up to 13.1.</p>${ladder()}</section>
    <section><h3>Easy-run pace</h3><p class="small muted" style="margin:2px 0 8px">At the same easy effort, this drifts faster as you get fitter.</p>${easyTrend()}</section>
    <section><h3>Every session</h3><div style="margin-top:8px">${band()}</div></section>
    <section><a class="btn block" href="#/settings">Settings and backup</a></section>
    ${tabs('progress')}`;
}

function weeklyChart(cur) {
  const W = 340, H = 150, pad = 18, bw = (W - pad) / 16;
  const max = 28;
  const y = (mi) => H - 18 - (mi / max) * (H - 30);
  const bars = WEEK_TOTALS.map((w, i) => {
    const x = pad + i * bw + 2;
    const done = weekMiles(w.week);
    const fx = w.phase === 'cutback' ? 'var(--rest)' : 'var(--easy)';
    return `<rect x="${x}" y="${y(w.total)}" width="${bw - 4}" height="${H - 18 - y(w.total)}" rx="2" fill="none" stroke="${w.week === cur ? 'var(--ink)' : 'var(--line)'}" stroke-width="1.2"/>
      ${done ? `<rect x="${x}" y="${y(Math.min(done, max))}" width="${bw - 4}" height="${H - 18 - y(Math.min(done, max))}" rx="2" fill="${fx}"/>` : ''}
      <text x="${x + (bw - 4) / 2}" y="${H - 4}" text-anchor="middle">${w.week}</text>`;
  }).join('');
  const grid = [10, 20].map((m) => `<line x1="${pad}" x2="${W}" y1="${y(m)}" y2="${y(m)}" stroke="var(--line)" stroke-dasharray="2 3"/><text x="0" y="${y(m) + 4}">${m}</text>`).join('');
  return raw(`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly miles, planned versus run">${grid}${bars}</svg>`);
}

function ladder() {
  const longs = SCHEDULE.filter((s) => s.dow === 6);
  return html`<ul class="ladder">${longs.map((s) => {
    const r = runsOn(s.date).sort((a, b) => b.miles - a.miles)[0];
    const pct = Math.min(100, ((r ? r.miles : s.distance) / 13.1) * 100);
    return html`<li><span class="num" style="font-size:16px">Wk ${s.week}</span>
      <span class="bar ${r ? '' : 'planned'}"><span style="width:${pct}%;${s.type === 'race' ? 'background:var(--race)' : ''}"></span></span>
      <span class="num" style="font-size:16px;text-align:right">${r ? fmtMiles(r.miles) : s.distance}${r ? '' : raw(' <span class="muted">plan</span>')}</span></li>`;
  })}</ul>`;
}

function easyTrend() {
  const easy = state.runs.filter((r) => isRunActivity(r) && r.miles >= 1.5 && ['easy', 'long'].includes(sessionFor(r.date)?.type) && r.seconds).slice().reverse();
  if (easy.length < 2) return html`<p class="small muted">Shows up after a couple of easy runs.</p>`;
  const W = 340, H = 130, pad = 34;
  const ps = easy.map((r) => r.seconds / r.miles);
  const lo = Math.min(...ps) - 20, hi = Math.max(...ps) + 20;
  const t0 = parseDate(easy[0].date), t1 = parseDate(easy.at(-1).date);
  const span = Math.max(1, t1 - t0);
  const x = (r) => pad + ((parseDate(r.date) - t0) / span) * (W - pad - 8);
  const y = (p) => 10 + ((p - lo) / (hi - lo)) * (H - 30); // faster pace = higher on the chart
  const dots = easy.map((r, i) => `<circle cx="${x(r)}" cy="${y(ps[i])}" r="4" fill="var(--easy)"/>`).join('');
  const labels = [lo + 20, hi - 20].map((p) => `<text x="0" y="${y(p) + 4}">${fmtPace(p)}</text>`).join('');
  return raw(`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Easy run pace over time">${labels}${dots}</svg><p class="small muted">Higher is faster.</p>`);
}

// ---- Runs list and detail -----------------------------------------------

export function runsView() {
  return html`<header class="dayline"><h1>Runs</h1><div class="meta">${state.runs.length} logged<br>${fmtMiles(state.runs.filter(isRunActivity).reduce((a, r) => a + (r.miles || 0), 0))} mi run</div></header>
    ${state.runs.length ? html`<div class="card runlist">${state.runs.map(runRow)}</div>` : html`<div class="card"><p>No runs yet. Start one from Today.</p></div>`}
    <section><a class="btn block" href="#/run/free">Start a free run</a></section>
    ${tabs('log')}`;
}

export function runDetailView(id) {
  const r = runById(id);
  if (!r) return html`<p>Run not found. <a href="#/log">Back</a></p>${tabs('log')}`;
  const pace = r.miles && r.seconds ? r.seconds / r.miles : null;
  const splits = r.splits || [];
  return html`<header class="dayline"><div><div class="date">${fmtDay(r.date, true)}</div><a class="linkbtn" href="#/log">All runs</a></div><div class="meta">${r.title || ''}${r.kind && r.kind !== 'run' ? html`<br>${KIND[r.kind]}, not counted as running miles` : ''}</div></header>
    ${r.points?.length > 1 ? html`<div class="map" id="map"></div>` : r.manual ? html`<p class="small muted">Logged by hand, no route.</p>` : ''}
    <div class="stat-row" style="margin-top:12px">
      <div class="stat"><b>${fmtMiles(r.miles)}</b><span>miles</span></div>
      <div class="stat"><b>${r.seconds ? fmtDuration(r.seconds) : '–'}</b><span>time</span></div>
      <div class="stat"><b>${pace ? fmtPace(pace) : '–'}</b><span>avg /mi</span></div>
    </div>
    <div class="stat-row" style="margin-top:10px">
      ${r.elevGainFt != null ? html`<div class="stat"><b>${Math.round(r.elevGainFt)}</b><span>ft climbed</span></div>` : ''}
      ${r.rpe != null ? html`<div class="stat"><b>${r.rpe}/10</b><span>effort</span></div>` : ''}
      ${r.legs ? html`<div class="stat"><b style="font-size:22px">${LEG_FEEL.find((l) => l.id === r.legs)?.label}</b><span>legs</span></div>` : ''}
      ${r.timeTrialSeconds ? html`<div class="stat"><b>${fmtDuration(r.timeTrialSeconds)}</b><span>5K time trial</span></div>` : ''}
    </div>
    ${r.gaps?.length ? html`<p class="note small" style="margin-top:12px">${r.gaps.length} GPS gap${r.gaps.length > 1 ? 's' : ''} while the app was in the background (${Math.round(r.gaps.reduce((a, g) => a + (g[1] - g[0]), 0) / 1000)} sec). Distance during gaps is estimated as a straight line.</p>` : ''}
    ${r.note ? html`<p>${r.note}</p>` : ''}
    ${splits.length ? html`<section><h3>Splits</h3><table class="splits"><tr><th>Mile</th><th>Split</th><th>Total</th></tr>
      ${splits.map((sec, i) => html`<tr><td class="num">${i + 1}</td><td class="num">${fmtPace(sec - (splits[i - 1] || 0))}</td><td class="num muted">${fmtDuration(sec)}</td></tr>`)}
      ${r.miles % 1 > 0.05 ? html`<tr><td class="num">${fmtMiles(r.miles % 1)}</td><td class="num">${fmtPace((r.seconds - (splits.at(-1) || 0)) / (r.miles % 1))}<span class="muted small"> /mi</span></td><td class="num muted">${fmtDuration(r.seconds)}</td></tr>` : ''}
      </table></section>` : ''}
    ${r.steps?.length ? html`<section><h3>Workout</h3><table class="splits"><tr><th>Step</th><th>Dist</th><th>Pace</th></tr>
      ${r.steps.map((s) => html`<tr><td class="small">${s.label}</td><td class="num">${fmtMiles(s.miles)}</td><td class="num">${s.miles > 0.02 ? fmtPace(s.seconds / s.miles) : fmtDuration(s.seconds)}</td></tr>`)}</table></section>` : ''}
    <section class="btns">
      ${r.points?.length > 1 ? html`<button class="btn" id="gpx">Export GPX</button>` : ''}
      <button class="btn" id="ci">Edit check-in</button>
      <button class="btn ghost" id="del">Delete run</button>
    </section>
    ${tabs('log')}`;
}

export async function bindRunDetail(root, id, rerender) {
  const r = runById(id);
  if (!r) return;
  root.querySelector('#ci')?.addEventListener('click', () => checkIn(r.date, r.id, rerender));
  root.querySelector('#gpx')?.addEventListener('click', () => shareFile(`run-${r.date}.gpx`, toGPX(r), 'application/gpx+xml'));
  const del = root.querySelector('#del');
  del?.addEventListener('click', async () => {
    if (del.dataset.confirm) { await deleteRun(id); go('#/log'); return; }
    del.dataset.confirm = '1';
    del.textContent = 'Tap again to delete';
  });
  if (r.points?.length > 1) {
    const { drawRoute } = await import('./map.js');
    drawRoute(root.querySelector('#map'), r);
  }
}

async function shareFile(name, text, type) {
  const file = new File([text], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---- Settings --------------------------------------------------------------

export function settingsView(persisted) {
  const tt = state.timeTrial;
  return html`<header class="dayline"><div><h1>Settings</h1><a class="linkbtn" href="#/progress">Back</a></div></header>
    <section class="card stack">
      <h3>5K time</h3>
      <p class="small muted" style="margin:0">Sets every training pace. ${tt ? `Current: ${fmtDuration(tt.seconds)} on ${fmtDay(tt.date)}.` : 'None yet: run the week-3 time trial.'}</p>
      <div class="row"><input type="text" inputmode="numeric" id="tt" placeholder="27:45" value="${tt ? fmtDuration(tt.seconds) : ''}" aria-label="5K time"><button class="btn" id="tt-save">Save</button></div>
    </section>
    <section class="card stack">
      <h3>Cues during runs</h3>
      <label class="row"><input type="checkbox" id="voice" ${cueSettings.voice ? 'checked' : ''}> Voice cues <span class="small muted">(music dips while it speaks)</span></label>
      <label class="row"><input type="checkbox" id="beeps" ${cueSettings.beeps ? 'checked' : ''}> Beeps <span class="small muted">(play over music; off when the ringer switch is silent)</span></label>
    </section>
    <section class="card stack">
      <h3>Your data</h3>
      <p class="small muted" style="margin:0">Everything stays on this phone. ${persisted ? 'Storage is marked persistent.' : 'Storage isn’t marked persistent yet; add the app to your Home Screen.'} Back up now and then to iCloud Drive.</p>
      <div class="btns"><button class="btn" id="export">Back up</button><label class="btn">Restore<input type="file" id="import" accept="application/json,.json" hidden></label></div>
      <p class="small" id="msg" aria-live="polite"></p>
    </section>
    <section class="card stack">
      <h3>Guardrails</h3>
      ${RULES.injury.map((t) => html`<p class="small" style="margin:0">${t}</p>`)}
      <p class="small" style="margin:0"><b>Fueling:</b> ${RULES.fueling}</p>
      <p class="small" style="margin:0"><b>Shoes:</b> ${RULES.shoes}</p>
    </section>
    <section class="card stack">
      <h3>App version</h3>
      <p class="small muted" style="margin:0">Build ${BUILD}. Pull down at the top of any page to load the newest version, or tap below.</p>
      <div class="btns"><button class="btn" id="reload">Reload app</button></div>
    </section>
    ${tabs('progress')}`;
}

export function bindSettings(root, rerender) {
  const msg = root.querySelector('#msg');
  root.querySelector('#tt-save').addEventListener('click', async () => {
    const sec = parseFiveK(root.querySelector('#tt').value);
    if (!sec) { msg.textContent = 'Enter a 5K time like 27:45.'; return; }
    await saveTimeTrial(sec);
    rerender();
  });
  root.querySelector('#reload').addEventListener('click', () => location.reload());
  for (const k of ['voice', 'beeps']) root.querySelector('#' + k).addEventListener('change', (e) => { cueSettings[k] = e.target.checked; settings.set('cues', { ...cueSettings }); });
  root.querySelector('#export').addEventListener('click', async () => {
    const data = await exportAll();
    await shareFile(`austin-half-backup-${today()}.json`, JSON.stringify(data), 'application/json');
  });
  root.querySelector('#import').addEventListener('change', async (e) => {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      await importAll(data);
      msg.textContent = `Restored ${data.runs.length} runs.`;
      location.reload();
    } catch (err) { msg.textContent = err.message; }
  });
}

export { esc };
