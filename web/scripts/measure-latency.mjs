/**
 * Measures virtual mat → app latency: the real ESP32 firmware on Wokwi → Firebase → the app on the
 * «السجادة الافتراضية (Wokwi)» source. Five Wokwi sessions, one stand each (firmware/wokwi/latency.scenario.yaml):
 * the free plan ends a session after 5 minutes and the simulator runs slower than real time.
 *
 *   start = this computer's clock when the firmware's "# scan ready" serial line arrives from Wokwi
 *           (the line is printed just before the scan is pushed to Firebase)
 *   end   = this computer's clock when the app's scan screen shows the new scan ([data-testid=scan-done])
 *
 * Both times come from the same computer clock. Needs WOKWI_CLI_TOKEN, wokwi-cli in ~/.wokwi/bin, and a
 * firmware built by firmware/wokwi/build.sh. Usage (in web/):
 *   node scripts/measure-latency.mjs [appUrl]
 */
/* global window, document, MutationObserver -- used inside page.addInitScript (runs in the browser) */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';
import { chromium } from '@playwright/test';

const APP = process.argv[2] ?? 'https://deploy-preview-1--dulcet-blini-8f718e.netlify.app';
const WOKWI_DIR = new URL('../../firmware/wokwi/', import.meta.url).pathname;
const RUNS = Number(process.env.RUNS) || 5;
const scanPath = `${APP}/scan?source=wokwi&as=patient&nosplash=1`;

const marks = [];
const browser = await chromium.launch({ channel: 'chromium' });
const page = await (
  await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar-SA' })
).newPage();
await page.exposeFunction('khMark', (t) => {
  marks.push(t);
  console.log(`[app] scan shown #${marks.length} at ${t}`);
});
// Fires once per page load, the moment the scan screen renders an arrived scan.
await page.addInitScript(() => {
  const check = () => {
    if (!window.__khMarked && document.querySelector('[data-testid=scan-done]')) {
      window.__khMarked = true;
      window.khMark(Date.now());
    }
  };
  new MutationObserver(check).observe(document, { subtree: true, childList: true });
});
await page.goto(scanPath);
await page.getByText('متصل بالسجادة الافتراضية (Wokwi)').waitFor();
console.log(`[app] watching ${scanPath}`);

const starts = [];
const saved = [];
const serial = [];
for (let run = 1; run <= RUNS; run++) {
  if (run > 1) {
    await page.goto(scanPath); // fresh scan screen for the next stand
    await page.getByText('متصل بالسجادة الافتراضية (Wokwi)').waitFor();
  }
  const before = marks.length;
  const cli = spawn(
    `${homedir()}/.wokwi/bin/wokwi-cli`,
    ['.', '--scenario', 'latency.scenario.yaml', '--timeout', '280000'],
    { cwd: WOKWI_DIR, env: process.env },
  );
  let ready = null;
  let ack = null;
  for (const stream of [cli.stdout, cli.stderr])
    createInterface({ input: stream }).on('line', (line) => {
      const t = Date.now();
      serial.push(`${run} ${t} ${line}`);
      if (line.startsWith('# scan ready')) {
        ready = t;
        console.log(`[wokwi] run ${run}: scan ready at ${t}`);
      } else if (line.startsWith('# scan saved') && ready && !ack) ack = t;
      else if (/auth: ready|auth: connection timed out|Error|Timeout/.test(line))
        console.log(`[wokwi] run ${run}: ${line}`);
    });
  const code = await new Promise((r) => cli.on('close', r));
  await new Promise((r) => setTimeout(r, 3000)); // let a late arrival land
  starts.push(ready);
  saved.push(ack);
  if (marks.length === before) marks.push(null);
  console.log(`[run ${run}] wokwi-cli exit ${code}`);
}
await browser.close();

const rows = starts.map((s, i) => ({
  run: i + 1,
  scanReadyAt: s,
  firebaseAckMs: s && saved[i] ? saved[i] - s : null,
  appShownMs: s && marks[i] ? marks[i] - s : null,
}));
const ok = rows.map((r) => r.appShownMs).filter((v) => v !== null && v > 0);
const sorted = [...ok].sort((a, b) => a - b);
const mid = Math.floor(sorted.length / 2);
const median = !sorted.length ? null : sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
console.table(rows);
console.log(`${ok.length}/${RUNS} runs measured; median ${median} ms`);
mkdirSync(`${WOKWI_DIR}build`, { recursive: true });
writeFileSync(
  `${WOKWI_DIR}build/latency-${Date.now()}.json`,
  JSON.stringify({ app: APP, measuredAt: new Date().toISOString(), rows, medianMs: median }, null, 2),
);
writeFileSync(`${WOKWI_DIR}build/latency-serial.log`, serial.join('\n'));
