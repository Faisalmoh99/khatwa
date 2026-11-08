/**
 * Copies the legacy static pages into the build so their URLs keep working on the same domain:
 *   /sim/  /dev/live.html  /story/  /js/*  /logo.png   (unchanged paths)
 *   /legacy/               (the old single-file prototype, app/index.html)
 * Source files in app/ are never modified.
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..', '..', 'app');
const dist = join(here, '..', 'dist');

if (!existsSync(dist)) {
  console.error('dist/ not found. Run vite build first.');
  process.exit(1);
}

const copies = [
  ['sim', 'sim'],
  ['dev', 'dev'],
  ['story', 'story'],
  ['js', 'js'],
  ['logo.png', 'logo.png'],
  ['index.html', 'legacy/index.html'],
  ['logo.png', 'legacy/logo.png'],
];

for (const [from, to] of copies) {
  const src = join(app, from);
  const dst = join(dist, to);
  if (!existsSync(src)) {
    console.error(`missing legacy file: app/${from}`);
    process.exit(1);
  }
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst, { recursive: true });
  console.log(`legacy: app/${from} -> dist/${to}`);
}
