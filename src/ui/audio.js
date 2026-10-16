// Audio cues with the iOS unlock dance: an AudioContext has to be created/resumed inside
// a user gesture before it will ever make a sound. We also play a silent buffer so that
// later programmatic beeps work while the phone is in silent mode with the app open.
let ctx = null;
let unlocked = false;

export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    unlocked = true;
  } catch { /* no audio */ }
}

export function beep({ freq = 880, ms = 150, volume = 0.5, type = 'sine' } = {}) {
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain).connect(ctx.destination);
    const t = ctx.currentTime;
    osc.start(t);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000);
    osc.stop(t + ms / 1000 + 0.02);
  } catch { /* ignore */ }
}

export function cue(kind) {
  // kind: 'tick' (3-2-1), 'go', 'rest', 'done'
  if (kind === 'tick') { beep({ freq: 880, ms: 120 }); vibrate(60); }
  else if (kind === 'go') { beep({ freq: 1320, ms: 350 }); vibrate([120, 60, 120]); }
  else if (kind === 'rest') { beep({ freq: 660, ms: 350 }); vibrate(200); }
  else if (kind === 'done') { beep({ freq: 1100, ms: 200 }); setTimeout(() => beep({ freq: 1320, ms: 200 }), 220); setTimeout(() => beep({ freq: 1760, ms: 400 }), 440); vibrate([150, 80, 150, 80, 300]); }
}

export function vibrate(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch { /* unsupported on iOS Safari */ }
}

export const audioUnlocked = () => unlocked;
