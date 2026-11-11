// Guided strength / stretch / mobility player: one exercise at a time, picture of each position,
// timers for holds and rest, spoken cues. Resumes if the app closes mid-session.

import { EXERCISES, strengthRoutine, STRETCH_ROUTINE, WARMUP_ROUTINE, MOBILITY_ROUTINE } from './content.js';
import { fmtDuration } from './paces.js';
import { weekOf } from './plan.js';
import { unlock, say, beep } from './cues.js';
import { settings } from './db.js';
import { sessionOn, saveLog } from './state.js';
import { html, render } from './ui.js';

const GET_READY = 5;

function routineFor(kind, date) {
  if (kind === 'stretch') return STRETCH_ROUTINE;
  if (kind === 'warmup') return WARMUP_ROUTINE;
  if (kind === 'mobility') return MOBILITY_ROUTINE;
  const s = sessionOn(date);
  const wk = weekOf(date) || 3;
  return strengthRoutine(s?.strength || s?.level || (wk <= 2 ? 'intro' : wk <= 13 ? 'full' : 'light'));
}

// Expand a routine into a flat list of cards: work and rest.
function buildQueue(routine) {
  const q = [];
  routine.items.forEach((item, ei) => {
    const ex = EXERCISES[item.id];
    const sides = ex.perSide ? ['Left', 'Right'] : [null];
    for (let set = 1; set <= item.sets; set++) {
      sides.forEach((side, si) => {
        q.push({ type: 'work', id: item.id, ei, set, sets: item.sets, side, hold: ex.hold ? ex.hold[1] : null, reps: ex.reps });
        const lastSide = si === sides.length - 1;
        if (!lastSide && ex.hold) q.push({ type: 'switch', ei, seconds: 5, next: q.length });
      });
      const isLast = ei === routine.items.length - 1 && set === item.sets;
      if (!isLast && routine.rest) q.push({ type: 'rest', ei, seconds: routine.rest });
    }
  });
  return q;
}

