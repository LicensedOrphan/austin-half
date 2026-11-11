// GPS recording. The pure part (Track) is testable in Node; Recorder wires it to the browser.
// iOS stops location updates when a web app is hidden, so Recorder keeps the screen awake
// and marks a gap whenever the app goes to the background.

const R = 6371008.8; // mean Earth radius, meters
export const METERS_PER_MILE = 1609.344;

export function haversine(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const MAX_ACCURACY = 30; // meters; worse fixes are dropped
const MAX_SPEED = 8; // m/s, about a 3:20 mile; faster jumps are GPS glitches

// Accumulates distance from GPS fixes and tracks elapsed/moving time.
// Times are epoch ms. Pausing stops the clock and distance.
export class Track {
  constructor(state) {
    Object.assign(this, {
      points: [], // [lat, lon, t, alt, acc] — compact for storage
      segments: [[]], // indexes into points; a new segment starts after a pause or gap
      meters: 0,
      startedAt: null,
      elapsedMs: 0, // active (unpaused) time
      runningSince: null,
      paused: false,
      gaps: [],
      splits: [], // seconds of active time at each whole mile
      last: null,
      bridge: null,
    }, state || {});
  }

  start(now) {
    this.startedAt = this.startedAt ?? now;
    this.runningSince = now;
    this.paused = false;
  }

  pause(now) {
    if (this.paused || this.runningSince == null) return;
    this.elapsedMs += now - this.runningSince;
    this.runningSince = null;
    this.paused = true;
    this.breakSegment();
  }

  resume(now) {
    if (!this.paused) return;
    this.runningSince = now;
    this.paused = false;
  }

  elapsed(now) {
    return this.elapsedMs + (this.runningSince != null ? now - this.runningSince : 0);
  }

  breakSegment() {
    if (this.segments[this.segments.length - 1].length) this.segments.push([]);
    this.last = null;
    this.bridge = null;
  }

  // The app was in the background: no fixes arrived. Bridge the gap with a straight line
  // from the last fix to the next one, since he kept running.
  markGap(from, to) {
    const last = this.last;
    this.gaps.push([from, to]);
    this.breakSegment();
    this.bridge = last;
  }

  // Returns the meters added by this fix (0 if it was rejected).
  addFix({ lat, lon, alt = null, acc = 10, t }) {
    if (this.paused || this.runningSince == null) return 0;
    if (acc > MAX_ACCURACY) return 0;
    const p = { lat, lon, t };
    let added = 0;
    if (!this.last && this.bridge) {
      const d = haversine(this.bridge, p);
      const dt = (t - this.bridge.t) / 1000;
      if (dt > 0 && d / dt <= MAX_SPEED) added = d;
      this.bridge = null;
    } else if (this.last) {
      const d = haversine(this.last, p);
      const dt = (t - this.last.t) / 1000;
      if (dt <= 0) return 0;
      if (d / dt > MAX_SPEED) return 0;
      // Ignore jitter while standing still: movement smaller than the fix's own uncertainty.
      if (d < Math.min(acc, 8) * 0.5) return 0;
      added = d;
    }
    this.points.push([+lat.toFixed(6), +lon.toFixed(6), t, alt == null ? null : Math.round(alt * 10) / 10, Math.round(acc)]);
    this.segments[this.segments.length - 1].push(this.points.length - 1);
    this.last = p;
    const before = this.meters;
    this.meters += added;
    const mileBefore = Math.floor(before / METERS_PER_MILE);
    const mileAfter = Math.floor(this.meters / METERS_PER_MILE);
    if (mileAfter > mileBefore) {
      // Interpolate the moment the mile was crossed.
      const frac = (mileAfter * METERS_PER_MILE - before) / added;
      const crossT = this.last.t - (1 - frac) * (t - (this.points[this.points.length - 2]?.[2] ?? t));
      this.splits.push(Math.round(this.elapsedAt(crossT) / 1000));
    }
    return added;
  }

  elapsedAt(t) {
    return this.elapsedMs + (this.runningSince != null ? t - this.runningSince : 0);
  }

  miles() {
    return this.meters / METERS_PER_MILE;
  }

  // Pace over the last `windowSec` of fixes, sec/mile. Smooths GPS noise.
  currentPace(windowSec = 30) {
    const pts = this.points;
    if (pts.length < 2) return null;
    const end = pts[pts.length - 1];
    let d = 0;
    let i = pts.length - 1;
    while (i > 0 && end[2] - pts[i - 1][2] <= windowSec * 1000) {
      d += haversine({ lat: pts[i - 1][0], lon: pts[i - 1][1] }, { lat: pts[i][0], lon: pts[i][1] });
      i--;
    }
    const dt = (end[2] - pts[i][2]) / 1000;
    if (dt < 8 || d < 10) return null;
    return dt / (d / METERS_PER_MILE);
  }

  elevationGain() {
    let gain = 0;
    let ref = null;
    for (const p of this.points) {
      if (p[3] == null) continue;
      if (ref == null) ref = p[3];
      // 3 m hysteresis keeps GPS altitude noise out of the total.
      if (p[3] - ref > 3) { gain += p[3] - ref; ref = p[3]; } else if (ref - p[3] > 3) ref = p[3];
    }
    return gain;
  }

  toJSON() {
    const { last, bridge, ...rest } = this;
    return rest;
  }
}

// ---- Browser side ---------------------------------------------------------

export class Recorder {
  constructor({ onFix, onStatus } = {}) {
    this.track = new Track();
    this.onFix = onFix || (() => {});
    this.onStatus = onStatus || (() => {});
    this.watchId = null;
    this.wakeLock = null;
    this.hiddenAt = null;
    this.lastFix = null;
    this.onVisibility = this.onVisibility.bind(this);
  }

  static restore(state, handlers) {
    const r = new Recorder(handlers);
    r.track = new Track(state);
    return r;
  }

  async start() {
    this.track.start(Date.now());
    await this.lockScreen();
    this.watch();
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  watch() {
    if (this.watchId != null || !('geolocation' in navigator)) return;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const c = pos.coords;
        this.lastFix = { lat: c.latitude, lon: c.longitude, alt: c.altitude, acc: c.accuracy, t: pos.timestamp };
        this.track.addFix(this.lastFix);
        this.onFix(this.lastFix);
      },
      (err) => this.onStatus({ gpsError: err.message, code: err.code }),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 },
    );
  }

  async lockScreen() {
    try {
      if ('wakeLock' in navigator && !this.wakeLock) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => { this.wakeLock = null; this.onStatus({ wakeLock: false }); });
        this.onStatus({ wakeLock: true });
      }
    } catch (e) {
      this.onStatus({ wakeLock: false, wakeLockError: e.message });
    }
  }

  onVisibility() {
    const now = Date.now();
    if (document.hidden) {
      this.hiddenAt = now;
    } else {
      if (this.hiddenAt && now - this.hiddenAt > 5000 && !this.track.paused) {
        this.track.markGap(this.hiddenAt, now);
        this.onStatus({ gap: (now - this.hiddenAt) / 1000 });
      }
      this.hiddenAt = null;
      this.lockScreen();
      // iOS sometimes silently drops the watch after backgrounding; re-arm it.
      if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.watch();
    }
  }

  pause() { this.track.pause(Date.now()); }
  resume() { this.track.resume(Date.now()); }

  async stop() {
    this.track.pause(Date.now());
    if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
    document.removeEventListener('visibilitychange', this.onVisibility);
    try { await this.wakeLock?.release(); } catch {}
    this.wakeLock = null;
  }
}
