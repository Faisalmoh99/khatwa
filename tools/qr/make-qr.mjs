// QR for the landing page: #0F4C5C on white, logo in the centre, error correction H, 6-module quiet zone.
//   node tools/qr/make-qr.mjs [url]  → deliverables/final/qr/khatwa-qr.svg + khatwa-qr.png (2000 px)
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const QR = require('qrcode');
const { chromium } = require('@playwright/test');

const URL_ = process.argv[2] ?? 'https://khatwa-medathon.netlify.app';
const OUT = new URL('../../deliverables/final/qr/', import.meta.url).pathname;
const COLOR = '#0F4C5C', QUIET = 6, PNG = 2000;
mkdirSync(OUT, { recursive: true });

const qr = QR.create(URL_, { errorCorrectionLevel: 'H' });
const n = qr.modules.size, size = n + 2 * QUIET;
let path = '';
for (let y = 0; y < n; y++)
  for (let x = 0; x < n; x++) if (qr.modules.get(x, y)) path += `M${x + QUIET} ${y + QUIET}h1v1h-1z`;

// Logo: 22% of the code width (H recovers ~30% damage), on a white rounded pad with one module of margin.
const logo = readFileSync(new URL('../../web/public/logo.png', import.meta.url)).toString('base64');
const L = Math.round(n * 0.22), pad = 1, lx = (size - L) / 2;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${PNG}" height="${PNG}" shape-rendering="crispEdges">
<title>QR: ${URL_}</title>
<rect width="${size}" height="${size}" fill="#fff"/>
<path fill="${COLOR}" d="${path}"/>
<rect x="${lx - pad}" y="${lx - pad}" width="${L + 2 * pad}" height="${L + 2 * pad}" rx="${(L + 2 * pad) * 0.22}" fill="#fff" shape-rendering="geometricPrecision"/>
<image href="data:image/png;base64,${logo}" x="${lx}" y="${lx}" width="${L}" height="${L}"/>
</svg>
`;
writeFileSync(`${OUT}khatwa-qr.svg`, svg);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: PNG, height: PNG }, deviceScaleFactor: 1 });
await p.setContent(`<html><body style="margin:0">${svg}</body></html>`);
await p.locator('svg').screenshot({ path: `${OUT}khatwa-qr.png` });
await b.close();
console.log(`version ${qr.version}, ${n} modules + ${QUIET} quiet, logo ${L} modules → ${OUT}`);
