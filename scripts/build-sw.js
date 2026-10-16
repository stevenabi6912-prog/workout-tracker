// Post-build: turn src/sw.js into dist/sw.js with the list of built files to precache.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = 'dist';
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(relative(dist, p).split('\\').join('/'));
  }
}
walk(dist);

const precache = files.filter((f) => f !== 'sw.js' && !f.endsWith('.map'));
const version = Date.now().toString(36);
const template = readFileSync('src/sw.js', 'utf8');
const out = template
  .replace('__VERSION__', version)
  .replace('__PRECACHE__', JSON.stringify(precache));
writeFileSync(join(dist, 'sw.js'), out);
console.log(`sw.js written: ${precache.length} files precached, version ${version}`);
