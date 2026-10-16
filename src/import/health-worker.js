// Web Worker: streams export.zip (or export.xml) and maps it to app records without
// loading the whole file into memory.
import { Unzip, UnzipInflate } from 'fflate';
import { createHealthScanner } from './health-parse.js';
import { createHealthMapper } from './health-map.js';

self.onmessage = async (e) => {
  const { file, profileId } = e.data;
  try {
    const mapper = createHealthMapper(profileId);
    const scanner = createHealthScanner({ onRecord: mapper.onRecord, onWorkout: mapper.onWorkout });
    const decoder = new TextDecoder('utf-8');
    let bytesRead = 0;
    let lastReport = 0;
    const report = (phase) => {
      const now = Date.now();
      if (now - lastReport < 150) return;
      lastReport = now;
      self.postMessage({ type: 'progress', phase, bytesRead, total: file.size });
    };

    const isZip = /\.zip$/i.test(file.name) || file.type === 'application/zip';
    if (isZip) {
      let found = false;
      let xmlDone;
      const xmlPromise = new Promise((resolve) => { xmlDone = resolve; });
      const unzip = new Unzip();
      unzip.register(UnzipInflate);
      unzip.onfile = (f) => {
        // Entry name is usually "apple_health_export/export.xml"; skip the CDA and routes.
        if (!/(^|\/)export\.xml$/i.test(f.name)) return;
        found = true;
        f.ondata = (err, chunk, final) => {
          if (err) { self.postMessage({ type: 'error', message: 'Could not decompress export.xml: ' + err.message }); return; }
          scanner.push(decoder.decode(chunk, { stream: !final }));
          report('parsing');
          if (final) xmlDone();
        };
        f.start();
      };
      const reader = file.stream().getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) { unzip.push(new Uint8Array(0), true); break; }
        bytesRead += value.byteLength;
        unzip.push(value, false);
        report('reading');
      }
      if (!found) { self.postMessage({ type: 'error', message: 'No export.xml found inside the zip. Share the whole export.zip from the Health app.' }); return; }
      await xmlPromise;
    } else {
      const reader = file.stream().getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) { scanner.push(decoder.decode()); break; }
        bytesRead += value.byteLength;
        scanner.push(decoder.decode(value, { stream: true }));
        report('parsing');
      }
    }
    const totals = scanner.end();
    const result = mapper.finish();
    self.postMessage({ type: 'done', result, totals });
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || String(err) });
  }
};
