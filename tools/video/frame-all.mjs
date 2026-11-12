// Frames every raw screenshot in the iPhone-style frame → deliverables/all-screens/NN-name.png (transparent).
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { framedSize, phoneHtml } from './iphone.mjs';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const RAW = new URL('./allshots-raw/', import.meta.url).pathname;
const OUT = new URL('../../deliverables/all-screens/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const K = 3; // 3 px per point: the app screenshots are 1290 px wide
const PAD = 90;
const { w, h } = framedSize(K, PAD);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: Math.round(w), height: Math.round(h) } });
for (const item of JSON.parse(readFileSync(`${RAW}manifest.json`, 'utf8'))) {
  const img = `data:image/png;base64,${readFileSync(RAW + item.raw).toString('base64')}`;
  // Status bar in the colour of the app's top edge (the honesty banner), light or dark text to match.
  await p.setContent(`<img id=i src="${img}">`);
  const [r, g, bl] = await p.evaluate(async () => {
    const im = document.getElementById('i');
    await im.decode();
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 4;
    const x = c.getContext('2d');
    x.drawImage(im, 30, 2, 4, 4, 0, 0, 4, 4);
    return [...x.getImageData(1, 1, 1, 1).data];
  });
  const dark = 0.299 * r + 0.587 * g + 0.114 * bl < 140;
  const screen = `<img src="${img}" style="display:block;width:100%;height:100%">`;
  await p.setContent(
    `<!doctype html><html><head><style>*{margin:0}html,body{background:transparent}</style></head><body>${phoneHtml({
      k: K,
      screen,
      statusBg: `rgb(${r},${g},${bl})`,
      statusFg: dark ? '#fff' : '#000',
      pad: PAD,
    })}</body></html>`,
  );
  await p.waitForTimeout(80);
  await p.screenshot({ path: OUT + item.file, omitBackground: true });
  console.log('framed', item.file);
}
await b.close();
