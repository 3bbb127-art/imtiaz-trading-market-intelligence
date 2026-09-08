import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(p));
    else out.push(p);
  }
  return out;
}

const files = await walk('dist');
const jsFiles = files.filter((f) => /\.js$/.test(f));
const offenders = [];
for (const file of jsFiles) {
  const text = await readFile(file, 'utf8');
  if (/(?:^|[;{}])\s*ts\s*;(?=\s*(?:const|let|var)\s)/.test(text)) offenders.push(file);
}
if (offenders.length) {
  console.error('Build verification failed: unresolved standalone `ts;` found in JS bundle:', offenders.join(', '));
  process.exit(1);
}
console.log(`Build verification passed: scanned ${jsFiles.length} JS bundle(s).`);
