import { h, clear, svgIcon, icons } from '../ui/dom.js';
import { confirm, toast, header } from '../ui/sheet.js';
import { createTimer, intervalPhases, fmtClock, keepAwake } from '../ui/timer.js';
import { unlockAudio } from '../ui/audio.js';
import * as repo from '../db/repo.js';
import { today, relativeDay } from '../domain/dates.js';
import { toDisplayDistance, fromDisplayDistance } from '../domain/units.js';

export const CARDIO_TYPES = ['treadmill', 'bike', 'rower', 'elliptical', 'run', 'other'];
const INTENSITY = ['easy', 'moderate', 'hard'];

export async function render(container, ctx) {
  const { profile, navigate, query } = ctx;
  const dunits = profile.units.distance;
  let entry = ctx.params.id ? await repo.getCardioEntry(ctx.params.id) : null;
  const editing = !!entry;
  if (!entry) {
    const type = CARDIO_TYPES.includes(query.type) ? query.type : 'treadmill';
    const recent = (await repo.getCardio(profile.id)).filter((c) => c.type === type).sort((a, b) => b.date.localeCompare(a.date))[0];
    entry = {
      id: repo.uid(), profileId: profile.id, date: query.date || today(), at: new Date().toISOString(),
      type, durationSec: query.minutes ? Number(query.minutes) * 60 : recent?.durationSec || 0,
      distanceMi: null, intensity: recent?.intensity || 'moderate',
      incline: recent?.incline ?? null, resistance: recent?.resistance ?? null, avgHr: null, notes: '',
      intervals: query.work ? { workSec: +query.work, restSec: +query.rest || 0, rounds: +query.rounds || 1 } : recent?.intervals ? { ...recent.intervals } : null,
      workoutId: query.workout || null, source: 'app', externalId: null,
    };
  }

  const form = h('div.stack');
  container.append(
    header(editing ? 'Edit cardio' : 'Log cardio', { onBack: goBack }),
    h('div.small.muted', { style: { marginBottom: '12px' } }, relativeDay(entry.date) + (entry.workoutId ? ' · linked to workout' : '')),
    form,
  );
  draw();

  if (query.start === '1' && entry.intervals) setTimeout(() => runIntervalTimer(), 100);

  function goBack() { navigate(entry.workoutId ? `/workout/${entry.workoutId}` : editing ? `/history?date=${entry.date}` : '/'); }

  function draw() {
    clear(form);
    const minutes = Math.floor((entry.durationSec || 0) / 60);
    const seconds = Math.round((entry.durationSec || 0) % 60);
    const min = numInput(minutes, 'numeric', (v) => { entry.durationSec = v * 60 + (entry.durationSec % 60); });
    const sec = numInput(seconds, 'numeric', (v) => { entry.durationSec = Math.floor(entry.durationSec / 60) * 60 + Math.min(59, v); });
    const dist = numInput(entry.distanceMi != null ? round2(toDisplayDistance(entry.distanceMi, dunits)) : '', 'decimal', (v, raw) => { entry.distanceMi = raw === '' ? null : fromDisplayDistance(v, dunits); });
    const hr = numInput(entry.avgHr ?? '', 'numeric', (v, raw) => { entry.avgHr = raw === '' ? null : v; });
    const incline = numInput(entry.incline ?? '', 'decimal', (v, raw) => { entry.incline = raw === '' ? null : v; });
    const resistance = numInput(entry.resistance ?? '', 'decimal', (v, raw) => { entry.resistance = raw === '' ? null : v; });
    const notes = h('textarea.textarea', { value: entry.notes || '', placeholder: 'Notes (optional)', oninput: (e) => { entry.notes = e.target.value; } });
    const date = h('input.input', { type: 'date', value: entry.date, onchange: (e) => { if (e.target.value) entry.date = e.target.value; } });

    const showIncline = entry.type === 'treadmill' || entry.type === 'run';
    const showResistance = ['bike', 'rower', 'elliptical'].includes(entry.type);

    form.append(
      h('div.field', h('label', 'Type'), h('div.chips', CARDIO_TYPES.map((t) => h('button.chip', { class: entry.type === t ? 'on' : '', onclick: () => { entry.type = t; draw(); } }, cap(t))))),
      h('div.grid-2',
        h('div.field', h('label', 'Minutes'), min),
        h('div.field', h('label', 'Seconds'), sec),
      ),
      h('div.grid-2',
        h('div.field', h('label', `Distance (${dunits})`), dist),
        h('div.field', h('label', 'Avg heart rate'), hr),
      ),
      h('div.field', h('label', 'Intensity'), h('div.chips', INTENSITY.map((t) => h('button.chip', { class: entry.intensity === t ? 'on' : '', onclick: () => { entry.intensity = t; draw(); } }, cap(t))))),
      showIncline || showResistance ? h('div.grid-2',
        showIncline ? h('div.field', h('label', 'Incline %'), incline) : h('div'),
        showResistance ? h('div.field', h('label', 'Resistance / level'), resistance) : h('div'),
      ) : null,
      intervalsBlock(),
      h('div.field', h('label', 'Date'), date),
      h('div.field', h('label', 'Notes'), notes),
      h('div.stack', { style: { marginTop: '8px' } },
        h('button.btn.primary.block', { onclick: saveEntry }, editing ? 'Save changes' : 'Save cardio'),
        editing ? h('button.btn.danger.block', { onclick: async () => { if (await confirm('Delete this cardio entry?', { okLabel: 'Delete', danger: true })) { await repo.deleteCardio(entry.id); toast('Deleted'); goBack(); } } }, 'Delete') : null,
      ),
    );
  }

  function intervalsBlock() {
    const on = !!entry.intervals;
    const box = h('div.card.pad-0');
    const toggle = h('button.list-item', { onclick: () => { entry.intervals = on ? null : { workSec: 30, restSec: 60, rounds: 8 }; draw(); } },
      h('div.body', h('div.title', 'Intervals'), h('div.sub', on ? `${entry.intervals.rounds} rounds · ${entry.intervals.workSec}s work / ${entry.intervals.restSec}s rest` : 'Off · tap to add work/rest rounds')),
      h('span.badge', { class: on ? 'accent' : '' }, on ? 'On' : 'Off'),
    );
    box.append(toggle);
    if (on) {
      const iv = entry.intervals;
      const work = numInput(iv.workSec, 'numeric', (v) => { iv.workSec = Math.max(5, v); });
      const rest = numInput(iv.restSec, 'numeric', (v) => { iv.restSec = Math.max(0, v); });
      const rounds = numInput(iv.rounds, 'numeric', (v) => { iv.rounds = Math.max(1, v); });
      box.append(h('div', { style: { padding: '0 14px 14px' } },
        h('div.grid-3',
          h('div.field', h('label', 'Work (s)'), work),
          h('div.field', h('label', 'Rest (s)'), rest),
          h('div.field', h('label', 'Rounds'), rounds),
        ),
        h('button.btn.block', { style: { marginTop: '12px' }, onclick: () => { unlockAudio(); runIntervalTimer(); } }, svgIcon(icons.timer, 20), 'Start interval timer'),
        h('p.note', { style: { marginTop: '8px' } }, 'Audio and vibration cues at each change. iPhone: keep the screen on, and silent mode still plays cues while the app is open.'),
      ));
    }
    return box;
  }

  function runIntervalTimer() {
    const iv = entry.intervals;
    if (!iv) return;
    const phases = intervalPhases(iv);
    const totalWork = phases.filter((p) => p.kind !== 'prep').reduce((a, p) => a + p.sec, 0);
    const phaseEl = h('div.phase', 'Get ready');
    const big = h('div.big', fmtClock(phases[0].sec));
    const round = h('div.round', '');
    const totalEl = h('div.small', { style: { opacity: 0.7, marginTop: '8px' } }, '');
    const pauseBtn = h('button.btn', { onclick: () => { if (timer.isPaused()) { timer.resume(); pauseBtn.textContent = 'Pause'; } else { timer.pause(); pauseBtn.textContent = 'Resume'; } } }, 'Pause');
    const overlay = h('div.fullscreen-timer', { role: 'timer' },
      phaseEl, big, round, totalEl,
      h('div.controls',
        pauseBtn,
        h('button.btn', { onclick: () => timer.skip() }, 'Skip'),
        h('button.btn', { onclick: () => end(false) }, 'End'),
      ),
    );
    document.body.append(overlay);
    window.__keepAwakeWanted = true;
    keepAwake(true);

    const timer = createTimer(phases, {
      onPhase: (p) => {
        overlay.className = 'fullscreen-timer ' + (p.kind === 'work' ? 'work' : p.kind === 'rest' ? 'rest' : '');
        phaseEl.textContent = p.label;
        round.textContent = p.round ? `Round ${p.round} of ${iv.rounds}` : '';
      },
      onTick: ({ remaining, elapsed, total }) => {
        big.textContent = fmtClock(remaining);
        totalEl.textContent = `${fmtClock(Math.max(0, total - elapsed))} left`;
      },
      onDone: () => {
        overlay.className = 'fullscreen-timer';
        phaseEl.textContent = 'Complete';
        big.textContent = fmtClock(0);
        round.textContent = `${iv.rounds} rounds · ${fmtClock(totalWork)}`;
        overlay.querySelector('.controls').replaceChildren(h('button.btn.primary', { onclick: () => end(true) }, 'Done'));
      },
    });
    timer.start();

    function end(completed) {
      timer.stop();
      overlay.remove();
      window.__keepAwakeWanted = false;
      keepAwake(false);
      if (completed) {
        entry.durationSec = totalWork;
        toast('Intervals complete. Duration filled in.');
      }
      draw();
    }
  }

  async function saveEntry() {
    if (!entry.durationSec && !entry.distanceMi) {
      toast('Enter a duration or distance');
      return;
    }
    await repo.saveCardio(entry);
    toast(editing ? 'Saved' : 'Cardio logged');
    goBack();
  }
}

function numInput(value, inputmode, onChange) {
  return h('input.input.num', {
    type: 'text', inputmode, value: value === null || value === undefined ? '' : String(value), placeholder: '—',
    onfocus: (e) => e.target.select(),
    onchange: (e) => { const raw = e.target.value.trim(); const v = Number(raw); onChange(Number.isFinite(v) ? v : 0, raw); },
  });
}
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const round2 = (v) => Math.round(v * 100) / 100;
