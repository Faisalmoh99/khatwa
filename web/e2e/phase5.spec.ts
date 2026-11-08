import { expect, type Page, test } from '@playwright/test';
import { go, open } from './helpers';

/** /api/ai is mocked here (no model calls in e2e). The real function is tested in Vitest and on the preview. */
async function mockAi(page: Page, reply: (body: { task: string; text?: string }) => object | null) {
  const calls: { task: string; text?: string }[] = [];
  await page.route('**/api/ai', async (route) => {
    const body = route.request().postDataJSON() as { task: string; text?: string };
    calls.push(body);
    const r = reply(body);
    await new Promise((res) => setTimeout(res, 300));
    if (!r) return route.fulfill({ status: 503, body: JSON.stringify({ fallback: true }) });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(r) });
  });
  return calls;
}

test('AI hears swelling the templates missed → red path (the more serious wins)', async ({ page }) => {
  const calls = await mockAi(page, () => ({ report: 'swelling' }));
  await go(page, '/assistant');
  await page.getByTestId('chat-input').fill('قدمي منفوخة من أمس');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-typing')).toBeVisible();
  await expect(page.getByTestId('chat-urgent')).toBeVisible();
  expect(calls).toHaveLength(1);
});

test('AI hears redness → the patient is asked to confirm in the quick check (AI does not set the level)', async ({ page }) => {
  await mockAi(page, () => ({ report: 'redness' }));
  await go(page, '/assistant');
  await page.getByTestId('chat-input').fill('أصابعي محمرة شوي');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-bot').last()).toContainText('جاوب على الفحص السريع');
  await open(page, '/home');
  await expect(page.getByTestId('today-hero')).toHaveAttribute('data-level', 'none');
});

test('no model call for buttons or for a clear red flag the templates already caught', async ({ page }) => {
  const calls = await mockAi(page, () => ({ report: 'none' }));
  await go(page, '/assistant');
  await page.getByTestId('quick-replies').getByRole('button').first().click();
  await page.getByTestId('chat-input').fill('فيه سائل يطلع من جرح');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-urgent')).toBeVisible();
  expect(calls).toHaveLength(0);
});

test('function down → quiet fallback to the templates', async ({ page }) => {
  await mockAi(page, () => null);
  await go(page, '/assistant');
  await page.getByTestId('chat-input').fill('الجو حلو اليوم');
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-bot').last()).toContainText('ما فهمت تمامًا');
});

test('doctor summary: only on request, labelled, cached for the same report', async ({ page }) => {
  const calls = await mockAi(page, (b) => (b.task === 'summarize' ? { summary: 'خلال 30 يومًا بلغ الالتزام 100%.' } : null));
  await go(page, '/report');
  await page.waitForTimeout(500);
  expect(calls).toHaveLength(0);
  await page.getByTestId('report-summary-btn').click();
  await expect(page.getByTestId('report-summary-text')).toContainText('الالتزام');
  await expect(page.getByTestId('report-summary')).toContainText('ملخص آلي، راجع الأرقام');
  await page.reload();
  await page.getByTestId('report-summary-btn').click();
  await expect(page.getByTestId('report-summary-text')).toBeVisible();
  expect(calls).toHaveLength(1);
});

test('summary falls back to the templates silently', async ({ page }) => {
  await mockAi(page, () => null);
  await go(page, '/report');
  await page.getByTestId('report-summary-btn').click();
  await expect(page.getByTestId('report-summary-text')).toContainText('الالتزام');
  await expect(page.getByTestId('report-summary')).toContainText('ملخص آلي، راجع الأرقام');
});
