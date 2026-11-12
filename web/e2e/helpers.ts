import { expect, type Page } from '@playwright/test';

type Role = 'patient' | 'family' | 'clinic' | null;

/** Opens the app on the in-browser simulator (no Firebase), fast clock, no splash, signed in as `as`. */
export async function go(page: Page, path = '/', { as = 'patient' as Role, demo = false, extra = '' } = {}) {
  const q = new URLSearchParams({ source: 'sim', simTick: '40', nosplash: '1' });
  if (as) q.set('as', as);
  if (demo) q.set('demo', '1');
  await page.goto(`${path}?${q}${extra}`);
  await expect(page.getByText('بيانات محاكاة').first()).toBeVisible();
}

/** iPhone viewport screenshot (what the user sees), plus an optional full-page one. */
export async function shot(page: Page, name: string, { full = false } = {}) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250); // let entry animations settle
  await page.screenshot({ path: `e2e/__screenshots__/${name}.png` });
  if (full) {
    await page.addStyleTag({ content: 'header,nav{position:static!important}' });
    await page.screenshot({ path: `e2e/__screenshots__/${name}-full.png`, fullPage: true });
    await page.addStyleTag({ content: 'header{position:sticky!important} nav{position:fixed!important}' });
  }
}

/** Runs one simulated stand from the scan screen. */
export async function simScan(page: Page, scenario: string) {
  await page.getByTestId('sim-scenario').selectOption(scenario);
  await expect(page.getByTestId('sim-start')).toBeEnabled({ timeout: 10_000 });
  await page.getByTestId('sim-start').click();
}

/** Layout checks used on every screen: no sideways scroll, readable text, big targets. */
export async function checkLayout(page: Page) {
  const r = await page.evaluate(() => {
    const docW = document.documentElement.scrollWidth;
    const small = [...document.querySelectorAll<HTMLElement>('button, a, [role=radio], select, input')]
      .filter((e) => e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden')
      // Exempt: links inside a sentence (WCAG 2.5.8 inline exception) and switches (their 48px row is the target).
      .filter((e) => !e.closest('[data-allow-small], p, dd, [role=switch]'))
      .map((e) => ({
        t: (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 30),
        h: Math.round(e.getBoundingClientRect().height),
      }))
      .filter((x) => x.h < 44);
    // Elements sticking out of the 390px screen, even if clipped by the root (deepest offenders only).
    const out = (e: Element) => {
      const b = e.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && (b.right > 391 || b.left < -1);
    };
    const offenders = [...document.querySelectorAll('body *')]
      .filter((e) => out(e) && ![...e.children].some(out) && !e.closest('[data-scroll-x]'))
      .map((e) => {
        const b = e.getBoundingClientRect();
        return `${e.tagName.toLowerCase()}.${String(e.getAttribute('class') ?? '').slice(0, 60)} "${(e.textContent ?? '').trim().slice(0, 24)}" [${Math.round(b.left)}..${Math.round(b.right)}]`;
      })
      .slice(0, 6);
    return {
      docW,
      small,
      offenders,
      vw: window.innerWidth,
      font: parseFloat(getComputedStyle(document.body).fontSize),
    };
  });
  expect(r.offenders, `nothing outside the screen (innerWidth ${r.vw})`).toEqual([]);
  expect(r.docW, 'no horizontal scroll').toBeLessThanOrEqual(390);
  expect(r.small, 'touch targets ≥ 44px').toEqual([]);
  expect(r.font).toBeGreaterThanOrEqual(17);
}

/** Navigates with a full page load, keeping the fast simulator clock and no splash. */
export async function open(page: Page, path: string) {
  await page.goto(`${path}${path.includes('?') ? '&' : '?'}nosplash=1&simTick=40`);
}