export async function playerScreen(root, kind, date) {
  const routine = routineFor(kind, date);
  const queue = buildQueue(routine);
  const saved = await settings.get('player');
  let index = saved && saved.kind === kind && saved.date === date ? saved.index : -1;
  let timer = null;
  let left = 0;
  let phase = null; // 'ready' | 'hold' | 'rest' | 'switch' | null
  let paused = false;
  let frame = 0;
  let flipper = null;

  const save = () => settings.set('player', index >= 0 ? { kind, date, index } : null);
  const back = () => { location.hash = kind === 'warmup' ? `#/run/${date}` : `#/day/${date}`; };

  function intro() {
    render(root, html`<div class="player">
      <div class="top"><a class="linkbtn" href="#/day/${date}">Close</a><span class="small muted">${routine.items.length} exercises</span></div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center">
        <div class="eyebrow">Guided</div>
        <h1 style="font-size:48px">${routine.title}</h1>
        <p>${routine.intro}</p>
        <ol style="padding-left:20px">${routine.items.map((it) => html`<li>${EXERCISES[it.id].name} <span class="muted small">${it.sets > 1 ? `· ${it.sets} sets` : ''}</span></li>`)}</ol>
      </div>
      <button class="btn primary block" id="begin">${index > 0 ? 'Resume where you left off' : 'Begin'}</button>
      ${index > 0 ? html`<button class="linkbtn" id="restart" style="align-self:center;margin-top:8px">Start over</button>` : ''}
    </div>`);
    root.querySelector('#begin').addEventListener('click', () => { unlock(); show(Math.max(0, index)); });
    root.querySelector('#restart')?.addEventListener('click', () => { unlock(); show(0); });
  }

  function stop() {
    clearInterval(timer); timer = null;
    clearInterval(flipper); flipper = null;
  }

  function countdown(seconds, onTick, onDone) {
    clearInterval(timer);
    left = seconds;
    onTick(left);
    timer = setInterval(() => {
      if (paused) return;
      left -= 1;
      if (left <= 3 && left > 0) beep('tick');
      onTick(left);
      if (left <= 0) { clearInterval(timer); timer = null; onDone(); }
    }, 1000);
  }

  function show(i) {
    stop();
    if (!document.body.contains(root)) return;
    if (i >= queue.length) return complete();
    index = i;
    save();
    const card = queue[i];
    const ex = EXERCISES[card.id || queue.slice(i).find((c) => c.type === 'work')?.id];
    const nextWork = queue.slice(i + 1).find((c) => c.type === 'work');
    const exCount = routine.items.length;

    if (card.type === 'rest' || card.type === 'switch') {
      const nx = EXERCISES[nextWork.id];
      phase = card.type;
      render(root, html`<div class="player">
        ${topBar(card.ei, exCount)}
        <div class="pos">${image(nx, 0)}</div>
        <div class="resting">
          <div class="eyebrow">${card.type === 'switch' ? 'Switch sides' : 'Rest'}</div>
          <div class="big" id="clock"></div>
          <div class="set">Next: ${nx.name}${nextWork.side ? ` · ${nextWork.side}` : ''}${nextWork.sets > 1 ? ` · set ${nextWork.set} of ${nextWork.sets}` : ''}</div>
        </div>
        ${controls(true)}
      </div>`);
      if (card.type === 'rest') say(`Rest. Next, ${nx.name}${nextWork.set > 1 ? `, set ${nextWork.set}` : ''}.`);
      else say('Switch sides.');
      countdown(card.seconds, (s) => setText('clock', fmtDuration(s)), () => show(i + 1));
      bindControls(i);
      return;
    }

    // Work card
    const isHold = card.hold != null;
    render(root, html`<div class="player">
      ${topBar(card.ei, exCount)}
      <div class="pos" id="pos">${image(ex, 0)}</div>
      <div>
        <div class="name">${ex.name}</div>
        <div class="set">${card.side ? `${card.side} side · ` : ''}${card.sets > 1 ? `Set ${card.set} of ${card.sets} · ` : ''}${isHold ? `${ex.hold[0] === ex.hold[1] ? ex.hold[1] : `${ex.hold[0]}–${ex.hold[1]}`} sec hold` : `${card.reps} reps${card.side ? '' : ''}`}</div>
        <ul class="cues">${ex.cues.map((c) => html`<li>${c}</li>`)}</ul>
        ${isHold ? html`<div class="big" id="clock"></div><div class="set" id="phase" style="text-align:center"></div>` : ''}
      </div>
      ${controls(isHold)}
    </div>`);

    // Two-position exercises alternate their pictures to show the movement.
    if (ex.images.length > 1) {
      flipper = setInterval(() => {
        frame = 1 - frame;
        const img = root.querySelector('#pos img');
        if (img) img.src = `img/ex/${ex.images[frame]}.webp`;
      }, 1600);
    }
    const first = card.set === 1 && (!card.side || card.side === 'Left');
    if (isHold) {
      phase = 'ready';
      say(first ? `${ex.name}. ${ex.cues[0]} Get into position.` : `${card.side ? card.side + ' side. ' : ''}Get into position.`);
      countdown(GET_READY, (s) => { setText('clock', s); setText('phase', 'Get into position'); }, () => {
        phase = 'hold';
        beep('go');
        say('Hold.');
        let halfSaid = false;
        countdown(card.hold, (s) => {
          setText('clock', fmtDuration(s));
          setText('phase', 'Hold');
          if (!halfSaid && s === Math.floor(card.hold / 2) && card.hold >= 30) { halfSaid = true; say('Halfway.'); }
        }, () => { beep('go'); show(i + 1); });
      });
    } else {
      phase = null;
      say(first ? `${ex.name}. ${card.reps} reps${card.side ? ' per leg, starting left' : ''}. ${ex.cues[1] || ''}` : `${card.side ? card.side + ' side, ' : ''}set ${card.set}. ${card.reps} reps.`);
    }
    bindControls(i);
  }

  function topBar(ei, n) {
    return html`<div class="top"><button class="linkbtn" id="close">Close</button><span class="small muted">Exercise ${ei + 1} of ${n}</span></div>
      <div class="progress">${Array.from({ length: n }, (_, k) => html`<span class="${k <= ei ? 'on' : ''}"></span>`)}</div>`;
  }

  function image(ex, f) {
    return html`<img src="img/ex/${ex.images[f]}.webp" alt="${ex.name} position" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph',textContent:this.alt}))">`;
  }

  function controls(timed) {
    return html`<div class="btns" style="margin-top:8px">
      <button class="btn" data-a="back">Back</button>
      ${timed ? html`<button class="btn" data-a="pause">${paused ? 'Resume' : 'Pause'}</button>` : html`<button class="btn primary" data-a="done">Done</button>`}
      <button class="btn" data-a="skip">Skip</button></div>`;
  }

  function bindControls(i) {
    root.querySelector('#close')?.addEventListener('click', () => { stop(); back(); });
    root.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.a;
      if (a === 'back') { paused = false; show(Math.max(0, prevWork(i))); }
      if (a === 'skip' || a === 'done') { paused = false; beep('go'); show(i + 1); }
      if (a === 'pause') { paused = !paused; b.textContent = paused ? 'Resume' : 'Pause'; }
    }));
  }

  function prevWork(i) {
    for (let k = i - 1; k >= 0; k--) if (queue[k].type === 'work') return k;
    return 0;
  }

  async function complete() {
    stop();
    index = -1;
    await save();
    beep('done');
    say('All done. Nice work.');
    if (kind === 'strength') {
      const s = sessionOn(date);
      await saveLog({ date, strengthDone: true, ...(s?.type === 'strength' ? { status: 'done' } : {}) });
    } else if (kind === 'stretch') await saveLog({ date, stretched: true });
    else if (kind === 'mobility') await saveLog({ date, status: 'done' });
    render(root, html`<div class="player"><div style="flex:1;display:flex;flex-direction:column;justify-content:center">
      <div class="eyebrow">Done</div><h1 style="font-size:48px">${routine.title}</h1><p>${kind === 'warmup' ? 'Legs are loose. Time to run.' : 'Logged for today.'}</p></div>
      <button class="btn primary block" id="ok">${kind === 'warmup' ? 'Go to run' : 'Back to today'}</button></div>`);
    root.querySelector('#ok').addEventListener('click', back);
  }

  function setText(id, v) {
    const el = root.querySelector('#' + id);
    if (el) el.textContent = v;
  }

  // Stop timers when navigating away.
  addEventListener('hashchange', stop, { once: true });
  intro();
}
