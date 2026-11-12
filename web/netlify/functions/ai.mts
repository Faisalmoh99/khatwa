/**
 * POST /api/ai  (Netlify Function, Claude Haiku)
 *   { task: "classify", text, device }  → { report: one of AI_CODES }
 *   { task: "summarize", report, device } → { summary }
 * The key lives only in Netlify env (ANTHROPIC_API_KEY). Any failure returns { fallback: true }
 * and the app quietly uses its fixed templates. The AI never decides a risk level.
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { getStore } from '@netlify/blobs';
import { z } from 'zod';
import { AI_CODES, AI_MODEL, DAILY_LIMIT, MAX_TEXT } from '../../src/lib/agent/aiCodes';

const ALLOWED_ORIGIN =
  /^(https:\/\/([a-z0-9-]+--)?(dulcet-blini-8f718e|khatwa-app-sa)\.netlify\.app|http:\/\/localhost:\d+)$/;

const CLASSIFY_SYSTEM = `You classify one short message from an older Saudi patient with diabetes about their feet (Saudi or Gulf Arabic dialect).
Return the single best report:
- wound: an open wound, cut, ulcer, crack, sore, or something open or leaking
- blister: a blister or fluid bubble
- swelling: swelling or puffiness
- fever: fever, chills, or feeling feverish
- new_pain: new pain, ache, burning, or numbness
- redness: redness or color change of the skin
- none: none of the above, a negation ("ما فيه جرح"), or an unrelated message
If several apply, choose the most serious in this order: wound, blister, swelling, fever, new_pain, redness. Do not diagnose.`;

const SUMMARY_SYSTEM = `You write a short summary for a doctor from a foot-temperature monitoring report (IWGDF rule: a difference above 2.2 °C at the same site on the same foot for two consecutive days).
Write 2 to 4 short sentences, at most 70 words, in clear Modern Standard Arabic, plain text, no headings, no lists.
Use only the facts given, copy every number exactly, and do not add a diagnosis, treatment, medicine, or advice.
Fields: periodDays = days in the period; adherencePct = % of days measured or quick-checked; counts = number of days per level (green, yellow, orange, red, none = no measurement, paused);
episodes = orange/red runs (level, days, why, where); siteFlags = days above the threshold per site for the left (L) and right (R) foot;
quick = quick checks: total, skin = checks with abnormal skin, pain = checks with new pain, skippedCare = checks where foot care was skipped;
redflags = danger signs the patient reported; last = the most recent day's level and reasons.`;

/** If the reply hit max_tokens, keep only complete sentences. */
export function completeSentences(text: string, truncated: boolean): string {
  const t = text.trim();
  if (!truncated) return t;
  const cut = Math.max(t.lastIndexOf('.'), t.lastIndexOf('؟'), t.lastIndexOf('!'));
  return cut > 0 ? t.slice(0, cut + 1) : '';
}

const ClassifyOut = z.object({ report: z.enum(AI_CODES) });

const Body = z.object({
  task: z.enum(['classify', 'summarize']),
  device: z.string().regex(/^[a-z0-9:-]{1,80}$/i),
  text: z.string().max(2000).optional(),
  report: z.unknown().optional(),
});

/** Compact, number-only report payload (no names, no photos). */
const ReportIn = z.object({
  periodDays: z.number().int().min(0).max(400),
  adherencePct: z.number().min(0).max(100),
  counts: z.record(z.string(), z.number()),
  episodes: z
    .array(
      z.object({
        level: z.string().max(10),
        days: z.number(),
        why: z.string().max(300),
        where: z.string().max(80),
      }),
    )
    .max(20),
  siteFlags: z.array(z.object({ site: z.string().max(40), L: z.number(), R: z.number() })).max(4),
  quick: z.object({ total: z.number(), skin: z.number(), pain: z.number(), skippedCare: z.number() }),
  redflags: z.array(z.string().max(120)).max(20),
  last: z.object({ level: z.string().max(10), reasons: z.array(z.string().max(300)).max(5) }),
});

