// Timestamp-based countdown engine. Survives iOS tab throttling because remaining time is
// derived from Date.now() rather than counted ticks.
//
// phases: [{ label, sec, kind }]  kind: 'work' | 'rest' | 'prep' | 'single'
// Callbacks: onTick({ phase, index, remaining, elapsed, total }), onPhase(phase, index), onDone()
import { cue } from './audio.js';

export function createTimer(phases, { onTick, onPhase, onDone, cues = true } = {}) {
  let index = 0;
  let phaseStart = 0;
  let paused = false;
  let pausedAt = 0;
  let handle = null;
  let lastWhole = null;
  let running = false;

  const total = phases.reduce((a, p) => a + p.sec, 0);

  function now() { return Date.now(); }
  function elapsedTotal() {
    const before = phases.slice(0, index).reduce((a, p) => a + p.sec, 0);
    return before + (paused ? (pausedAt - phaseStart) : (now() - phaseStart)) / 1000;
  }

  function tick() {
    if (!running) return;
    const p = phases[index];
    const elapsedPhase = (paused ? pausedAt - phaseStart : now() - phaseStart) / 1000;
    let remaining = Math.max(0, p.sec - elapsedPhase);
    const whole = Math.ceil(remaining);
    if (cues && whole !== lastWhole && whole > 0 && whole <= 3 && p.sec > 5) cue('tick');
    lastWhole = whole;
    onTick?.({ phase: p, index, remaining, elapsed: elapsedTotal(), total });
    if (remaining <= 0 && !paused) advance();
  }

  function advance() {
    index++;
    if (index >= phases.length) {
      stop();
      if (cues) cue('done');
      onDone?.();
      return;
    }
    phaseStart = now();
    lastWhole = null;
    const p = phases[index];
    if (cues) cue(p.kind === 'rest' ? 'rest' : 'go');
    onPhase?.(p, index);
    tick();
  }

  function start() {
    running = true;
    paused = false;
    index = 0;
    phaseStart = now();
    lastWhole = null;
    onPhase?.(phases[0], 0);
    handle = setInterval(tick, 200);
    tick();
  }
  function pause() {
    if (paused || !running) return;
    paused = true;
    pausedAt = now();
  }
  function resume() {
    if (!paused) return;
    phaseStart += now() - pausedAt;
    paused = false;
  }
  function stop() {
    running = false;
    if (handle) clearInterval(handle);
    handle = null;
  }
  function skip() { if (running) advance(); }
  function addSeconds(n) { if (running) phaseStart += n * 1000; tick(); }

  return { start, pause, resume, stop, skip, addSeconds, isPaused: () => paused, isRunning: () => running, currentIndex: () => index };
}

export function intervalPhases({ workSec, restSec, rounds, prepSec = 10 }) {
  const phases = [];
  if (prepSec > 0) phases.push({ label: 'Get ready', sec: prepSec, kind: 'prep' });
  for (let r = 1; r <= rounds; r++) {
    phases.push({ label: 'Work', sec: workSec, kind: 'work', round: r });
    if (r < rounds && restSec > 0) phases.push({ label: 'Rest', sec: restSec, kind: 'rest', round: r });
  }
  return phases;
}

export function fmtClock(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Screen wake lock while a session is running (no-op where unsupported).
let wakeLock = null;
export async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch { /* ignore */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wakeLock === null && window.__keepAwakeWanted) keepAwake(true);
});
