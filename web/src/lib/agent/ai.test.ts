import { afterEach, describe, expect, test, vi } from 'vitest';
import { _resetAiClient, classifyText, hashOf } from '../ai';
import type { AiCode } from './aiCodes';
import { combine, needsAi } from './combine';
import { type ChatContext, reply } from './templates';

const ctx: ChatContext = {
  level: 'green',
  reason: '',
  thermal: 'normal',
  site: 'الإبهام',
  foot: 'اليمنى',
  dT: 0,
  streak: 0,
  missed: 0,
  mode: 'normal',
  todayDone: true,
  quickDone: false,
  familyConsent: true,
  dayKey: '2026-11-10',
};

/**
 * 15 dialect sentences. `ai` is what a correct model returns (mocked); `calls` says whether the model
 * should be called at all (no call when the templates already found a clear red flag).
 */
const CASES: { text: string; ai: AiCode; calls: boolean; expect: 'red' | 'yellow' | 'none' }[] = [
  { text: 'رجلي فيها جرح صغير', ai: 'wound', calls: false, expect: 'red' },
  { text: 'طلعت لي فقاعة تحت الإبهام', ai: 'blister', calls: false, expect: 'red' },
  { text: 'عندي حمى وقشعريرة من أمس', ai: 'fever', calls: false, expect: 'red' },
  { text: 'إصبعي فيه صديد', ai: 'wound', calls: false, expect: 'red' },
  { text: 'قدمي منفوخة من أمس', ai: 'swelling', calls: true, expect: 'red' },
  { text: 'فيه شي مفتوح تحت رجلي', ai: 'wound', calls: true, expect: 'red' },
  { text: 'الجلد تحت الكعب صار فيه ماي مثل البالون', ai: 'blister', calls: true, expect: 'red' },
  { text: 'جسمي حار وأحس برجفة', ai: 'fever', calls: true, expect: 'red' },
  { text: 'صار لي يومين أحس بوجع جديد في الكعب', ai: 'new_pain', calls: true, expect: 'yellow' },
  { text: 'أصابعي محمرة شوي', ai: 'redness', calls: true, expect: 'yellow' },
  { text: 'رجلي اليمين لونها وردي من تحت', ai: 'redness', calls: true, expect: 'yellow' },
  { text: 'كل شي تمام الحمد لله', ai: 'none', calls: true, expect: 'none' },
  { text: 'ما فيه جرح ولا شي', ai: 'none', calls: true, expect: 'none' },
  { text: 'نسيت أقيس أمس', ai: 'none', calls: true, expect: 'none' },
  { text: 'وين أحط السجادة بالضبط؟', ai: 'none', calls: true, expect: 'none' },
];

afterEach(() => {
  _resetAiClient();
  vi.useRealTimers();
});

describe('15 dialect sentences: templates + (mocked) AI → the more serious result', () => {
  for (const c of CASES) {
    test(`${c.expect}: ${c.text}`, async () => {
      _resetAiClient();
      const fetcher = vi.fn(async () => new Response(JSON.stringify({ report: c.ai }), { status: 200 }));
      expect(needsAi(c.text)).toBe(c.calls);
      const ai = needsAi(c.text)
        ? await classifyText(c.text, 'khatwa-01:test', fetcher as unknown as typeof fetch)
        : null;
      expect(fetcher).toHaveBeenCalledTimes(c.calls ? 1 : 0);
      const merged = combine(c.text, ai);
      expect(merged.severity).toBe(c.expect);
      const r = reply({ text: c.text }, ctx, merged.extraFlags);
      const redflag = r.effects.some((e) => e.type === 'event' && e.event.kind === 'redflag');
      expect(redflag).toBe(c.expect === 'red');
      if (c.expect === 'red') expect(r.msgs[0]!.tone).toBe('urgent');
    });
  }
});

describe('disagreement and failure', () => {
  test('templates find a red flag, model says none → still red (and the model is not even called)', () => {
    expect(needsAi('فيه سائل يطلع من جرح')).toBe(false);
    expect(combine('فيه سائل يطلع من جرح', 'none').severity).toBe('red');
  });
  test('model says swelling, templates find nothing → red (the more serious)', () => {
    expect(combine('قدمي منفوخة', 'swelling').severity).toBe('red');
  });
  test('function down, no key or over quota → null → template reply only', async () => {
    for (const status of [503, 429, 500]) {
      _resetAiClient();
      const fetcher = vi.fn(async () => new Response(JSON.stringify({ fallback: true }), { status }));
      expect(await classifyText('قدمي منفوخة', 'd', fetcher as unknown as typeof fetch)).toBeNull();
    }
    expect(combine('قدمي منفوخة', null).severity).toBe('none');
  });
  test('network error or a timeout → null', async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError('offline');
    });
    expect(await classifyText('قدمي منفوخة', 'd', fetcher as unknown as typeof fetch)).toBeNull();
  });
  test('an unknown code from the server is ignored', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ report: 'cancer' }), { status: 200 }));
    expect(await classifyText('شي غريب', 'd', fetcher as unknown as typeof fetch)).toBeNull();
  });
});

describe('cost guards (client)', () => {
  test('text is cut to 300 characters before sending', async () => {
    const fetcher = vi.fn(async (_u: string, init?: RequestInit) => {
      expect(JSON.parse(String(init!.body)).text).toHaveLength(300);
      return new Response(JSON.stringify({ report: 'none' }));
    });
    await classifyText('ا'.repeat(1000), 'd', fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  test('the same text is answered from memory', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ report: 'redness' })));
    vi.useFakeTimers();
    await classifyText('أصابعي محمرة', 'd', fetcher as unknown as typeof fetch);
    vi.advanceTimersByTime(5000);
    expect(await classifyText('أصابعي محمرة', 'd', fetcher as unknown as typeof fetch)).toBe('redness');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  test('debounce: a second message within 1.5 s does not call the model', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ report: 'none' })));
    await classifyText('رسالة أولى', 'd', fetcher as unknown as typeof fetch);
    expect(await classifyText('رسالة ثانية', 'd', fetcher as unknown as typeof fetch)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  test('summary cache key changes with the data', () => {
    expect(hashOf('{"a":1}')).not.toBe(hashOf('{"a":2}'));
  });
});
