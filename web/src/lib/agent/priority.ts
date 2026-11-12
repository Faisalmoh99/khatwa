/**
 * Clinic priority: a published point sum, NOT a clinical risk score (ported from the prototype).
 * Photo, pressure and perfusion items were removed: we do not measure them (honesty rules).
 *
 * Today's level comes first: red 300, orange 200, yellow 100 points. The other items (capped at 99) only
 * order patients WITHIN the same level, so a red patient always ranks above any orange one.
 */
import type { FinalLevel } from '../level';
import type { Status } from '../rules/rules';

const LEVEL_POINTS: Partial<Record<FinalLevel, { label: string; pts: number }>> = {
  red: { label: 'المستوى اليوم: أحمر', pts: 300 },
  orange: { label: 'المستوى اليوم: برتقالي', pts: 200 },
  yellow: { label: 'المستوى اليوم: أصفر', pts: 100 },
};
const ITEMS_CAP = 99;
const BAND_RANK = { عادي: 0, متابعة: 1, مرتفع: 2, عاجل: 3 } as const;
const LEVEL_BAND: Partial<Record<FinalLevel, Priority['band']>> = {
  red: 'عاجل',
  orange: 'مرتفع',
  yellow: 'متابعة',
};

export interface PriorityInput {
  /** Today's final level (the same one the patient sees). */
  level?: FinalLevel;
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
  const items: { label: string; pts: number }[] = [];
  const add = (label: string, pts: number) => pts && items.push({ label, pts });
  if (s.thermal === 'alert') add('نقطة ساخنة مستمرة', 40);
  else if (s.thermal === 'watch') add('فرق ليوم واحد', 15);
  if (s.thermal === 'alert' && s.streak > 2)
    add(`أيام متتالية إضافية (${Math.min(s.streak - 2, 2)})`, Math.min(s.streak - 2, 2) * 10);
  if (s.missed) add(`أيام بلا قياس (${Math.min(s.missed, 3)})`, Math.min(s.missed, 3) * 8);
  if (s.redFlag) add('علامة خطر من المريض', 50);
  if (s.checkFlag) add('إجابة مقلقة في الفحص السريع', 20);
  if (s.unresponsive) add('المريض ما استجاب', 10);
  const itemPts = items.reduce((a, p) => a + p.pts, 0);
  const lvl = s.level ? LEVEL_POINTS[s.level] : undefined;
  const parts = lvl ? [lvl, ...items] : items;
  const score = (lvl?.pts ?? 0) + Math.min(itemPts, ITEMS_CAP);
  const byItems: Priority['band'] =
    itemPts >= 60 ? 'عاجل' : itemPts >= 30 ? 'مرتفع' : itemPts >= 10 ? 'متابعة' : 'عادي';
  const byLevel = (s.level && LEVEL_BAND[s.level]) || 'عادي';
  const band = BAND_RANK[byLevel] >= BAND_RANK[byItems] ? byLevel : byItems;
  return { score, parts, band };
}
