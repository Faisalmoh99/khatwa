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

const SHORT = new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
/** Short day label: "8 نوف" or "يوم 3" in demo mode. */
export const dayLabel = (key: string) =>
  key.startsWith('D') ? `يوم ${key.slice(1)}` : SHORT.format(new Date(key + 'T12:00:00Z'));
/** "+0.3°", "-1.2°", and "0.0°" instead of "-0.0°". */
export const signed = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return r === 0 ? '0.0°' : `${r > 0 ? '+' : ''}${r.toFixed(1)}°`;
};

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits → Latin 0-9. Every numeric input goes through this. */
export function toLatinDigits(s: string): string {
  return s.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (c) => {
    const code = c.charCodeAt(0);
    return String(code - (code >= 0x06f0 ? 0x06f0 : 0x0660));
  });
}
