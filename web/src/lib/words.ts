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
