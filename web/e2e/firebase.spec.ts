import { expect, test } from '@playwright/test';
import { shot } from './helpers';

/**
 * Phase 0 acceptance: the legacy simulator at /sim/ writes to Firebase exactly like the ESP32,
 * and the new app shows it live with no change. If this passes, the ESP32 will work the same way.
 * Writes one simulated scan (source: "sim") to devices/khatwa-01. Run: E2E_FIREBASE=1 npx playwright test
 */
test('@firebase legacy /sim/ → Firebase → new app (live + scan)', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar-SA' });
  const app = await ctx.newPage();
  const sim = await ctx.newPage();

  await app.goto('/?source=firebase');
  await expect(app.getByTestId('result-card')).not.toContainText('جارٍ التحميل', { timeout: 30_000 });
  const before = Number(
    (await app.getByTestId('result-card').innerText()).match(/المسجّلة:\s*(\d+)/)?.[1] ?? 0,
  );

  await sim.goto('/sim/');
  await expect(sim.locator('#conn')).toHaveText('متصل', { timeout: 30_000 });
  await expect(app.getByTestId('device-online')).toHaveText('السجادة متصلة', { timeout: 30_000 });

  await sim.locator('#scn').selectOption('normal');
  await sim.locator('#start').click();

  await expect(app.getByRole('progressbar')).toBeVisible({ timeout: 20_000 });
  await expect(app.getByTestId('live-card')).toContainText('ثبّت قدميك');
  await shot(app, '10-firebase-live-from-legacy-sim');

  await expect
    .poll(
      async () =>
        Number((await app.getByTestId('result-card').innerText()).match(/المسجّلة:\s*(\d+)/)?.[1] ?? 0),
      {
        timeout: 90_000,
      },
    )
    .toBe(before + 1);
  await expect(app.getByTestId('result-card')).toContainText('مصدرها المحاكي');
  await shot(app, '11-firebase-scan-from-legacy-sim');
  await ctx.close();
});
