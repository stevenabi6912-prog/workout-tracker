import { h, svgIcon, icons } from './dom.js';
import { createTimer, fmtClock } from './timer.js';

// A single rest-timer bar pinned above the tab bar. Only one at a time.
let current = null;

export function startRestTimer(sec, { onDone } = {}) {
  stopRestTimer();
  const time = h('div.time', fmtClock(sec));
  const fill = h('div');
  const bar = h('div.timerbar', { role: 'timer' },
    h('div', h('div.small', { style: { opacity: 0.7 } }, 'Rest'), time),
    h('button.btn.sm', { onclick: () => timer.addSeconds(-15) }, '−15'),
    h('button.btn.sm', { onclick: () => timer.addSeconds(15) }, '+15'),
    h('button.btn.sm', { onclick: () => stopRestTimer(), 'aria-label': 'Skip rest' }, 'Skip'),
    h('div.bar', fill),
  );
  const timer = createTimer([{ label: 'Rest', sec, kind: 'rest' }], {
    onTick: ({ remaining, phase }) => {
      time.textContent = fmtClock(remaining);
      fill.style.width = `${Math.max(0, Math.min(100, (1 - remaining / phase.sec) * 100))}%`;
    },
    onDone: () => { stopRestTimer(); onDone?.(); },
  });
  document.body.append(bar);
  current = { bar, timer };
  timer.start();
  return timer;
}

export function stopRestTimer() {
  if (!current) return;
  current.timer.stop();
  current.bar.remove();
  current = null;
}
