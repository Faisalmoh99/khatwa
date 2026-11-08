import { expect, type Page, test } from '@playwright/test';
import { checkLayout, go, open, shot } from './helpers';

const stored = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('kh.sim.khatwa-01') || '{}') as {
        events?: { kind: string; data?: Record<string, unknown> }[];
      },
  );
const kinds = async (page: Page, kind: string) =>
  ((await stored(page)).events ?? []).filter((e) => e.kind === kind);

async function loadDays(page: Page, id: string) {
  await open(page, '/settings');
  await page.locator('select').filter({ hasText: 'سليم' }).selectOption(id);
  await page.getByTestId('sim-load-days').click();
}

test.describe('phase 2: assistant', () => {
  test('opens the conversation and answers a quick reply', async ({ page }) => {
    await go(page, '/assistant');
    await expect(page.getByTestId('chat-bot').first()).toContainText('ما قست اليوم');
    await checkLayout(page);
    await shot(page, '40-assistant-opener');
    await page.getByTestId('quick-replies').getByRole('button', { name: 'مسافر' }).click();
    await expect(page.getByTestId('chat-bot').last()).toContainText('وضع السفر');
  });

  test('red flag in free text → urgent fixed reply, redflag event, red day', async ({ page }) => {
    await go(page, '/assistant');
    await page.getByTestId('chat-input').fill('فيه سائل يطلع من جرح في رجلي');
    await page.getByTestId('chat-send').click();
    await expect(page.getByTestId('chat-urgent')).toContainText('أبلغنا العيادة');
    await shot(page, '41-assistant-redflag');
    expect(await kinds(page, 'redflag')).toHaveLength(1);
    await open(page, '/home');
    await expect(page.getByTestId('today-hero')).toHaveAttribute('data-level', 'red');
    // the patient app writes the red escalations to the clinic and family (audit log)
    await expect
      .poll(async () => (await kinds(page, 'escalation')).map((e) => e.data?.to).sort())
      .toEqual(['clinic', 'family', 'patient']);
  });

  test('negation does not escalate', async ({ page }) => {
    await go(page, '/assistant');
    await page.getByTestId('chat-input').fill('ما فيه جرح الحمد لله');
    await page.getByTestId('chat-send').click();
    await expect(page.getByTestId('chat-urgent')).toHaveCount(0);
    expect(await kinds(page, 'redflag')).toHaveLength(0);
  });

  test('medical question → fixed refusal and a question event for the clinic', async ({ page }) => {
    await go(page, '/assistant');
    await page.getByTestId('chat-input').fill('وش أحسن مرهم لقدمي؟');
    await page.getByTestId('chat-send').click();
    await expect(page.getByTestId('chat-bot').last()).toContainText('ما أقدر أحكم على حالتك');
    expect(await kinds(page, 'question')).toHaveLength(1);
  });

  test('voice input button is hidden when the browser has no speech recognition', async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-expect-error test override
      delete window.SpeechRecognition;
      // @ts-expect-error test override
      delete window.webkitSpeechRecognition;
    });
    await go(page, '/assistant');
    await expect(page.getByTestId('chat-input')).toBeVisible();
    await expect(page.getByTestId('mic')).toHaveCount(0);
  });

  test('voice input button shows when speech recognition exists', async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-expect-error test stub
      window.webkitSpeechRecognition = class {
        start() {}
        stop() {}
      };
    });
    await go(page, '/assistant');
    await expect(page.getByTestId('mic')).toBeVisible();
  });
});

