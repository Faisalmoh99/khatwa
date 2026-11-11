import { expect, test } from '@playwright/test';
import { shot } from './helpers';

/**
 * Acceptance against the real Firebase project (needs internet).
 * Run: E2E_FIREBASE=1 E2E_DEVICE_PASSWORD=… npx playwright test   (password never stored in the repo)
 * 1) The legacy /sim/ writes like the ESP32 and the new app shows it live → result.
 *    Writes one simulated scan (source "sim") to devices/khatwa-test (khatwa-01 is kept clean for the demo).
 * 2) A quick-check event round-trips through Firebase, on a separate test device (khatwa-e2e),
 *    with «هذا جوال المريض» on (?writes=1): without it nothing is written.
 */
test('@firebase legacy /sim/ → Firebase → new app (live, then result)', async ({ browser }) => {
  test.skip(
    !process.env.E2E_DEVICE_PASSWORD,
    'needs E2E_DEVICE_PASSWORD (device account) since the rules allow only the device to write scans',
  );
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar-SA' });
  const app = await ctx.newPage();
  const sim = await ctx.newPage();

  await app.goto('/scan?source=firebase&as=patient&nosplash=1&dev=khatwa-test');
  await sim.goto('/sim/?dev=khatwa-test');
  if (process.env.E2E_DEVICE_EMAIL) await sim.locator('#devEmail').fill(process.env.E2E_DEVICE_EMAIL);
  await sim.locator('#devPass').fill(process.env.E2E_DEVICE_PASSWORD!);
  await sim.locator('#loginBtn').click();
  await expect(sim.locator('#conn')).toHaveText('متصل بحساب الجهاز', { timeout: 30_000 });
  await expect(app.getByTestId('scan-offline')).toBeHidden({ timeout: 30_000 });

  await sim.locator('#scn').selectOption('normal');
  await sim.locator('#start').click();
  await expect(app.getByRole('progressbar')).toBeVisible({ timeout: 20_000 });
  await shot(app, '90-firebase-live-from-legacy-sim');
  await expect(app).toHaveURL(/\/result/, { timeout: 90_000 });
  await expect(app.getByText('قراءة محاكاة')).toBeVisible();
  await shot(app, '91-firebase-result-from-legacy-sim');
  await ctx.close();
});

test('@firebase quick-check event is written to Firebase and read back', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/quick?source=firebase&as=patient&nosplash=1&dev=khatwa-e2e&writes=1');
  await page.getByTestId('quick-skin-wound').click();
  await page.getByTestId('quick-pain-ok').click();
  await page.getByTestId('quick-care-done').click();
  await expect(page.getByTestId('quick-result')).toHaveAttribute('data-level', 'red');
  await page.goto('/home?nosplash=1');
  await expect(page.getByTestId('today-hero')).toHaveAttribute('data-level', 'red', { timeout: 30_000 });
});
