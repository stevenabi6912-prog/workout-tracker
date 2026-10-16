import { h, clear } from '../ui/dom.js';
import { toast, header } from '../ui/sheet.js';
import * as repo from '../db/repo.js';
import { parseHealthFile, commitHealthImport } from '../import/health-import.js';

export async function render(container, ctx) {
  const { profile, navigate } = ctx;
  const last = await repo.getMeta(`lastHealthImport:${profile.id}`);
  const status = h('div');
  const fileInput = h('input', { type: 'file', accept: '.zip,.xml,application/zip,text/xml,application/xml', style: { display: 'none' }, onchange: (e) => { const f = e.target.files[0]; if (f) run(f); e.target.value = ''; } });

  container.append(
    header('Apple Health import', { onBack: () => navigate('/more') }),
    h('div.callout', { style: { marginBottom: '12px' } }, h('strong', 'Manual import, not live sync. '), `Each import reads a Health export file and adds anything new to ${profile.name}'s history. Re-importing the same export is safe: duplicates are skipped.`),
    h('div.card', h('div.stack',
      h('div.card-title', 'How to export from iPhone'),
      h('ol', { style: { margin: 0, paddingLeft: '20px', lineHeight: 1.6 } },
        h('li', 'Open the Health app, tap your picture (top right).'),
        h('li', 'Tap "Export All Health Data", then Export.'),
        h('li', 'Save export.zip to Files (or AirDrop it to this device).'),
        h('li', 'Come back here and choose the file below.'),
      ),
      h('p.note', 'The zip can be hundreds of MB. It is read in chunks on this device and nothing is uploaded anywhere. Large exports take a minute or two.'),
      h('button.btn.primary.block', { onclick: () => fileInput.click() }, 'Choose export.zip or export.xml'),
      fileInput,
    )),
    h('div.card', { style: { marginTop: '12px' } }, h('div.card-title', 'What gets imported'), h('ul.small.muted', { style: { marginTop: '6px', lineHeight: 1.6 } },
      h('li', 'Body weight (BodyMass) → weigh-ins'),
      h('li', 'Workouts: running, cycling, rowing, elliptical, walking, etc. → cardio entries with duration, distance, and average heart rate'),
      h('li', 'Strength workouts → history entries (no sets; Health does not record them)'),
      h('li', 'Heart rate → daily resting/average/min/max summaries'),
    )),
    status,
  );
  if (last) status.append(h('p.note', { style: { marginTop: '12px' } }, `Last import ${new Date(last.at).toLocaleString()}: ${last.bodyweight} weigh-ins, ${last.cardio} cardio, ${last.workouts} strength workouts, ${last.hrDays} heart-rate days added, ${last.skippedDuplicates} duplicates skipped.`));

  async function run(file) {
    clear(status);
    const bar = h('div.progress', h('div', { style: { width: '0%' } }));
    const text = h('div.small.muted', 'Starting…');
    status.append(h('div.card', { style: { marginTop: '12px' } }, h('div.card-title', `Importing ${file.name}`), h('div.small.muted', `${(file.size / 1048576).toFixed(1)} MB`), h('div', { style: { margin: '10px 0' } }, bar), text));
    const t0 = Date.now();
    try {
      const { result, totals } = await parseHealthFile(file, profile.id, {
        onProgress: ({ bytesRead, total, phase }) => {
          const pct = total ? Math.min(100, (bytesRead / total) * 100) : 0;
          bar.firstChild.style.width = `${pct}%`;
          text.textContent = `${phase === 'reading' ? 'Reading' : 'Parsing'}… ${(bytesRead / 1048576).toFixed(0)} / ${(total / 1048576).toFixed(0)} MB`;
        },
      });
      bar.firstChild.style.width = '100%';
      text.textContent = 'Saving…';
      const stats = await commitHealthImport(result, profile.id);
      const secs = ((Date.now() - t0) / 1000).toFixed(0);
      clear(status);
      status.append(h('div.card', { style: { marginTop: '12px' } },
        h('div.card-title', 'Import complete'),
        h('div.stats', { style: { marginTop: '8px' } },
          h('div.stat', h('div.k', 'Weigh-ins'), h('div.v', String(stats.bodyweight))),
          h('div.stat', h('div.k', 'Cardio'), h('div.v', String(stats.cardio))),
          h('div.stat', h('div.k', 'Strength'), h('div.v', String(stats.workouts))),
          h('div.stat', h('div.k', 'HR days'), h('div.v', String(stats.hrDays))),
        ),
        h('p.note', { style: { marginTop: '8px' } }, `${stats.skippedDuplicates} duplicates skipped. Scanned ${totals.records.toLocaleString()} records and ${totals.workouts.toLocaleString()} workouts in ${secs}s.`),
        h('div.grid-2', { style: { marginTop: '10px' } }, h('button.btn', { onclick: () => navigate('/weight') }, 'See weight'), h('button.btn', { onclick: () => navigate('/history') }, 'See history')),
      ));
      toast('Import complete');
    } catch (err) {
      clear(status);
      status.append(h('div.callout.warn', { style: { marginTop: '12px' } }, h('strong', 'Import failed. '), err.message || String(err)));
    }
  }
}
