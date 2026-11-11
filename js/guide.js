// Walks through a workout's steps as time and distance accumulate.
// Pure logic: feed it update({ sec, mi, pace }) and it returns the cues to play.

import { EFFORTS } from './plan.js';
import { fmtPace } from './paces.js';

const spokenPace = (sec) => {
  const [m, s] = fmtPace(sec).split(':');
  return s === '00' ? `${m} minutes` : `${m} ${s}`;
};

const spokenDistance = (mi) => {
  if (Math.abs(mi - 0.497) < 0.01) return '800 meters';
  if (Math.abs(mi - 0.249) < 0.01) return '400 meters';
  if (Math.abs(mi - 3.107) < 0.01) return '5K';
  return mi === 1 ? '1 mile' : `${+mi.toFixed(2)} miles`;
};

const spokenDuration = (sec) => (sec >= 60 && sec % 60 === 0 ? `${sec / 60} minute${sec === 60 ? '' : 's'}` : `${sec} seconds`);

export class Guide {
  constructor(steps, { paces = null, state = null } = {}) {
    this.steps = steps;
    this.paces = paces; // { easy:{slow,fast}, ... } or null before the time trial
    Object.assign(this, { index: 0, stepStartSec: 0, stepStartMi: 0, done: steps.length === 0, lastMile: 0, lastTick: null, fastSince: null, lastNudge: -1e9, started: false }, state || {});
  }

  get step() {
    return this.steps[this.index] || null;
  }

  // Progress in the current step: { frac, remainingSec?, remainingMi? }
  progress(sec, mi) {
    const s = this.step;
    if (!s) return null;
    if (s.duration) {
      const left = s.duration - (sec - this.stepStartSec);
      return { frac: Math.min(1, 1 - left / s.duration), remainingSec: Math.max(0, left) };
    }
    const left = s.distance - (mi - this.stepStartMi);
    return { frac: Math.min(1, 1 - left / s.distance), remainingMi: Math.max(0, left) };
  }

  target(step = this.step) {
    if (!step || !this.paces) return null;
    return this.paces[step.effort] || null;
  }

  announce(step) {
    const parts = [];
    if (step.reps) {
      const name = step.kind === 'run' ? EFFORTS[step.effort].label.replace(/s$/, '') : 'Recovery';
      parts.push(step.kind === 'run' ? `${name} ${step.rep} of ${step.reps}.` : `${name}.`);
    }
    parts.push(step.duration ? `${spokenDuration(step.duration)}, ${describe(step)}.` : `${spokenDistance(step.distance)}, ${describe(step)}.`);
    // Easy runs are coached by feel; pace targets only for the harder efforts.
    const t = this.target(step);
    if (step.effort === 'easy' && step.kind === 'run') parts.push('You should be able to talk in full sentences.');
    else if (t && step.kind === 'run' && !['stride', 'hill', 'race'].includes(step.effort)) {
      parts.push(`Target ${spokenPace((t.fast + t.slow) / 2)} per mile.`);
    }
    return parts.join(' ');
  }

  begin() {
    this.started = true;
    if (this.done) return [{ say: 'Run started.' }];
    return [{ beep: 'go', say: `Let's go. ${this.announce(this.step)}` }];
  }

  skip(sec, mi) {
    return this.advance(sec, mi);
  }

  advance(sec, mi) {
    this.index += 1;
    this.stepStartSec = sec;
    this.stepStartMi = mi;
    this.lastTick = null;
    this.fastSince = null;
    if (this.index >= this.steps.length) {
      this.done = true;
      return [{ beep: 'done', say: 'Workout complete. Nice work. Walk it out, then stretch.' }];
    }
    return [{ beep: 'go', say: this.announce(this.step) }];
  }

  update({ sec, mi, pace }) {
    const cues = [];
    // Whole-mile split announcements.
    const mile = Math.floor(mi);
    if (mile > this.lastMile) {
      this.lastMile = mile;
      if (this.splitSec != null) cues.push({ say: `Mile ${mile}. ${spokenPace(sec - this.splitSec)}.` });
      this.splitSec = sec;
    } else if (this.splitSec == null) this.splitSec = 0;

    if (this.done) return cues;
    const s = this.step;
    const p = this.progress(sec, mi);

    if (s.duration && p.remainingSec <= 3.2 && p.remainingSec > 0) {
      const n = Math.ceil(p.remainingSec);
      if (n !== this.lastTick) { this.lastTick = n; cues.push({ beep: 'tick' }); }
    }
    if (s.distance >= 2 && !this.halfwayAnnounced && p.frac >= 0.5) {
      this.halfwayAnnounced = true;
      cues.push({ say: `Halfway through this segment. ${spokenDistance(+p.remainingMi.toFixed(1))} to go.` });
    }
    if (p.frac >= 1) {
      this.halfwayAnnounced = false;
      return cues.concat(this.advance(sec, mi));
    }

    // Keep easy days easy: nudge if pace is well under the easy range for a sustained stretch.
    const t = this.target(s);
    if (s.effort === 'easy' && t && pace) {
      if (pace < t.fast - 15) {
        this.fastSince ??= sec;
        if (sec - this.fastSince > 90 && sec - this.lastNudge > 300) {
          this.lastNudge = sec;
          cues.push({ say: 'Ease off a little. This one should feel easy.' });
        }
      } else this.fastSince = null;
    }
    return cues;
  }

  toJSON() {
    const { steps, paces, ...state } = this;
    return state;
  }
}

function describe(step) {
  switch (step.effort) {
    case 'easy': return step.phase === 'warmup' ? 'easy warm-up' : step.phase === 'cooldown' ? 'easy cool-down' : 'easy';
    case 'stride': return 'quick and smooth, not a sprint';
    case 'hill': return 'strong push uphill';
    case 'tempo': return 'comfortably hard';
    case 'hmp': return 'half-marathon pace';
    case 'interval': return '5K effort';
    case 'race': return 'even effort, save something for the last half mile';
    case 'recovery': return step.kind === 'walk' ? 'walk and recover' : 'easy jog';
    default: return step.effort;
  }
}
