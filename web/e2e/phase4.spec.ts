import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { go, open, shot } from './helpers';

test.describe('phase 4: PWA', () => {
  test('installable manifest with Khatwa icons, standalone, Arabic RTL', async ({ page }) => {
    await go(page, '/home');
    const href = await page.locator('link[rel=manifest]').getAttribute('href');
    expect(href).toBeTruthy();
    const m = await page.evaluate(async (h) => (await fetch(h!)).json(), href);
    expect(m).toMatchObject({
      name: 'خطوة',
      short_name: 'خطوة',
      lang: 'ar',
      dir: 'rtl',
      display: 'standalone',
      start_url: '/',
    });
    const sizes = (m.icons as { sizes: string; purpose?: string }[]).map(
      (i) => i.sizes + (i.purpose ? `/${i.purpose}` : ''),
    );
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512', '512x512/maskable']));
    for (const i of m.icons as { src: string }[]) expect((await page.request.get(i.src)).ok()).toBe(true);
    expect((await page.request.get('/apple-touch-icon.png')).ok()).toBe(true);
  });

  test('works offline after the first visit (service worker), and says there is no connection', async ({
    page,
    context,
  }) => {
    await go(page, '/home');
    // First visit installs the worker; it controls the page from the next load (no silent takeover).
    await page.evaluate(async () => void (await navigator.serviceWorker.ready));
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.goto('/home?source=firebase&nosplash=1');
    await expect(page.getByTestId('today-hero')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'اتصال' }).first()).toBeVisible({
      timeout: 15_000,
    });
    await shot(page, '60-offline');
    await page.goto('/history?nosplash=1');
    await expect(page.getByRole('heading', { name: 'السجل' })).toBeVisible();
    await context.setOffline(false);
  });

  test('legacy pages are not swallowed by the app shell', async ({ page }) => {
    for (const [path, title] of [
      ['/sim/', 'محاكي سجادة خطوة'],
      ['/dev/live.html', 'فحص البث المباشر'],
      ['/story/', 'قصة أبو سعد'],
      ['/legacy/', 'خطوة - نسخة التسليم'],
    ] as const) {
      await page.goto(path);
      await expect(page).toHaveTitle(new RegExp(title));
    }
  });
});

test.describe('phase 4: accessibility (axe, WCAG 2 A/AA)', () => {
  const screens: [string, 'patient' | 'family' | 'clinic' | null][] = [
    ['/welcome', null],
    ['/consent', null],
    ['/login', null],
    ['/home', 'patient'],
    ['/scan', 'patient'],
    ['/result', 'patient'],
    ['/quick', 'patient'],
    ['/history', 'patient'],
    ['/assistant', 'patient'],
    ['/photo', 'patient'],
    ['/tips', 'patient'],
    ['/coming-soon', 'patient'],
    ['/report', 'patient'],
    ['/booking', 'patient'],
    ['/device', 'patient'],
    ['/settings', 'patient'],
    ['/more', 'patient'],
    ['/family', 'family'],
    ['/clinic', 'clinic'],
    ['/clinic/patient/v2', 'clinic'],
    ['/clinic/audit', 'clinic'],
    ['/clinic/lab', 'clinic'],
  ];
  for (const [path, as] of screens) {
    test(`no serious or critical violations: ${path}`, async ({ page }) => {
      if (as) await go(page, path, { as });
      else await open(page, `${path}?source=sim`);
      await page.waitForTimeout(400);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      const bad = r.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map(
          (v) =>
            `${v.id}: ${v.nodes
              .map((n) => n.target.join(' '))
              .slice(0, 3)
              .join(' | ')}`,
        );
      expect(bad).toEqual([]);
    });
  }
});
