/** Arabic formatting helpers: correct dual/plural forms and LTR-safe numbers (review finding R8). */

/** "يوم واحد" / "يومين" / "3 أيام" / "11 يومًا" */
export function dayWord(n: number): string {
  if (n === 1) return 'يوم واحد';
  if (n === 2) return 'يومين';
  if (n >= 3 && n <= 10) return `${n} أيام`;
  return `${n} يومًا`;
}

/** "ليوم واحد" / "ليومين متتاليين" / "لمدة 3 أيام متتالية" / "لمدة 11 يومًا متتاليًا" */
export function consecutiveDays(n: number): string {
  if (n === 1) return 'ليوم واحد';
  if (n === 2) return 'ليومين متتاليين';
  if (n >= 3 && n <= 10) return `لمدة ${n} أيام متتالية`;
  return `لمدة ${n} يومًا متتاليًا`;
}

/** Wraps a number in Unicode LTR isolates so it renders correctly inside Arabic plain text (R8). */
export const ltr = (s: string | number) => `\u2066${s}\u2069`;

/** Temperature with one decimal and the degree sign. Signed when asked. */
export function temp(v: number, { signed = false, digits = 1 } = {}): string {
  const s = Math.abs(v).toFixed(digits);
  if (!signed) return `${v < 0 ? '-' : ''}${s}°`;
  return `${v > 0 ? '+' : v < 0 ? '-' : ''}${s}°`;
}

/** Arabic relative time in plain words, for "last reading" labels. */
export function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return 'الآن';
  const m = Math.round(s / 60);
  if (m === 1) return 'قبل دقيقة';
  if (m === 2) return 'قبل دقيقتين';
  if (m < 60) return m <= 10 ? `قبل ${m} دقائق` : `قبل ${m} دقيقة`;
  const h = Math.round(m / 60);
  if (h === 1) return 'قبل ساعة';
  if (h === 2) return 'قبل ساعتين';
  if (h < 24) return h <= 10 ? `قبل ${h} ساعات` : `قبل ${h} ساعة`;
  const d = Math.round(h / 24);
  return `قبل ${dayWord(d)}`;
}

/** Riyadh clock time HH:MM from a server timestamp. */
export function clock(ts: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Riyadh',
  }).format(ts);
}

/** Arabic date like "الأحد 8 نوفمبر" in Riyadh time (Latin digits for readability). */
export function arDate(ts: number): string {
  return new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Riyadh',
  }).format(ts);
}
