/** Visit report data: everything comes from real scans and events of the period. Pure. */
import type { KhEvent, Photo } from '@/data/types';
import { dayWord } from './format';
import { type FinalLevel, focusSite } from './level';
import type { PatientModel } from './patients';
import { coverageNote } from './quality';
import { SITES } from './rules/rules';

export interface Episode {
  level: 'orange' | 'red';
  from: string;
  to: string;
  days: number;
  why: string;
  where: string;
}

export interface ReportData {
  name: string;
  virtual: boolean;
  simulated: boolean;
  periodDays: number;
  from: string | null;
  to: string | null;
  measured: number;
  adherencePct: number;
  counts: Record<'green' | 'yellow' | 'orange' | 'red' | 'none' | 'paused', number>;
  episodes: Episode[];
  /** Days above threshold per site and foot, from valid scans. */
  siteFlags: { site: string; L: number; R: number }[];
  /** Highest |R−L| per day, for the trend chart. */
  trend: { key: string; v: number | null }[];
  quick: { total: number; skin: number; pain: number; skippedCare: number };
  redflags: { ts: number; why: string }[];
  escalations: number;
  photos: { base: Photo | null; today: Photo | null };
  last: { level: FinalLevel; reasons: string[] };
  /** Faulty sensors in the latest scan of the period ("قسنا 7 من 8 نقاط..."), or null. */
  coverage: string | null;
}

export function buildReport(p: PatientModel, periodDays = 30): ReportData {
  const views = p.views.slice(-periodDays);
  const from = views[0]?.key ?? null;
  const to = views.at(-1)?.key ?? null;
  const counts = { green: 0, yellow: 0, orange: 0, red: 0, none: 0, paused: 0 };
  views.forEach((v) => counts[v.level]++);
  const measured = views.filter((v) => v.done).length;

  const episodes: Episode[] = [];
  for (const v of views) {
    if (v.level !== 'orange' && v.level !== 'red') continue;
    const last = episodes.at(-1);
    const prevIdx = views[views.indexOf(v) - 1];
    if (
      last &&
      prevIdx &&
      (prevIdx.level === 'orange' || prevIdx.level === 'red') &&
      last.to === prevIdx.key
    ) {
      last.to = v.key;
      last.days++;
      if (v.level === 'red') last.level = 'red';
    } else {
      const f = focusSite(v);
      episodes.push({
        level: v.level,
        from: v.key,
        to: v.key,
        days: 1,
        why: v.reasons.map((r) => r.ar.replace(/[⁦-⁩]/g, '')).join('، '),
        where: f ? `${SITES[f.i]!.ar}، القدم ${f.foot === 'R' ? 'اليمنى' : 'اليسرى'}` : '—',
      });
    }
  }

  const siteFlags = SITES.map((s) => ({ site: s.ar, L: 0, R: 0 }));
  for (const v of views) {
    const c = v.thermal?.check;
    if (!c?.ok) continue;
    c.flagged.forEach((i) => {
      const d = c.diff[i]!;
      siteFlags[i]![d > 0 ? 'R' : 'L']++;
    });
  }

  const inPeriod = (e: KhEvent) => views.length > 0 && e.ts >= views[0]!.ts - 86_400_000;
  const qc = p.events
    .filter((e) => e.kind === 'quickcheck' && inPeriod(e))
    .map((e) => e.data as { skin?: string; pain?: string; care?: string });
  const photosBase = [...p.photos].reverse().find((x) => x.role === 'base') ?? null;
  const photosToday = [...p.photos].reverse().find((x) => x.role === 'today') ?? null;
  const today = views.at(-1);

  return {
    name: p.name,
    virtual: p.virtual,
    simulated: p.virtual || p.scans.some((s) => s.source === 'sim'),
    periodDays: views.length,
    from,
    to,
    measured,
    adherencePct: views.length ? Math.round((measured / views.length) * 100) : 0,
    counts,
    episodes,
    siteFlags,
    trend: views.map((v) => {
      const c = v.thermal?.check;
      const vals = c?.ok ? c.diff.filter((d): d is number => d !== null).map(Math.abs) : [];
      return { key: v.key, v: vals.length ? Math.max(...vals) : null };
    }),
    quick: {
      total: qc.length,
      skin: qc.filter((d) => d.skin && d.skin !== 'ok').length,
      pain: qc.filter((d) => d.pain === 'new').length,
      skippedCare: qc.filter((d) => d.care === 'skip').length,
    },
    redflags: p.events
      .filter((e) => e.kind === 'redflag' && inPeriod(e))
      .map((e) => ({ ts: e.ts, why: String((e.data as { why?: unknown })?.why ?? '') })),
    escalations: p.events.filter((e) => e.kind === 'escalation' && inPeriod(e)).length,
    photos: { base: photosBase, today: photosToday },
    last: { level: today?.level ?? 'none', reasons: today?.reasons.map((r) => r.ar) ?? [] },
    coverage: coverageNote([...views].reverse().find((v) => v.thermal)?.thermal?.check),
  };
}

/** Number-only payload for the AI doctor summary (no name, no photos, no device id). */
export function summaryPayload(r: ReportData) {
  const plain = (s: string) => s.replace(/[⁦-⁩]/g, '');
  return {
    periodDays: r.periodDays,
    adherencePct: r.adherencePct,
    counts: r.counts,
    episodes: r.episodes.slice(0, 20).map((e) => ({
      level: e.level,
      days: e.days,
      why: plain(e.why).slice(0, 300),
      where: e.where.slice(0, 80),
    })),
    siteFlags: r.siteFlags,
    quick: r.quick,
    redflags: r.redflags.slice(0, 20).map((f) => f.why.slice(0, 120)),
    last: { level: r.last.level, reasons: r.last.reasons.slice(0, 5).map((x) => plain(x).slice(0, 300)) },
  };
}

/** Fallback summary from fixed templates (used silently when the AI is unavailable). */
export function templateSummary(r: ReportData): string {
  const parts: string[] = [];
  parts.push(
    `خلال ${dayWord(r.periodDays)} بلغ الالتزام ${r.adherencePct}% (${r.measured} من ${r.periodDays}).`,
  );
  if (r.episodes.length) {
    const e = r.episodes.at(-1)!;
    parts.push(
      `سُجّلت ${r.episodes.length} نوبة برتقالية أو حمراء، آخرها ${dayWord(e.days)} عند ${e.where}.`,
    );
  } else parts.push('لم تُسجَّل نوبات برتقالية أو حمراء.');
  const hot = r.siteFlags.filter((s) => s.L + s.R > 0).map((s) => `${s.site} (${dayWord(s.L + s.R)})`);
  if (hot.length) parts.push(`أيام فوق الحد: ${hot.join('، ')}.`);
  if (r.quick.total)
    parts.push(
      `أجرى المريض ${r.quick.total} فحصًا سريعًا، منها ${r.quick.skin} بجلد غير عادي و${r.quick.pain} بألم جديد.`,
    );
  if (r.redflags.length) parts.push(`أبلغ المريض عن ${r.redflags.length} علامة خطر.`);
  return parts.join(' ');
}
