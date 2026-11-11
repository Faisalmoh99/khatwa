import { expect, type Page, test } from '@playwright/test';
import { checkLayout, go, open, shot } from './helpers';

const kinds = async (page: Page, kind: string) =>
  (
    (await page.evaluate(
      () => JSON.parse(localStorage.getItem('kh.sim.khatwa-01') || '{}').events ?? [],
    )) as { kind: string; data?: Record<string, unknown> }[]
  ).filter((e) => e.kind === kind);

async function switchRole(page: Page, role: 'patient' | 'family' | 'clinic') {
  await open(page, '/settings');
  await page.getByTestId('change-role').click();
  await page.getByTestId(`role-${role}`).click();
}

async function patientRedFlag(page: Page) {
  await go(page, '/assistant');
  await page.getByTestId('chat-input').fill('فيه سائل يطلع من جرح في رجلي');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-urgent')).toBeVisible();
  await open(page, '/home');
  await expect.poll(async () => (await kinds(page, 'escalation')).length).toBe(3);
}

test.describe('phase 3: family', () => {
  test('family sees the patient level, the alert sent to them, call and WhatsApp, and can acknowledge', async ({
    page,
  }) => {
    await patientRedFlag(page);
    await switchRole(page, 'family');
    await expect(page).toHaveURL(/\/family/);
    await open(page, '/settings');
    await page.getByPlaceholder('الاسم، مثلًا: أبو سعد').fill('أبو سعد');
    await page.getByPlaceholder('05XXXXXXXX').fill('0551234567');
    await open(page, '/family');
    await expect(page.getByTestId('family-hero')).toHaveAttribute('data-level', 'red');
    await expect(page.getByText('أبو سعد')).toBeVisible();
    await expect(page.getByTestId('event-list')).toContainText('إلى: العائلة');
    await expect(page.getByTestId('family-call')).toHaveAttribute('href', 'tel:+966551234567');
    await expect(page.getByTestId('family-wa')).toHaveAttribute(
      'href',
      /^https:\/\/wa\.me\/966551234567\?text=/,
    );
    await checkLayout(page);
    await shot(page, '50-family', { full: true });
    await page.getByTestId('family-ack').click();
    await expect.poll(async () => (await kinds(page, 'family_ack')).length).toBe(1);
  });
});

test.describe('phase 3: clinic', () => {
  test('patient list: real patient on top, the rest labelled virtual and sorted by priority', async ({
    page,
  }) => {
    await go(page, '/clinic', { as: 'clinic' });
    const items = page.getByTestId('patients').locator('li');
    await expect(items).toHaveCount(6);
    await expect(items.first()).toContainText('محاكاة'); // simulated data is never tagged as the real device
    for (let i = 1; i < 6; i++) await expect(items.nth(i)).toContainText('افتراضي');
    const scores = await items.evaluateAll((els) =>
      els.slice(1).map((e) => Number(e.textContent!.match(/\((\d+)\)/)?.[1])),
    );
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    await checkLayout(page);
    await shot(page, '51-clinic-patients', { full: true });
  });

  test('virtual patient detail shows the priority breakdown and its history', async ({ page }) => {
    await go(page, '/clinic', { as: 'clinic' });
    await page.getByTestId('patient-v5').click();
    await expect(page.getByTestId('patient-kind')).toContainText('افتراضي');
    await expect(page.getByTestId('priority')).toContainText('علامة خطر من المريض');
    await expect(page.getByTestId('chart-hallux')).toBeVisible();
    await checkLayout(page);
    await shot(page, '52-clinic-patient', { full: true });
  });

  test('audit log lists each escalation: to whom, when and why', async ({ page }) => {
    await patientRedFlag(page);
    await switchRole(page, 'clinic');
    await open(page, '/clinic/audit');
    const list = page.getByTestId('event-list');
    await expect(list.locator('[data-kind=escalation]')).toHaveCount(3);
    await expect(list).toContainText('إلى: العيادة');
    await expect(list).toContainText('إلى: العائلة');
    await expect(list.locator('[data-kind=redflag]')).toContainText('خروج سائل');
    await checkLayout(page);
    await shot(page, '53-clinic-audit', { full: true });
    await page.getByRole('button', { name: 'بلاغات المريض' }).click();
    await expect(list.locator('[data-kind=escalation]')).toHaveCount(0);
    await open(page, '/clinic/patient/real');
    await page.getByTestId('clinic-ack').click();
    await expect.poll(async () => (await kinds(page, 'clinic_ack')).length).toBe(1);
  });

  test('rule lab: simulated comparison, clearly labelled', async ({ page }) => {
    await go(page, '/clinic/lab', { as: 'clinic' });
    await expect(page.getByTestId('lab-warning')).toContainText('محاكاة، أرقام من افتراضاتنا');
    await expect(page.getByTestId('lab-two')).toBeVisible({ timeout: 20_000 });
    for (const k of ['single', 'two', 'window', 'twoProto', 'windowProto'])
      await expect(page.getByTestId(`lab-${k}`)).toBeVisible();
    await expect(page.getByTestId('lab-assume').locator('li')).toHaveCount(6);
    await checkLayout(page);
    await shot(page, '54-rule-lab', { full: true });
  });
});

test.describe('phase 3: report and booking', () => {
  test('visit report from real data, with QR, photo and a printable A4 PDF', async ({ page }) => {
    await go(page, '/settings');
    await page.locator('select').filter({ hasText: 'سليم' }).selectOption('developing');
    await page.getByTestId('sim-load-days').click();
    await open(page, '/photo');
    const chooser = page.waitForEvent('filechooser');
    await page.getByTestId('photo-today-pick').click();
    await (await chooser).setFiles('e2e/foot-fixture.jpg');
    await expect(page.getByTestId('photo-msg')).toContainText('انحفظت');
    await open(page, '/report');
    await expect(page.getByTestId('report-qr')).toBeVisible();
    await expect(page.getByTestId('report-stats')).toContainText('الالتزام');
    await expect(page.getByTestId('report-episodes')).toContainText('رأس المشط الأول، القدم اليمنى');
    await expect(page.getByTestId('report-sites')).toContainText('رأس المشط الأول');
    await expect(page.getByTestId('report-photos').locator('img')).toHaveCount(1);
    await expect(page.getByTestId('report-photos')).toContainText('ما فيه أي تحليل');
    await expect(page.getByTestId('report-sim')).toBeVisible();
    await expect(page.getByTestId('report')).not.toContainText(/تروية|ضغط مرتفع|مؤشر/);
    await checkLayout(page);
    await shot(page, '55-report', { full: true });
    await page.emulateMedia({ media: 'print' });
    await page.screenshot({ path: 'e2e/__screenshots__/56-report-print.png', fullPage: true });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      path: 'e2e/__screenshots__/report.pdf',
    });
    expect(pdf.byteLength).toBeGreaterThan(20_000);
  });

  test('booking request (demo) is written as an event', async ({ page }) => {
    await go(page, '/booking');
    await expect(page.getByText('تجريبي').first()).toBeVisible();
    await page.getByTestId('booking-day').first().click();
    await page.getByTestId('booking-slot').nth(1).click();
    await checkLayout(page);
    await shot(page, '57-booking', { full: true });
    await page.getByTestId('booking-submit').click();
    await expect(page.getByTestId('booking-done')).toContainText('ما فيه حجز حقيقي');
    expect(await kinds(page, 'booking')).toHaveLength(1);
  });
});
