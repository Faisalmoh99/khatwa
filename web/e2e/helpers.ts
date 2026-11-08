import { expect, type Page } from '@playwright/test';

/** Opens the app on the in-browser simulator with a fast clock (no Firebase). */
export async function openSim(page: Page, path = '/', extra = '') {
  await page.goto(`${path}?source=sim&simTick=40${extra}`);
  await expect(page.getByText('بيانات محاكاة')).toBeVisible();
}

export async function shot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `e2e/__screenshots__/${name}.png`, fullPage: true });
}
