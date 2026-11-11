// Router and startup.

import { loadState, state } from './state.js';
import { settings, requestPersistence } from './db.js';
import { cueSettings } from './cues.js';
import { render } from './ui.js';
import { dayView, bindDay, planView, progressView, runsView, runDetailView, bindRunDetail, settingsView, bindSettings } from './views.js';
import { runScreen } from './run.js';
import { playerScreen } from './player.js';
import { today, weekOf } from './plan.js';

const root = document.getElementById('app');
let persisted = false;

async function route() {
  const [view, arg, arg2] = location.hash.replace(/^#\/?/, '').split('/');
  const rerender = () => route();
  window.scrollTo?.(0, 0);
  switch (view || 'today') {
    case 'today':
      render(root, dayView(today()));
      bindDay(root, today(), rerender);
      break;
    case 'day':
      render(root, dayView(arg));
      bindDay(root, arg, rerender);
      break;
    case 'plan': {
      render(root, planView());
      const wk = weekOf(today());
      if (wk) root.querySelector(`#wk-${wk}`)?.scrollIntoView({ block: 'start' });
      break;
    }
    case 'progress':
      render(root, progressView());
      break;
    case 'log':
      render(root, runsView());
      break;
    case 'runs':
      render(root, runDetailView(arg));
      bindRunDetail(root, arg, rerender);
      break;
    case 'run':
      runScreen(root, arg || 'free');
      break;
    case 'guide':
      await playerScreen(root, arg, arg2 || today());
      break;
    case 'settings':
      render(root, settingsView(persisted));
      bindSettings(root, rerender);
      break;
    default:
      location.hash = '#/today';
  }
}

async function start() {
  await loadState();
  state.activeRun = await settings.get('activeRun');
  Object.assign(cueSettings, await settings.get('cues', {}));
  persisted = await requestPersistence();
  addEventListener('hashchange', route);
  // Coming back to the app on a new day: refresh Today.
  let lastDay = today();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && today() !== lastDay) { lastDay = today(); if (!location.hash.startsWith('#/run')) route(); }
  });
  route();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
}

start().catch((e) => {
  root.innerHTML = `<p style="padding:20px">Couldn’t start: ${String(e.message).replace(/</g, '&lt;')}</p>`;
  console.error(e);
});