/**
 * Which way model calls go, for checking a deploy (never the key itself): "direct" = our own
 * ANTHROPIC_API_KEY straight to api.anthropic.com; "gateway" = a base URL injected by Netlify's AI Gateway.
 */
export function aiRoute(baseUrl = process.env.ANTHROPIC_BASE_URL): 'direct' | 'gateway' {
  if (!baseUrl) return 'direct';
  try {
    return new URL(baseUrl).hostname === 'api.anthropic.com' ? 'direct' : 'gateway';
  } catch {
    return 'gateway';
  }
}

const json = (body: unknown, status = 200, origin = '') =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-ai-route': aiRoute(),
      ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}),
    },
  });

/** Daily quota per device (Netlify Blobs; in-memory fallback when Blobs is unavailable, e.g. tests). */
const memQuota = new Map<string, number>();
export async function takeQuota(
  device: string,
  day = new Date().toISOString().slice(0, 10),
): Promise<boolean> {
  const key = `${day}/${device}`;
  try {
    // Strong consistency: the default (eventual) read a stale count, so the cap never triggered.
    const store = getStore({ name: 'khatwa-ai-quota', consistency: 'strong' });
    const n = Number(await store.get(key)) || 0;
    if (n >= DAILY_LIMIT) return false;
    await store.set(key, String(n + 1));
    return true;
  } catch {
    const n = memQuota.get(key) ?? 0;
    if (n >= DAILY_LIMIT) return false;
    memQuota.set(key, n + 1);
    return true;
  }
}

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ timeout: 8_000, maxRetries: 1 }));

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get('origin') ?? '';
  if (req.method === 'OPTIONS') return json({}, 204, ALLOWED_ORIGIN.test(origin) ? origin : '');
  if (req.method !== 'POST') return json({ fallback: true, reason: 'method' }, 405);
  if (!ALLOWED_ORIGIN.test(origin)) return json({ fallback: true, reason: 'origin' }, 403);
  const allow = origin;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return json({ fallback: true, reason: 'bad_request' }, 400, allow);
  }
  if (!process.env.ANTHROPIC_API_KEY) return json({ fallback: true, reason: 'no_key' }, 503, allow);

  try {
    if (body.task === 'classify') {
      const text = (body.text ?? '').trim().slice(0, MAX_TEXT);
      if (text.length < 2) return json({ report: 'none' }, 200, allow);
      if (!(await takeQuota(body.device))) return json({ fallback: true, reason: 'quota' }, 429, allow);
      const r = await anthropic().messages.parse({
        model: AI_MODEL,
        max_tokens: 60,
        thinking: { type: 'disabled' },
        output_config: { effort: 'low', format: zodOutputFormat(ClassifyOut) },
        system: CLASSIFY_SYSTEM,
        messages: [{ role: 'user', content: text }],
      });
      if (r.stop_reason === 'refusal' || !r.parsed_output)
        return json({ fallback: true, reason: 'unparsed' }, 502, allow);
      return json({ report: r.parsed_output.report }, 200, allow);
    }

    const report = ReportIn.safeParse(body.report);
    if (!report.success) return json({ fallback: true, reason: 'bad_report' }, 400, allow);
    if (!(await takeQuota(body.device))) return json({ fallback: true, reason: 'quota' }, 429, allow);
    const r = await anthropic().messages.create({
      model: AI_MODEL,
      max_tokens: 350,
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
      system: SUMMARY_SYSTEM,
      messages: [{ role: 'user', content: JSON.stringify(report.data) }],
    });
    const summary = completeSentences(
      r.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join(''),
      r.stop_reason === 'max_tokens',
    );
    if (r.stop_reason === 'refusal' || !summary) return json({ fallback: true, reason: 'empty' }, 502, allow);
    return json({ summary: summary.slice(0, 1200) }, 200, allow);
  } catch (e) {
    const status = e instanceof Anthropic.RateLimitError ? 429 : e instanceof Anthropic.APIError ? 502 : 500;
    return json({ fallback: true, reason: 'upstream' }, status, allow);
  }
}
