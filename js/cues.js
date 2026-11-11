// Voice and beep cues. iOS only allows audio after a tap, so call unlock() from a button handler.
// Speech briefly lowers music volume (iOS behavior we can't change); beeps mix over music.

let ctx = null;
let voice = null;
export const cueSettings = { voice: true, beeps: true };

export function unlock() {
  try {
    // 'ambient' lets beeps play over Spotify/Apple Music instead of pausing them.
    if (navigator.audioSession) navigator.audioSession.type = 'ambient';
  } catch {}
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  ctx?.resume?.();
  if ('speechSynthesis' in window) {
    // A silent utterance inside the tap primes speech for later, timer-driven cues.
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }
}

function pickVoice() {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang?.startsWith('en'));
  voice = voices.find((v) => /Samantha|Ava|Evan|Nathan|Zoe/i.test(v.name) && /enhanced|premium/i.test(v.name))
    || voices.find((v) => v.lang === 'en-US' && v.localService)
    || voices[0] || null;
}

export function say(text) {
  if (!cueSettings.voice || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.rate = 1.02;
  speechSynthesis.speak(u);
}

function tone(freq, start, dur, gain = 0.25) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(start);
  o.stop(start + dur + 0.02);
}

// 'tick' = countdown, 'go' = step change, 'done' = workout finished
export function beep(kind = 'go') {
  if (!cueSettings.beeps || !ctx) return;
  const t = ctx.currentTime + 0.02;
  if (kind === 'tick') tone(880, t, 0.12, 0.18);
  else if (kind === 'go') { tone(660, t, 0.14); tone(990, t + 0.16, 0.22); }
  else if (kind === 'done') { tone(660, t, 0.15); tone(880, t + 0.17, 0.15); tone(1320, t + 0.34, 0.35); }
}