test.describe('phase 2: adherence ladder, escalations, pause modes', () => {
  for (const [id, step, to, text] of [
    ['stop1', 2, 'patient', 'فاتك يوم'],
    ['stop2', 3, 'family', 'يومين'],
    ['stop3', 4, 'clinic', '3 أيام'],
  ] as const) {
    test(`${id}: ladder step ${step}, escalation to ${to}, written once`, async ({ page }) => {
      await go(page, '/settings');
      await page.getByTestId('reminder-time').fill('00:00');
      await loadDays(page, id);
      await open(page, '/home');
      await expect(page.getByTestId('ladder-text')).toContainText(text);
      await expect(page.getByTestId('ladder').locator('[aria-current=step]')).toContainText(String(step));
      await expect.poll(async () => (await kinds(page, 'escalation')).map((e) => e.data?.to)).toEqual([to]);
      if (id === 'stop2') await shot(page, '42-home-ladder-family', { full: true });
      await page.reload();
      await expect(page.getByTestId('ladder')).toBeVisible();
      await page.waitForTimeout(600);
      expect(await kinds(page, 'escalation')).toHaveLength(1);
    });
  }

  test('travel mode: written to the log, ladder paused, no escalations', async ({ page }) => {
    await go(page, '/settings');
    await page.getByTestId('reminder-time').fill('00:00');
    await page.getByRole('radio', { name: /سفر/ }).click();
    await expect.poll(async () => (await kinds(page, 'mode')).map((e) => e.data?.mode)).toEqual(['travel']);
    await loadDays(page, 'stop3');
    await open(page, '/home');
    await expect(page.getByTestId('paused-banner')).toBeVisible();
    await expect(page.getByTestId('ladder-text')).toContainText('متوقف');
    await shot(page, '43-home-paused');
    await page.waitForTimeout(600);
    expect(await kinds(page, 'escalation')).toHaveLength(0);
  });

  test('daily reminder shows after the reminder time when not measured', async ({ page }) => {
    await go(page, '/settings');
    await page.getByTestId('reminder-time').fill('00:00');
    await open(page, '/home');
    await expect(page.getByTestId('reminder')).toBeVisible();
  });
});

test.describe('phase 2: history, photo, tips, coming soon', () => {
  test('history: one chart per site from real scans, with the 7-day baseline marked as a hypothesis', async ({
    page,
  }) => {
    await go(page, '/settings');
    await loadDays(page, 'developing');
    await open(page, '/history');
    for (const id of ['hallux', 'mth1', 'mth5', 'heel'])
      await expect(page.getByTestId(`chart-${id}`)).toBeVisible();
    await expect(page.getByTestId('baseline-note')).toContainText('فرضية');
    await expect(page.getByTestId('chart-mth1')).toContainText('(فرضية)');
    await checkLayout(page);
    await shot(page, '44-history', { full: true });
  });

  test('photo: saved as a thumbnail for the clinic, with no analysis', async ({ page }) => {
    await go(page, '/photo');
    await expect(page.getByTestId('photo-no-analysis')).toContainText('تحليل الصورة: إصدار قادم');
    const chooser = page.waitForEvent('filechooser');
    await page.getByTestId('photo-today-pick').click();
    await (await chooser).setFiles('e2e/foot-fixture.jpg');
    await expect(page.getByTestId('photo-msg')).toContainText('انحفظت');
    await expect(page.getByTestId('photo-today-img')).toBeVisible();
    const photos = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('kh.sim.khatwa-01') || '{}').photos as {
          jpeg: string;
          role: string;
        }[],
    );
    expect(photos).toHaveLength(1);
    expect(photos[0]!.role).toBe('today');
    expect(photos[0]!.jpeg.length * 0.75).toBeLessThan(60_000);
    await expect(page.locator('body')).not.toContainText(/مؤشر|احمرار ظاهر|نتيجة التحليل/);
    await checkLayout(page);
    await shot(page, '45-photo', { full: true });
  });

  test('photo needs the separate photo consent', async ({ page }) => {
    await go(page, '/settings');
    await page.getByRole('switch', { name: 'حفظ صور القدم للعيادة' }).click();
    await open(page, '/photo');
    await expect(page.getByText('حفظ الصور غير مفعّل')).toBeVisible();
  });

  test('tips and coming soon (no numbers)', async ({ page }) => {
    await go(page, '/tips');
    await expect(page.getByTestId('tip')).toHaveCount(5);
    await checkLayout(page);
    await shot(page, '46-tips');
    await open(page, '/coming-soon');
    await expect(page.getByTestId('soon')).toHaveCount(5);
    const txt = await page.locator('main').innerText();
    expect(txt.replace('TMP117', '')).not.toMatch(/\d/);
    await checkLayout(page);
    await shot(page, '47-coming-soon', { full: true });
  });
});
