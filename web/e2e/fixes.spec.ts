/** Fixes from the manual test round (11 Nov). One test per finding. */
import { expect, type Page, test } from '@playwright/test';
import { checkLayout, go, open, shot, simScan } from './helpers';

async function switchRole(page: Page, role: 'patient' | 'family' | 'clinic') {
  await open(page, '/settings');
  await page.getByTestId('change-role').click();
  await page.getByTestId(`role-${role}`).click();
}

test('demo mode reaches family, clinic and report: two hot scans = orange everywhere', async ({ page }) => {
  await go(page, '/scan', { demo: true });
  await simScan(page, 'hot');
  await expect(page).toHaveURL(/\/result/, { timeout: 15_000 });
  await open(page, '/scan');
  await simScan(page, 'hot');
  await expect(page).toHaveURL(/\/result/, { timeout: 15_000 });
  await expect(page.getByTestId('result-hero')).toHaveAttribute('data-level', 'orange');

  await open(page, '/report');
  await expect(page.getByTestId('report-last')).toHaveAttribute('data-level', 'orange');

  await switchRole(page, 'family');
  await expect(page).toHaveURL(/\/family/);
  await expect(page.getByTestId('family-hero')).toHaveAttribute('data-level', 'orange');
  await expect(page.getByTestId('event-list')).not.toContainText('الحمد لله');
  await shot(page, '60-family-demo-orange', { full: true });

  await switchRole(page, 'clinic');
  await expect(page).toHaveURL(/\/clinic/);
  await expect(page.getByTestId('patient-real')).toHaveAttribute('data-level', 'orange');
  await shot(page, '61-clinic-demo-orange');
});

test('login accepts Arabic digits for phone and code, and explains a wrong number', async ({ page }) => {
  await go(page, '/settings');
  await page.getByRole('button', { name: 'سجّل خروج' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByTestId('login-phone').fill('١٢٣');
  await page.getByTestId('login-next').click();
  await expect(page.getByTestId('phone-err')).toContainText('الرقم غير صحيح');
  await shot(page, '62-login-phone-error');
  await page.getByTestId('login-phone').fill('٠٥٥١٢٣٤٥٦٧');
  await expect(page.getByTestId('login-phone')).toHaveValue('0551234567');
  await expect(page.getByTestId('phone-err')).toBeHidden();
  await page.getByTestId('login-next').click();
  await page.getByTestId('login-otp').fill('١٢٣٤');
  await expect(page.getByTestId('login-otp')).toHaveValue('1234');
  await page.getByTestId('login-verify').click();
  await expect(page).toHaveURL(/\/role/);
});

test('family number accepts Arabic digits', async ({ page }) => {
  await go(page, '/settings');
  await page.getByTestId('family-phone').fill('٠٥٥١٢٣٤٥٦٧');
  await expect(page.getByTestId('family-phone')).toHaveValue('0551234567');
  await expect(page.getByText('اكتب رقم جوال سعودي صحيح.')).toBeHidden();
});

test('"stand on both feet" stays until the patient presses retry', async ({ page }) => {
  await go(page, '/scan');
  await simScan(page, 'one');
  await expect(page.getByTestId('q-one_foot')).toBeVisible({ timeout: 15_000 });
  // The simulator used to go idle after ~6 ticks and the message vanished 3 s later.
  await page.waitForTimeout(5_000);
  await expect(page.getByTestId('q-one_foot')).toBeVisible();
  await checkLayout(page);
  await shot(page, '63-scan-one-foot-held');
  await page.getByTestId('scan-retry').click();
  await expect(page.getByTestId('q-one_foot')).toBeHidden();
  await expect(page.getByTestId('scan-steps')).toBeVisible();
});

test('assistant: redness words ask to confirm, "stop alerts" points to travel mode', async ({ page }) => {
  await go(page, '/assistant');
  await page.route('**/api/ai', (r) => r.fulfill({ json: { fallback: true, reason: 'test' } }));
  await page.getByTestId('chat-input').fill('رجلي حمرا');
  await page.getByTestId('chat-send').click();
  await expect(page.getByText('فهمت إنك تحس باحمرار')).toBeVisible();
  await page.getByTestId('chat-input').fill('وقف التنبيهات');
  await page.getByTestId('chat-send').click();
  await expect(page.getByText(/فعّل «وضع السفر» من الإعدادات/)).toBeVisible();
  await shot(page, '64-assistant-stop-alerts');
  await page.getByRole('button', { name: 'افتح وضع السفر في الإعدادات' }).click();
  await expect(page).toHaveURL(/\/settings#modes/);
});

test('about section says what the AI does and does not do', async ({ page }) => {
  await go(page, '/settings');
  await expect(page.getByText(/Claude Haiku/)).toContainText('يفهم كلام المريض الحر بس');
});

test('family and clinic see the patient consents read-only', async ({ page }) => {
  for (const as of ['family', 'clinic'] as const) {
    await go(page, '/settings', { as });
    await expect(page.getByTestId('consents-readonly')).toContainText('مشاركة التنبيهات مع العائلة');
    await expect(page.locator('#consents').getByRole('switch')).toHaveCount(0);
  }
  await shot(page, '65-clinic-consents-readonly', { full: true });
  await go(page, '/settings', { as: 'patient' });
  await expect(page.locator('#consents').getByRole('switch')).toHaveCount(2);
});
