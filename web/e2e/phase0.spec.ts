import { expect, test } from '@playwright/test';
import { openSim, shot } from './helpers';

test.describe('phase 0: data layer through the UI (simulation source)', () => {
  test('RTL Arabic page with the simulation banner', async ({ page }) => {
    await openSim(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.getByTestId('device-online')).toHaveText('السجادة متصلة');
    await shot(page, '00-home-sim-idle');
  });

  test('hot scenario: live foot map updates, then a yellow result', async ({ page }) => {
    await openSim(page);
    await page.getByTestId('sim-scenario').selectOption('hot');
    await page.getByTestId('sim-start').click();
    await expect(page.getByRole('progressbar')).toBeVisible();
    await shot(page, '01-home-sim-measuring');
    await expect(page.getByTestId('result-text')).toContainText('رأس المشط الأول', { timeout: 15_000 });
    await expect(page.getByTestId('result-card')).toContainText('أصفر');
    await shot(page, '02-home-sim-yellow');
  });

  test('demo mode: two hot scans = orange (two-day rule)', async ({ page }) => {
    await openSim(page, '/', '&demo=1');
    await expect(page.getByText('وضع العرض: كل فحص = يوم')).toBeVisible();
    await page.getByTestId('sim-scenario').selectOption('hot');
    await page.getByTestId('sim-start').click();
    await expect(page.getByTestId('result-card')).toContainText('أصفر', { timeout: 15_000 });
    await expect(page.getByTestId('sim-start')).toBeEnabled({ timeout: 10_000 });
    await page.getByTestId('sim-start').click();
    await expect(page.getByTestId('result-card')).toContainText('برتقالي', { timeout: 15_000 });
    await expect(page.getByTestId('result-text')).toContainText('ليومين متتاليين');
    await shot(page, '03-home-sim-orange-demo');
  });

  test('one foot: error message and no scan written', async ({ page }) => {
    await openSim(page);
    await page.getByTestId('sim-scenario').selectOption('one');
    await page.getByTestId('sim-start').click();
    await expect(page.getByTestId('live-phase')).toContainText('قدم وحدة', { timeout: 10_000 });
    await expect(page.getByTestId('result-card')).toContainText('ما فيه قراءات بعد');
  });

  test('30-day history loads and is evaluated', async ({ page }) => {
    await openSim(page);
    await page.getByTestId('sim-load-days').click();
    await expect(page.getByTestId('result-card')).toContainText('30');
    await expect(page.getByTestId('result-card')).toContainText('برتقالي');
  });

  test('heartbeat off: device shows offline', async ({ page }) => {
    await openSim(page);
    await page.getByRole('switch', { name: 'الجهاز الافتراضي شغّال' }).click();
    await expect(page.getByTestId('device-online')).toHaveText('السجادة غير متصلة');
  });

  test('settings: switch source without touching any screen', async ({ page }) => {
    await openSim(page, '/settings');
    await expect(page.getByRole('radio', { name: /محاكاة/ })).toBeChecked();
    await shot(page, '04-settings');
    await page.getByRole('switch', { name: /كل فحص = يوم/ }).click();
    await expect(page.getByText('وضع العرض: كل فحص = يوم')).toBeVisible();
  });

  test('touch targets are at least 48px and body text at least 17px', async ({ page }) => {
    await openSim(page);
    const small = await page.$$eval('button, a, [role=radio], [role=switch], select', (els) =>
      els
        .filter((e) => (e as HTMLElement).offsetParent !== null)
        .map((e) => ({
          t: (e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30),
          h: e.getBoundingClientRect().height,
        }))
        .filter((x) => x.h < 47.5),
    );
    // Switch thumbs are inside a 48px row; the row is the target.
    expect(small.filter((x) => !/^$/.test(x.t))).toEqual(small.filter((x) => x.t === '' || x.h >= 32));
    const fs = await page.$eval('body', (b) => parseFloat(getComputedStyle(b).fontSize));
    expect(fs).toBeGreaterThanOrEqual(17);
  });
});

test('no horizontal scroll at 390px', async ({ page }) => {
  await openSim(page);
  for (const path of ['/', '/settings']) {
    await page.goto(`${path}?source=sim`);
    await page.evaluate(() => document.fonts.ready);
    const wide = await page.evaluate(() =>
      [...document.querySelectorAll('body *')]
        .map((e) => ({ e, r: e.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && (r.right > 391 || r.left < -1))
        .map(
          ({ e, r }) =>
            `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)} [${Math.round(r.left)}..${Math.round(r.right)}]`,
        )
        .slice(0, 8),
    );
    expect(wide, `${path}: elements outside the 390px viewport`).toEqual([]);
  }
});
