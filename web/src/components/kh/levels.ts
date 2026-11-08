/** Display metadata for the four status levels plus "none". Colours come from tokens.css. */
export type Level = 'green' | 'yellow' | 'orange' | 'red' | 'none' | 'paused';

export const LEVEL: Record<
  Level,
  { ar: string; fem: string; short: string; fill: string; ink: string; soft: string }
> = {
  green: {
    ar: 'أخضر',
    fem: 'خضراء',
    short: 'سليم',
    fill: 'var(--kh-green)',
    ink: 'var(--kh-green-ink)',
    soft: 'var(--kh-green-soft)',
  },
  yellow: {
    ar: 'أصفر',
    fem: 'صفراء',
    short: 'انتبه',
    fill: 'var(--kh-yellow)',
    ink: 'var(--kh-yellow-ink)',
    soft: 'var(--kh-yellow-soft)',
  },
  orange: {
    ar: 'برتقالي',
    fem: 'برتقالية',
    short: 'يحتاج انتباه',
    fill: 'var(--kh-orange)',
    ink: 'var(--kh-orange-ink)',
    soft: 'var(--kh-orange-soft)',
  },
  red: {
    ar: 'أحمر',
    fem: 'حمراء',
    short: 'راجع الطبيب',
    fill: 'var(--kh-red)',
    ink: 'var(--kh-red-ink)',
    soft: 'var(--kh-red-soft)',
  },
  none: {
    ar: 'بدون قراءة',
    fem: 'بدون قراءة',
    short: 'لا قراءة',
    fill: 'var(--kh-none)',
    ink: 'var(--kh-none-ink)',
    soft: 'var(--kh-none-soft)',
  },
  paused: {
    ar: 'متوقف مؤقتًا',
    fem: 'متوقفة',
    short: 'متوقف',
    fill: 'var(--kh-none)',
    ink: 'var(--kh-none-ink)',
    soft: 'var(--kh-none-soft)',
  },
};
