/**
 * Client for /api/ai. Cost guards: free text only (never buttons), ≤ 300 chars, no call when the
 * templates already found a clear red flag, one request in flight, a short gap between requests,
 * same text answered from memory, summary cached per report data. Any failure → null → templates.
 */
import { AI_CODES, type AiCode, MAX_TEXT } from './agent/aiCodes';

const TIMEOUT_MS = 4_000;
const MIN_GAP_MS = 1_500;
let inFlight = false;
let lastCall = 0;
const memo = new Map<string, AiCode>();

/** Stable id per phone (for the daily quota on the server). Not personal data. */
export function installId(): string {
  try {
    let id = localStorage.getItem('kh.install');
    if (!id) {
      id = Math.random().toString(36).slice(2, 12);
      localStorage.setItem('kh.install', id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

async function post(body: object, fetcher: typeof fetch): Promise<Record<string, unknown> | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetcher('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) return null;
    return (await r.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function classifyText(
  text: string,
  device: string,
  fetcher: typeof fetch = fetch,
): Promise<AiCode | null> {
  const t = text.trim().slice(0, MAX_TEXT);
  if (t.length < 2) return null;
  const hit = memo.get(t);
  if (hit) return hit;
  const now = Date.now();
  if (inFlight || now - lastCall < MIN_GAP_MS) return null; // debounce: templates answer this one
  inFlight = true;
  lastCall = now;
  try {
    const r = await post({ task: 'classify', text: t, device }, fetcher);
    const code = r?.report;
    if (typeof code === 'string' && (AI_CODES as readonly string[]).includes(code)) {
      memo.set(t, code as AiCode);
      return code as AiCode;
    }
    return null;
  } finally {
    inFlight = false;
  }
}

/** djb2 hash of the report payload, for the summary cache key. */
export function hashOf(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export async function summarize(
  payload: object,
  device: string,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  const key = `kh.aisum.${hashOf(JSON.stringify(payload))}`;
  try {
    const cached = localStorage.getItem(key);
    if (cached) return cached;
  } catch {
    /* no storage */
  }
  const r = await post({ task: 'summarize', report: payload, device }, fetcher);
  const s = typeof r?.summary === 'string' ? r.summary : null;
  if (s) {
    try {
      localStorage.setItem(key, s);
    } catch {
      /* no storage */
    }
  }
  return s;
}

/** Test helper. */
export function _resetAiClient() {
  inFlight = false;
  lastCall = 0;
  memo.clear();
}
