import { beforeEach, describe, expect, test, vi } from 'vitest';

const m = vi.hoisted(() => ({ parse: vi.fn(), create: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {}
  class RateLimitError extends APIError {}
  class Anthropic {
    static APIError = APIError;
    static RateLimitError = RateLimitError;
    messages = { parse: m.parse, create: m.create };
  }
  return { default: Anthropic };
});
vi.mock('@netlify/blobs', () => ({
  getStore: () => {
    throw new Error('no blobs in tests');
  },
}));

const { default: handler, aiRoute } = await import('../../../netlify/functions/ai.mjs' as string);
const ORIGIN = 'https://deploy-preview-1--dulcet-blini-8f718e.netlify.app';
const call = (body: object, origin = ORIGIN) =>
  handler(
    new Request('https://x/api/ai', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

const report = {
  periodDays: 30,
  adherencePct: 90,
  counts: { green: 20, yellow: 5, orange: 2, red: 0, none: 3, paused: 0 },
  episodes: [
    { level: 'orange', days: 2, why: 'فرق 2.6° عند رأس المشط الأول', where: 'رأس المشط الأول، القدم اليمنى' },
  ],
  siteFlags: [{ site: 'رأس المشط الأول', L: 0, R: 3 }],
  quick: { total: 1, skin: 0, pain: 0, skippedCare: 0 },
  redflags: [],
  last: { level: 'orange', reasons: ['فرق 2.6°'] },
};

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  m.parse.mockReset();
  m.create.mockReset();
});

describe('/api/ai function', () => {
  test('classify: Haiku, 60 tokens max, thinking off, structured JSON, text cut to 300', async () => {
    m.parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: { report: 'swelling' } });
    const r = await call({ task: 'classify', text: 'ا'.repeat(900), device: 'khatwa-01:a1' });
    expect(await r.json()).toEqual({ report: 'swelling' });
    const args = m.parse.mock.calls[0]![0];
    expect(args).toMatchObject({ model: 'claude-haiku-5-5', max_tokens: 60, thinking: { type: 'disabled' } });
    expect(args.output_config.format).toBeTruthy();
    expect(args.messages[0].content).toHaveLength(300);
  });

  test('summarize: 350 tokens max, numbers only, text answer', async () => {
    m.create.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'الالتزام 90%.' }],
    });
    const r = await call({ task: 'summarize', report, device: 'khatwa-01:a2' });
    expect(await r.json()).toEqual({ summary: 'الالتزام 90%.' });
    expect(m.create.mock.calls[0]![0]).toMatchObject({ model: 'claude-haiku-5-5', max_tokens: 350 });
    expect(m.create.mock.calls[0]![0].messages[0].content).not.toContain('name');
  });

  test('30 requests per device per day, then a quiet fallback', async () => {
    m.parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: { report: 'none' } });
    for (let i = 0; i < 30; i++)
      expect((await call({ task: 'classify', text: 'مرحبا', device: 'khatwa-01:quota' })).status).toBe(200);
    const r = await call({ task: 'classify', text: 'مرحبا', device: 'khatwa-01:quota' });
    expect(r.status).toBe(429);
    expect(await r.json()).toMatchObject({ fallback: true, reason: 'quota' });
    expect(m.parse).toHaveBeenCalledTimes(30);
    expect((await call({ task: 'classify', text: 'مرحبا', device: 'khatwa-01:other' })).status).toBe(200);
  });

  test('the app site and its deploy previews are allowed origins', async () => {
    m.parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: { report: 'none' } });
    for (const o of [
      'https://khatwa-app-sa.netlify.app',
      'https://deploy-preview-2--khatwa-app-sa.netlify.app',
    ])
      expect((await call({ task: 'classify', text: 'مرحبا', device: 'origin-ok' }, o)).status).toBe(200);
    expect(
      (
        await call(
          { task: 'classify', text: 'مرحبا', device: 'd' },
          'https://khatwa-app-sa.netlify.app.evil.example',
        )
      ).status,
    ).toBe(403);
  });

  test('x-ai-route says direct or gateway, never the key', async () => {
    expect(aiRoute(undefined)).toBe('direct');
    expect(aiRoute('https://api.anthropic.com')).toBe('direct');
    expect(aiRoute('https://example.netlify.app/.netlify/ai')).toBe('gateway');
    const r = await call({ task: 'classify', text: 'x', device: 'd' });
    expect(['direct', 'gateway']).toContain(r.headers.get('x-ai-route'));
    expect(JSON.stringify([...r.headers])).not.toContain('test-key');
  });

  test('unknown origin is rejected without calling the model', async () => {
    const r = await call({ task: 'classify', text: 'مرحبا', device: 'd' }, 'https://evil.example');
    expect(r.status).toBe(403);
    expect(m.parse).not.toHaveBeenCalled();
  });

  test('no key → fallback, model not called', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const r = await call({ task: 'classify', text: 'مرحبا', device: 'd' });
    expect(await r.json()).toMatchObject({ fallback: true, reason: 'no_key' });
    expect(m.parse).not.toHaveBeenCalled();
  });

  test('model error, refusal or unparsed output → fallback', async () => {
    m.parse.mockRejectedValueOnce(new Error('boom'));
    expect(await (await call({ task: 'classify', text: 'مرحبا', device: 'e1' })).json()).toMatchObject({
      fallback: true,
    });
    m.parse.mockResolvedValueOnce({ stop_reason: 'refusal', parsed_output: null });
    expect(await (await call({ task: 'classify', text: 'مرحبا', device: 'e2' })).json()).toMatchObject({
      fallback: true,
    });
  });

  test('bad input is rejected before any model call', async () => {
    expect((await call({ task: 'hack', device: 'd' })).status).toBe(400);
    expect((await call({ task: 'summarize', report: { periodDays: 'x' }, device: 'd' })).status).toBe(400);
    expect(m.parse).not.toHaveBeenCalled();
    expect(m.create).not.toHaveBeenCalled();
  });
});

describe('summary length', async () => {
  const { completeSentences } = await import('../../../netlify/functions/ai.mjs' as string);
  test('a reply cut by max_tokens keeps only complete sentences', () => {
    expect(completeSentences('الجملة الأولى. الجملة الثانية. والثالثة ما', true)).toBe(
      'الجملة الأولى. الجملة الثانية.',
    );
    expect(completeSentences('جملة كاملة.', false)).toBe('جملة كاملة.');
    expect(completeSentences('بدون نقطة', true)).toBe('');
  });
  test('cut reply via the handler', async () => {
    m.create.mockResolvedValue({
      stop_reason: 'max_tokens',
      content: [{ type: 'text', text: 'أولى. ثانية ناقصة' }],
    });
    const r = await call({ task: 'summarize', report, device: 'khatwa-01:cut' });
    expect(await r.json()).toEqual({ summary: 'أولى.' });
  });
});
