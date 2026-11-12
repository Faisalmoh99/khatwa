// Generic modern phone frame (no brand marks): video overlay + screen mask, backgrounds, and framed screenshots.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const OUT = new URL('./frame/', import.meta.url).pathname;
const SCREENS = new URL('../../deliverables/screens/', import.meta.url).pathname;
const FRAMED = new URL('../../deliverables/screens-framed/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
mkdirSync(FRAMED, { recursive: true });

// Video geometry (1080x1920): screen 758x1642 (430x932 aspect), bezel 20 px.
export const G = { W: 1080, H: 1920, sx: 161, sy: 139, sw: 758, sh: 1642, bezel: 20, r: 92 };

const phoneCss = (b, r, btn) => `
  .phone{position:absolute;box-sizing:content-box;border:${b}px solid #141417;border-radius:${r + b}px;
    box-shadow:0 0 0 ${Math.max(2, b / 10)}px #2a2a2f inset, 0 ${b * 1.6}px ${b * 4}px rgba(0,0,0,.28)}
  .cam{position:absolute;left:50%;top:${-b / 2}px;width:${b * 0.42}px;height:${b * 0.42}px;margin:${-b * 0.21}px 0 0 ${-b * 0.21}px;
    border-radius:50%;background:#26262c;box-shadow:inset 0 0 0 ${b * 0.08}px #3a3a42}
  .btn{position:absolute;width:${btn}px;border-radius:${btn}px;background:#1d1d21}`;

const b = await chromium.launch();
const p = await b.newPage();
const render = async (html, w, h, file, transparent = true) => {
  await p.setViewportSize({ width: w, height: h });
  await p.setContent(`<!doctype html><html><head><style>*{margin:0}html,body{background:transparent}</style></head><body>${html}</body></html>`);
  await p.waitForTimeout(100);
  await p.screenshot({ path: file, omitBackground: transparent });
};

// 1) Video overlay: phone body with a transparent screen.
const { sx, sy, sw, sh, bezel, r } = G;
await render(
  `<style>${phoneCss(bezel, r, 6)}</style>
   <div class="btn" style="left:${sx - bezel - 6}px;top:${sy + sh * 0.18}px;height:${sh * 0.06}px"></div>
   <div class="btn" style="left:${sx - bezel - 6}px;top:${sy + sh * 0.26}px;height:${sh * 0.06}px"></div>
   <div class="btn" style="left:${sx + sw + bezel}px;top:${sy + sh * 0.22}px;height:${sh * 0.1}px"></div>
   <div class="phone" style="left:${sx - bezel}px;top:${sy - bezel}px;width:${sw}px;height:${sh}px"><div class="cam"></div></div>`,
  G.W,
  G.H,
  `${OUT}overlay.png`,
);
// 2) Screen mask (white rounded screen on black) for clean corners.
await render(
  `<div style="position:absolute;inset:0;background:#000"><div style="position:absolute;left:0;top:0;width:${sw}px;height:${sh}px;border-radius:${r}px;background:#fff"></div></div>`,
  sw,
  sh,
  `${OUT}mask.png`,
  false,
);
// 3) Backgrounds.
for (const [name, color] of [
  ['bg-teal', '#0F4C5C'],
  ['bg-white', '#FFFFFF'],
])
  await render(`<div style="width:100vw;height:100vh;background:${color}"></div>`, G.W, G.H, `${OUT}${name}.png`, false);

// 4) Deck screenshots in the same frame, transparent, full resolution (1290x2796 screen).
const S = { w: 1290, h: 2796, b: 34, r: 157 };
const pad = 160;
for (const f of readdirSync(SCREENS).filter((x) => x.endsWith('.png'))) {
  const img = `data:image/png;base64,${readFileSync(SCREENS + f).toString('base64')}`;
  const W = S.w + 2 * (S.b + pad);
  const H = S.h + 2 * (S.b + pad);
  const x = pad + S.b;
  const y = pad + S.b;
  await render(
    `<style>${phoneCss(S.b, S.r, 10)}</style>
     <div class="btn" style="left:${x - S.b - 10}px;top:${y + S.h * 0.18}px;height:${S.h * 0.06}px"></div>
     <div class="btn" style="left:${x - S.b - 10}px;top:${y + S.h * 0.26}px;height:${S.h * 0.06}px"></div>
     <div class="btn" style="left:${x + S.w + S.b}px;top:${y + S.h * 0.22}px;height:${S.h * 0.1}px"></div>
     <div class="phone" style="left:${pad}px;top:${pad}px;width:${S.w}px;height:${S.h}px">
       <img src="${img}" style="display:block;width:${S.w}px;height:${S.h}px;border-radius:${S.r}px"><div class="cam"></div></div>`,
    W,
    H,
    `${FRAMED}${f}`,
  );
  console.log('framed', f);
}
await b.close();
