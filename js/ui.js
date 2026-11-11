// Small rendering helpers and shared components.

import { SCHEDULE, EFFORTS, parseDate, today, weekOf, flattenSteps, PHASES } from './plan.js';
import { fmtPace } from './paces.js';
import { state, statusOf, sessionOn } from './state.js';
import { WHY } from './content.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

// Tagged template: interpolations are escaped unless wrapped in raw().
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) out += flat(vals[i]);
  });
  return { __html: out };
}
const flat = (v) => (v == null || v === false ? '' : Array.isArray(v) ? v.map(flat).join('') : v.__html != null ? v.__html : esc(v));
export const raw = (s) => ({ __html: s });
export const render = (el, tpl) => { el.innerHTML = flat(tpl); };

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDay = (iso, long) => {
  const d = parseDate(iso);
  const dow = DOW[(d.getDay() + 6) % 7];
  return long ? `${dow}, ${MON[d.getMonth()]} ${d.getDate()}` : `${dow} ${MON[d.getMonth()]} ${d.getDate()}`;
};
export const dowName = (iso) => DOW[(parseDate(iso).getDay() + 6) % 7];
export const fmtMiles = (mi) => (mi == null ? '–' : (Math.round(mi * 100) / 100).toFixed(mi >= 10 ? 1 : 2));

// Main effort color for a session.
export function sessionFx(s) {
  if (!s) return 'rest';
  if (s.type === 'race') return 'race';
  if (s.type === 'strength') return 'strength';
  if (s.type === 'rest' || s.type === 'mobility') return 'rest';
  if (s.type === 'easy' || s.type === 'long') return 'easy';
  const efforts = flattenSteps(s.steps || []).map((x) => x.effort);
  for (const e of ['race', 'interval', 'hill', 'tempo', 'hmp', 'stride']) if (efforts.includes(e)) return e === 'race' ? 'interval' : e;
  return 'easy';
}

export const STATUS_LABEL = { done: 'Done', partial: 'Partial', moved: 'Moved', skipped: 'Skipped' };

// The pace band: 16 weeks across, Mon–Sun down. Filled cells are sessions done.
export function band() {
  const t = today();
  const weeks = [];
  for (let w = 1; w <= 16; w++) {
    const days = SCHEDULE.filter((s) => s.week === w);
    weeks.push(html`<div class="wk ${weekOf(t) === w ? 'now' : ''}"><span>${w}</span>${days.map((s) => {
      const eff = sessionOn(s.date);
      const st = statusOf(s.date);
      const fx = sessionFx(eff);
      const isRest = eff.type === 'rest' || eff.type === 'mobility';
      const cls = [isRest && st !== 'done' ? 'rest' : '', st || '', s.date === t ? 'today' : ''].join(' ');
      return html`<a class="c fx-${fx} ${cls}" href="#/day/${s.date}" aria-label="${fmtDay(s.date)}: ${eff.title}${st ? ', ' + STATUS_LABEL[st] : ''}"></a>`;
    })}</div>`);
  }
  return html`<div class="band" role="group" aria-label="16-week plan">${weeks}</div>
    <div class="band-legend">${['easy', 'tempo', 'hmp', 'interval', 'hill', 'strength'].map((k) => html`<span class="fx-${k}"><i></i>${k === 'hmp' ? 'HMP' : k === 'interval' ? 'Intervals / 5K' : k[0].toUpperCase() + k.slice(1)}</span>`)}</div>`;
}

export function paceText(effort, paces) {
  if (!paces) return '';
  const p = paces.paces[effort];
  if (!p || effort === 'race') return '';
  if (effort === 'hmp') return fmtPace(p.target);
  return `${fmtPace(p.fast)}–${fmtPace(p.slow)}`;
}

export function stepRows(session, paces) {
  const rows = [];
  for (const s of session.steps || []) {
    if (s.repeat) {
      const work = s.steps[0];
      const rec = s.steps[1];
      rows.push(html`<li class="fx-${work.effort}"><i class="sw"></i><span>${s.repeat} × ${work.label.replace(/^\d+ × /, '')}${rec ? html`<br><span class="muted small">${rec.label}${s.dropLastRecovery ? ' between' : ''}</span>` : ''}</span><span class="pace">${paceText(work.effort, paces)}</span></li>`);
    } else {
      rows.push(html`<li class="fx-${s.effort}"><i class="sw"></i><span>${s.label}</span><span class="pace">${s.effort === 'easy' ? 'by feel' : paceText(s.effort, paces)}</span></li>`);
    }
  }
  return html`<ul class="steps">${rows}</ul>`;
}

export function whyFor(s) {
  if (s.timeTrial) return WHY.timeTrial;
  return WHY[s.type] || '';
}

export function effortLine(s) {
  const fx = sessionFx(s);
  const e = EFFORTS[fx === 'interval' && s.timeTrial ? 'race' : fx];
  if (!e || s.type === 'rest' || s.type === 'strength' || s.type === 'mobility') return null;
  return html`<p class="small"><b>${e.label}:</b> ${e.feel}. Talk test: ${e.talk.toLowerCase()}.</p>`;
}

export const phaseName = (p) => PHASES[p] || p;

export const ICONS = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="4.5" r="2"/><path d="M8 21l3-6 3 2v5M6 12l3-4 4 1 3 3 3 1M10.5 9l-1.5 6"/></svg>',
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M7 13h2M11 13h2M15 13h2M7 17h2M11 17h2"/></svg>',
  progress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  log: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18c3-1 4-7 8-7s4 5 8 3"/><circle cx="4" cy="18" r="2"/><circle cx="20" cy="14" r="2"/></svg>',
};

export function tabs(active) {
  const items = [['today', 'Today'], ['plan', 'Plan'], ['progress', 'Progress'], ['log', 'Runs']];
  return html`<nav class="tabs">${items.map(([k, l]) => html`<a href="#/${k}" ${active === k ? raw('aria-current="page"') : ''}>${raw(ICONS[k])}${l}</a>`)}</nav>`;
}

export function sheet(content, onMount) {
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${flat(content)}</div>`;
  bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
  document.body.appendChild(bg);
  const close = () => bg.remove();
  onMount?.(bg.querySelector('.sheet'), close);
  return close;
}

export const daysToRace = () => {
  const ms = parseDate('2027-02-14') - parseDate(today());
  return Math.round(ms / 86400000);
};

export { state };
