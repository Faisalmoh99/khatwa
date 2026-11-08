/**
 * Clinic priority: a published point sum, NOT a clinical risk score (ported from the prototype).
 * Photo, pressure and perfusion items were removed: we do not measure them (honesty rules).
 */
import type { Status } from '../rules/rules';

export interface PriorityInput {
  thermal: Status | null;
  streak: number;
  missed: number;
  redFlag: boolean;
  /** Quick check: wound / redness / new pain. */
  checkFlag: boolean;
  unresponsive?: boolean;
}

export interface Priority {
  score: number;
  parts: { label: string; pts: number }[];
  band: 'عاجل' | 'مرتفع' | 'متابعة' | 'عادي';
}

export function priority(s: PriorityInput): Priority {
  const parts: { label: string; pts: number }[] = [];
  const add = (label: string, pts: number) => pts && parts.push({ label, pts });
  if (s.thermal === 'alert') add('نقطة ساخنة مستمرة', 40);
  else if (s.thermal === 'watch') add('فرق ليوم واحد', 15);
  if (s.thermal === 'alert' && s.streak > 2)
    add(`أيام متتالية إضافية (${Math.min(s.streak - 2, 2)})`, Math.min(s.streak - 2, 2) * 10);
  if (s.missed) add(`أيام بلا قياس (${Math.min(s.missed, 3)})`, Math.min(s.missed, 3) * 8);
  if (s.redFlag) add('علامة خطر من المريض', 50);
  if (s.checkFlag) add('إجابة مقلقة في الفحص السريع', 20);
  if (s.unresponsive) add('المريض ما استجاب', 10);
  const score = parts.reduce((a, p) => a + p.pts, 0);
  const band = score >= 60 ? 'عاجل' : score >= 30 ? 'مرتفع' : score >= 10 ? 'متابعة' : 'عادي';
  return { score, parts, band };
}
