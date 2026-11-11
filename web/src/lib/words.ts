import type { FinalLevel } from './level';

/** Level names in Arabic (plain text, for messages and reports). */
export const LEVEL_WORD: Record<FinalLevel, string> = {
  green: 'أخضر',
  yellow: 'أصفر',
  orange: 'برتقالي',
  red: 'أحمر',
  none: 'بدون قراءة',
  paused: 'متوقف مؤقتًا',
};

/** Family alert list with no entries: never "الحمد لله" while today is orange or red. */
export function familyEmptyText(level: FinalLevel): string {
  return level === 'orange' || level === 'red' ? 'ما فيه تنبيهات جديدة.' : 'ما وصلك أي تنبيه. الحمد لله.';
}
