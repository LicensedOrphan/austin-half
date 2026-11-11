// Pull-to-refresh. Installed home-screen apps on iOS have no native one,
// so pulling down from the top of a page reloads the app (picking up new code).

const THRESHOLD = 70; // px of (damped) pull needed to trigger
const MAX = 110;

export function installPullToRefresh({ enabled = () => true, onRefresh = () => location.reload() } = {}) {
  const ind = document.createElement('div');
  ind.className = 'ptr';
  ind.setAttribute('aria-hidden', 'true');
  ind.innerHTML = '<span class="ptr-arrow">↓</span><span class="ptr-label">Pull to refresh</span>';
  document.body.appendChild(ind);
  const label = ind.querySelector('.ptr-label');

  let startY = null, pull = 0, busy = false;

  const set = (px, animate) => {
    ind.style.transition = animate ? 'transform 0.2s ease, opacity 0.2s ease' : 'none';
    ind.style.transform = `translate(-50%, ${px - 60}px)`;
    ind.style.opacity = px > 4 ? String(Math.min(1, px / THRESHOLD)) : '0';
    ind.classList.toggle('ready', px >= THRESHOLD);
    if (!busy) label.textContent = px >= THRESHOLD ? 'Release to refresh' : 'Pull to refresh';
  };
  set(0);

  const blocked = (t) => !enabled() || busy || (window.scrollY || document.documentElement.scrollTop) > 0
    || t.closest?.('.sheet-bg, .runscreen, .player, .map, input, textarea, select');

  addEventListener('touchstart', (e) => {
    startY = e.touches.length === 1 && !blocked(e.target) ? e.touches[0].clientY : null;
    pull = 0;
  }, { passive: true });

  addEventListener('touchmove', (e) => {
    if (startY == null) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0 || window.scrollY > 0) { if (pull) set(0); pull = 0; return; }
    pull = Math.min(MAX, dy * 0.5); // resistance
    set(pull);
  }, { passive: true });

  const end = () => {
    if (startY == null) return;
    startY = null;
    if (pull >= THRESHOLD) {
      busy = true;
      label.textContent = 'Refreshing…';
      ind.classList.add('busy');
      set(THRESHOLD, true);
      onRefresh();
    } else set(0, true);
    pull = 0;
  };
  addEventListener('touchend', end, { passive: true });
  addEventListener('touchcancel', end, { passive: true });
}
