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

/** Tag for the device-backed patient in the clinic, by data source (honesty: simulation is never "real"). */
/** The exact build-status sentence used across the app, README and deck (honesty rule). */
export const BUILD_STATUS_AR = 'مصمم لـ 4 حساسات حرارة لكل قدم + ضغط الكعب. الجهاز المادي يُبنى للنهائيات';

/** "Mat connected" in words that never call the simulator a real mat. */
export function matStatusAr(kind: 'firebase' | 'simulation' | 'serial' | 'wokwi', online: boolean): string {
  if (kind === 'simulation') return online ? 'المحاكي شغّال' : 'المحاكي متوقف';
  if (kind === 'wokwi') return online ? 'السجادة الافتراضية متصلة' : 'السجادة الافتراضية غير متصلة';
  return online ? 'السجادة متصلة' : 'السجادة غير متصلة';
}

export function ownPatientTag(kind: 'firebase' | 'simulation' | 'serial' | 'wokwi'): string {
  if (kind === 'firebase') return 'الجهاز الحقيقي';
  if (kind === 'wokwi') return 'السجادة الافتراضية (Wokwi)';
  if (kind === 'serial') return 'متصل بـ USB';
  return 'محاكاة';
}
