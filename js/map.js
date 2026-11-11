// Route map: MapLibre GL + OpenFreeMap tiles (no key, no account). Loaded only on run detail.
// Tiles come from the network; the route itself is drawn from on-device data.

const MAPLIBRE = 'https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl';
let loading;

function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${MAPLIBRE}.css`;
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = `${MAPLIBRE}.js`;
    js.onload = resolve;
    js.onerror = () => reject(new Error('Map library failed to load (offline?)'));
    document.head.appendChild(js);
  });
  return loading;
}

const dark = () => matchMedia('(prefers-color-scheme: dark)').matches;

export async function drawRoute(el, run) {
  if (!el) return;
  try {
    await loadMapLibre();
  } catch (e) {
    el.innerHTML = `<p class="small muted" style="padding:16px">${e.message}</p>`;
    return;
  }
  const pts = run.points;
  const segs = (run.segments?.length ? run.segments : [pts.map((_, i) => i)]).filter((s) => s.length > 1);
  const lines = segs.map((s) => s.map((i) => [pts[i][1], pts[i][0]]));
  const lons = pts.map((p) => p[1]), lats = pts.map((p) => p[0]);
  const map = new maplibregl.Map({
    container: el,
    style: `https://tiles.openfreemap.org/styles/${dark() ? 'dark' : 'positron'}`,
    bounds: [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
    fitBoundsOptions: { padding: { top: 30, bottom: 50, left: 30, right: 30 }, maxZoom: 16 },
    attributionControl: { compact: true },
    dragRotate: false,
    pitchWithRotate: false,
  });
  map.on('load', () => {
    map.addSource('route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: lines } } });
    map.addLayer({ id: 'casing', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': dark() ? '#000' : '#fff', 'line-width': 7 } });
    map.addLayer({ id: 'line', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#1f8a7e', 'line-width': 4 } });
    const first = pts[0], last = pts[pts.length - 1];
    const dot = (color) => { const d = document.createElement('div'); d.style.cssText = `width:14px;height:14px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3)`; return d; };
    new maplibregl.Marker({ element: dot('#1f8a7e') }).setLngLat([first[1], first[0]]).addTo(map);
    new maplibregl.Marker({ element: dot('#d0402c') }).setLngLat([last[1], last[0]]).addTo(map);
  });
}
