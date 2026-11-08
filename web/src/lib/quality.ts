/**
 * Live quality messages for the scan screen. Advisory only: they never decide a level.
 * The decision is made by rules.ts once the scan is finished.
 */
import type { Live } from '@/data/types';
import { checkScan, isSensorFault, type ScanCheck, SITES } from './rules/rules';

export type Tone = 'info' | 'warn' | 'error';
export interface QualityMsg {
  code:
    | 'one_foot'
    | 'movement'
    | 'fault'
    | 'low_temp'
    | 'implausible'
    | 'stepped_off'
    | 'standing'
    | 'unstable'
    | 'allsites'
    | 'shape';
  tone: Tone;
  title: string;
  body: string;
}

const FOOT_AR = { L: 'اليسرى', R: 'اليمنى' } as const;

export function liveMessages(live: Live | null | undefined): QualityMsg[] {
  if (!live) return [];
  const out: QualityMsg[] = [];
  const msg = live.msg ?? '';
  if (live.phase === 'error') {
    if (/قدم وحدة|مكانها/.test(msg))
      out.push({
        code: 'one_foot',
        tone: 'error',
        title: 'قف بالقدمين معًا',
        body: 'السجادة حسّت بقدم وحدة بس. انزل وقف من جديد بالقدمين، كل كعب على مكانه.',
      });
    else
      out.push({
        code: 'stepped_off',
        tone: 'error',
        title: 'ما اكتمل القياس',
        body: msg ? `${msg}. قف من جديد واثبت لين نقول «تم».` : 'قف من جديد واثبت لين نقول «تم».',
      });
    return out;
  }
  if (/حركة/.test(msg))
    out.push({
      code: 'movement',
      tone: 'warn',
      title: 'لاحظنا حركة',
      body: 'اثبت مكانك وخلّ قدميك على السجادة. نعيد عدّ الثبات.',
    });

  if (live.phase === 'settling') {
    const faults: string[] = [];
    (['L', 'R'] as const).forEach((f) =>
      (live[f] ?? []).forEach((v, i) => {
        if (v !== 0 && isSensorFault(v)) faults.push(`${SITES[i]!.ar} (القدم ${FOOT_AR[f]})`);
      }),
    );
    if (faults.length)
      out.push({
        code: 'fault',
        tone: 'info',
        title: 'حساس معطّل',
        body: `${faults.join('، ')}: هذي النقطة بدون مقارنة. نكمل بباقي النقاط، وبنبلّغ الدعم.`,
      });

    const vals = [...(live.L ?? []), ...(live.R ?? [])].filter((v) => v !== 0 && !isSensorFault(v));
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    if (avg !== null && (live.elapsedSec ?? 0) >= 5 && avg < 26)
      out.push({
        code: 'low_temp',
        tone: 'warn',
        title: 'القراءة منخفضة',
        body: 'لو قدمك مبللة من الوضوء، نشّفها كويس بالمنشفة، خصوصًا بين الأصابع.',
      });
    if (vals.some((v) => v > 40))
      out.push({
        code: 'implausible',
        tone: 'warn',
        title: 'حرارة غير منطقية',
        body: 'كنت تمشي على أرض حارة؟ انتظر شوي وأعد القياس.',
      });
  }
  return out;
}

/** Why a finished scan was not counted, in plain words. Empty when the scan is usable. */
export function scanProblems(check: ScanCheck): QualityMsg[] {
  if (check.ok) return [];
  const out: QualityMsg[] = [];
  for (const i of check.issues) {
    if (i.code === 'standing')
      out.push({
        code: 'standing',
        tone: 'error',
        title: 'الوقوف ما كان صح',
        body: 'قف بالقدمين معًا على السجادة وأعد القياس.',
      });
    if (i.code === 'unstable')
      out.push({
        code: 'unstable',
        tone: 'error',
        title: 'القراءة ما استقرت',
        body: 'اثبت مكانك أطول شوي وأعد القياس.',
      });
    if (i.code === 'implausible')
      out.push({
        code: 'implausible',
        tone: 'error',
        title: 'حرارة غير منطقية',
        body: 'قدمك مبللة؟ أو كنت على أرض حارة؟ نشّف قدمك وانتظر شوي، ثم أعد.',
      });
    if (i.code === 'allsites')
      out.push({
        code: 'allsites',
        tone: 'error',
        title: 'فرق كبير في كل النقاط مرة وحدة',
        body: 'غالبًا خطأ وقوف. انزل وقف من جديد بالقدمين بنفس الطريقة، وأعد القياس.',
      });
    if (i.code === 'shape')
      out.push({
        code: 'shape',
        tone: 'error',
        title: 'القراءة ناقصة',
        body: 'وصلت قراءة ناقصة من السجادة. أعد القياس.',
      });
  }
  if (!out.length)
    out.push({
      code: 'shape',
      tone: 'error',
      title: 'ما قدرنا نحسب القراءة',
      body: 'كل الحساسات بدون قراءة. تواصل مع الدعم.',
    });
  return out;
}

export { checkScan };
